// Support tickets and quick feedback from the reader's side, and the store-rating prompt.
//
// One thread per ticket: the reader's first message, then replies both ways. Staff replies push the reader
// (`NotificationType.SUPPORT`, deeplink `hariharibol://ticket?id=…`, see controllers/admin/support.js).
// Feedback is the same row with `kind = FEEDBACK` and a 1–5 rating, so one admin inbox covers both.

import { prisma } from '../../config/database.js';
import * as s3 from '../../services/s3.js';
import * as support from '../../services/support.js';
import { sniffImage } from '../../utils/reel-media.js';
import { ok, created, paginated } from '../../utils/respond.js';
import { paginate } from '../../utils/pagination.js';
import { AppError, badRequest, notFound, tooMany } from '../../utils/errors.js';

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
// Enough to write in freely, not enough to flood the inbox.
export const DAILY_LIMIT = 10;

const SELECT = {
  id: true,
  kind: true,
  category: true,
  status: true,
  subject: true,
  rating: true,
  userUnread: true,
  lastMessageAt: true,
  resolvedAt: true,
  createdAt: true,
};

/** POST /api/app/support/media — the body is a screenshot. Returns the key to name in `create`. */
export const uploadMedia = async (req, res) => {
  const bytes = req.body;
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw badRequest('No file was sent');
  if (bytes.length > IMAGE_MAX_BYTES) throw new AppError(413, 'MEDIA_TOO_LARGE', 'That picture is too large');
  const contentType = sniffImage(bytes);
  if (!contentType) throw new AppError(422, 'MEDIA_NOT_USABLE', 'That is not a usable picture');

  const key = s3.buildKey('supportImage', contentType);
  await s3.putObject(key, bytes, contentType);
  return ok(res, { key, url: await s3.presignGet(key) });
};

/** POST /api/app/support/tickets */
export const create = async (req, res) => {
  const user = req.auth.user;
  const { kind, category, subject, message, rating, screenshotKey, deviceInfo } = req.valid.body;

  if (kind === 'FEEDBACK' && !rating) throw badRequest('Feedback needs a rating');
  if (kind === 'TICKET' && !message.trim()) throw badRequest('Tell us what happened');
  if (screenshotKey && !s3.isGeneratedKey(screenshotKey)) throw badRequest('That is not an uploaded picture');

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const today = await prisma.supportTicket.count({ where: { userId: user.id, createdAt: { gte: since } } });
  if (today >= DAILY_LIMIT) throw tooMany('You have written in a lot today — please try again tomorrow');

  const key = screenshotKey ? await s3.commitKey(screenshotKey) : null;

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: user.id,
      kind,
      category,
      subject: subject || null,
      rating: rating ?? null,
      screenshotKey: key,
      // The headers are the fallback if the app sent no details of its own.
      deviceInfo: { platform: req.platform, appVersion: req.appVersion, ...(deviceInfo || {}) },
      ...(message.trim() ? { messages: { create: { authorId: user.id, fromStaff: false, body: message.trim() } } } : {}),
    },
    select: SELECT,
  });

  return created(res, ticket);
};

/** GET /api/app/support/tickets — mine, newest activity first; meta.unread counts tickets with a reply not yet read. */
export const list = async (req, res) => {
  const where = { userId: req.auth.user.id };
  const { items, page } = await paginate(prisma.supportTicket, {
    where,
    orderBy: { lastMessageAt: 'desc' },
    select: { ...SELECT, messages: { orderBy: { createdAt: 'asc' }, take: 1, select: { body: true } } },
    query: req.valid.query,
  });
  const unread = await prisma.supportTicket.count({ where: { ...where, userUnread: true } });
  // The list shows the first line of what the reader wrote.
  const shaped = items.map(({ messages, ...ticket }) => ({ ...ticket, preview: messages[0]?.body.slice(0, 140) ?? null }));
  return paginated(res, shaped, page, { unread });
};

/** GET /api/app/support/unread — the badge. */
export const unread = async (req, res) => {
  const count = await prisma.supportTicket.count({ where: { userId: req.auth.user.id, userUnread: true } });
  return ok(res, { count });
};

/** GET /api/app/support/tickets/:id — the conversation; opening it marks the reply read. */
export const get = async (req, res) => {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: req.valid.params.id, userId: req.auth.user.id },
    select: { ...SELECT, screenshotKey: true, messages: { orderBy: { createdAt: 'asc' }, select: { id: true, fromStaff: true, body: true, createdAt: true } } },
  });
  if (!ticket) throw notFound('Ticket');

  if (ticket.userUnread) {
    await prisma.supportTicket.update({ where: { id: ticket.id }, data: { userUnread: false } });
    ticket.userUnread = false;
  }
  const { screenshotKey, ...rest } = ticket;
  return ok(res, { ...rest, screenshotUrl: screenshotKey ? await s3.presignGet(screenshotKey) : null });
};

/** POST /api/app/support/tickets/:id/messages — the reader's follow-up; a resolved ticket reopens. */
export const reply = async (req, res) => {
  const user = req.auth.user;
  const ticket = await prisma.supportTicket.findFirst({ where: { id: req.valid.params.id, userId: user.id } });
  if (!ticket) throw notFound('Ticket');

  const message = await prisma.supportMessage.create({
    data: { ticketId: ticket.id, authorId: user.id, fromStaff: false, body: req.valid.body.body.trim() },
    select: { id: true, fromStaff: true, body: true, createdAt: true },
  });
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { lastMessageAt: message.createdAt, ...(ticket.status === 'RESOLVED' ? { status: 'OPEN', resolvedAt: null } : {}) },
  });
  return created(res, message);
};

/** GET /api/app/support/review-check?trigger= — whether this is a good moment to ask for a store rating. */
export const reviewCheck = async (req, res) => {
  const result = await support.reviewCheck(req.auth.user, req.valid.query.trigger);
  return ok(res, result);
};

/** POST /api/app/support/review-prompts — records that the prompt was shown, or how the pre-prompt was answered. */
export const reviewPrompt = async (req, res) => {
  const { trigger, outcome } = req.valid.body;
  const row = await prisma.reviewPrompt.create({
    data: { userId: req.auth.user.id, platform: req.platform || 'unknown', trigger, outcome },
    select: { id: true, outcome: true, createdAt: true },
  });
  return created(res, row);
};
