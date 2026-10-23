// The developer companion app's API: the live feed, the numbers on its home screen, and the developer's
// side of the chat with readers. Everything needs `dev.access` (routes/admin/dev.js).
//
// Nothing here is heavy: counts hit indexed columns or Redis, lists are cursor-paged and capped.

import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import * as chat from '../../services/dev-chat.js';
import * as devPush from '../../services/dev-push.js';
import * as presence from '../../services/presence.js';
import { ok, created } from '../../utils/respond.js';
import { notFound, badRequest } from '../../utils/errors.js';

const userSelect = { id: true, name: true, email: true, avatarUrl: true };

const presentEvent = (e) => ({
  id: e.id,
  type: e.type,
  severity: e.severity,
  title: e.title,
  body: e.body,
  data: e.data,
  createdAt: e.createdAt,
});

const presentConversation = (c) => ({
  id: c.id,
  user: c.user,
  lastMessageAt: c.lastMessageAt,
  lastMessagePreview: c.lastMessagePreview,
  devUnread: c.devUnread,
});

/** GET /api/admin/dev/summary — the home screen's numbers. */
export const summary = async (req, res) => {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const hourAgo = new Date(now.getTime() - 3_600_000);
  const bucket = Math.floor(now.getTime() / 60_000);

  const [users, signupsToday, signups7d, unreadChats, criticalHour, errorBuckets, online] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.user.count({ where: { createdAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } } }),
    prisma.devConversation.aggregate({ _sum: { devUnread: true }, _count: { _all: true }, where: { devUnread: { gt: 0 } } }),
    prisma.devEvent.count({ where: { severity: 'critical', createdAt: { gte: hourAgo } } }),
    redis.mget(Array.from({ length: 60 }, (_, i) => `dev:err:${bucket - i}`)),
    presence.counts().catch(() => ({})),
  ]);

  return ok(res, {
    users,
    signupsToday,
    signups7d,
    unreadChats: unreadChats._count._all,
    unreadMessages: unreadChats._sum.devUnread || 0,
    criticalLastHour: criticalHour,
    errorsLastHour: errorBuckets.reduce((n, v) => n + (Number(v) || 0), 0),
    online: online[presence.ONLINE_WINDOW_S] ?? null,
    at: now,
  });
};

/** GET /api/admin/dev/feed — events newest first; `before` is the id of the last one seen. */
export const feed = async (req, res) => {
  const { before, type, severity, limit = 40 } = req.valid.query;
  const rows = await prisma.devEvent.findMany({
    where: { ...(type ? { type: { startsWith: type } } : {}), ...(severity ? { severity } : {}) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(before ? { cursor: { id: before }, skip: 1 } : {}),
  });
  return ok(res, { items: rows.slice(0, limit).map(presentEvent), hasMore: rows.length > limit });
};

/** GET /api/admin/dev/conversations — latest first; unread ones can be asked for alone. */
export const conversations = async (req, res) => {
  const { before, unreadOnly, limit = 30 } = req.valid.query;
  const rows = await prisma.devConversation.findMany({
    where: unreadOnly ? { devUnread: { gt: 0 } } : {},
    orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    include: { user: { select: userSelect } },
    ...(before ? { cursor: { id: before }, skip: 1 } : {}),
  });
  return ok(res, { items: rows.slice(0, limit).map(presentConversation), hasMore: rows.length > limit });
};

async function loadConversation(id) {
  const conversation = await prisma.devConversation.findUnique({ where: { id }, include: { user: { select: userSelect } } });
  if (!conversation) throw notFound('Conversation');
  return conversation;
}

/** GET /api/admin/dev/conversations/:id/messages — opening it marks the reader's messages read. */
export const messages = async (req, res) => {
  const conversation = await loadConversation(req.valid.params.id);
  const { before, limit } = req.valid.query;
  const { messages: items, hasMore } = await chat.page(conversation.id, { before, limit });
  if (!before && conversation.devUnread > 0) {
    await prisma.devConversation.update({ where: { id: conversation.id }, data: { devUnread: 0 } });
  }
  return ok(res, { conversation: { ...presentConversation(conversation), devUnread: 0 }, messages: items, hasMore });
};

/** POST /api/admin/dev/conversations/:id/messages — the developer replies. */
export const reply = async (req, res) => {
  const conversation = await loadConversation(req.valid.params.id);
  const { message } = await chat.addMessage(conversation, {
    body: req.valid.body.body,
    fromDeveloper: true,
    authorId: req.auth.user.id,
  });
  return created(res, message);
};

/** POST /api/admin/dev/conversations/:id/read */
export const markRead = async (req, res) => {
  await prisma.devConversation.updateMany({ where: { id: req.valid.params.id }, data: { devUnread: 0 } });
  return ok(res, { devUnread: 0 });
};

/** POST /api/admin/dev/conversations — the developer starts a conversation with a reader. */
export const start = async (req, res) => {
  const { userId, body } = req.valid.body;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isBanned: true } });
  if (!user) throw notFound('User');
  if (user.isBanned) throw badRequest('That account is banned');
  const conversation = await chat.findOrCreate(userId);
  const { message } = await chat.addMessage(conversation, { body, fromDeveloper: true, authorId: req.auth.user.id });
  return created(res, { conversationId: conversation.id, message });
};

/** GET /api/admin/dev/users?q= — to find someone to write to. */
export const users = async (req, res) => {
  const { q, limit = 20 } = req.valid.query;
  const rows = await prisma.user.findMany({
    where: { isBanned: false, OR: [{ email: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }] },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: userSelect,
  });
  return ok(res, { items: rows });
};

/** GET /api/admin/dev/prefs */
export const getPrefs = async (req, res) => ok(res, await devPush.getPrefs(req.auth.user.id));

/** PUT /api/admin/dev/prefs */
export const setPrefs = async (req, res) => ok(res, await devPush.setPrefs(req.auth.user.id, req.valid.body));
