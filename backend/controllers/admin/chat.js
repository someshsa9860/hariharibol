// AI chat administration: the persona and limits, what each plan allows, and
// individual wallets. Changes apply without a deploy — settings are cached for a
// minute, plan allowances for 30 seconds (per server process).
//
// This is the only place raw token numbers are shown.

import { prisma } from '../../config/database.js';
import { DEFAULT_DESCRIPTION, DEFAULT_LIMITS, DEFAULT_SYSTEM_PROMPT } from '../../config/chat.js';
import * as chatSettings from '../../services/chat-settings.js';
import * as wallet from '../../services/ai-wallet.js';
import * as audit from '../../services/audit.js';
import { ok, paginated } from '../../utils/respond.js';
import { readPage } from '../../utils/pagination.js';
import { notFound } from '../../utils/errors.js';

/** GET /api/admin/chat/settings */
export const getSettings = async (req, res) =>
  ok(res, {
    systemPrompt: await chatSettings.systemPrompt(),
    defaultSystemPrompt: DEFAULT_SYSTEM_PROMPT,
    description: await chatSettings.description(),
    defaultDescription: DEFAULT_DESCRIPTION,
    limits: await chatSettings.limits(),
    defaultLimits: DEFAULT_LIMITS,
  });

/** PUT /api/admin/chat/settings */
export const saveSettings = async (req, res) => {
  const { systemPrompt, description, limits } = req.valid.body;
  const before = { systemPrompt: await chatSettings.systemPrompt(), description: await chatSettings.description(), limits: await chatSettings.limits() };
  const by = req.auth.user.id;

  // An empty field puts the default back.
  if (systemPrompt !== undefined) await chatSettings.saveSystemPrompt(systemPrompt.trim(), by);
  if (description !== undefined) await chatSettings.saveDescription(description.trim(), by);
  if (limits !== undefined) await chatSettings.saveLimits(limits, by);

  const after = { systemPrompt: await chatSettings.systemPrompt(), description: await chatSettings.description(), limits: await chatSettings.limits() };
  await audit.record(req, { action: 'chat.settings.update', entityType: 'ChatSettings', entityId: 'chat', before: { ...before, limits: JSON.stringify(before.limits) }, after: { ...after, limits: JSON.stringify(after.limits) } });
  return ok(res, after);
};

/** GET /api/admin/chat/plans */
export const listPlans = async (req, res) => {
  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: [{ tier: 'asc' }, { name: 'asc' }],
    include: { aiConfig: true },
  });
  return ok(res, plans.map((p) => ({
    planId: p.id, slug: p.slug, name: p.name, tier: p.tier, isFree: p.isFree, isActive: p.isActive, config: p.aiConfig,
  })));
};

/** PUT /api/admin/chat/plans/:planId */
export const savePlan = async (req, res) => {
  const { planId } = req.valid.params;
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId }, include: { aiConfig: true } });
  if (!plan) throw notFound('Plan');

  const config = await prisma.aiPlanConfig.upsert({
    where: { planId },
    update: req.valid.body,
    create: { ...req.valid.body, planId },
  });
  wallet.clearAllowanceCache();
  await audit.record(req, { action: 'chat.plan.update', entityType: 'AiPlanConfig', entityId: config.id, before: plan.aiConfig, after: config });
  return ok(res, config);
};

/** GET /api/admin/chat/wallets */
export const listWallets = async (req, res) => {
  const { q } = req.valid.query;
  const { page, pageSize, skip, take } = readPage(req.valid.query);
  const where = q ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }] } : {};
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where, skip, take, orderBy: { lastActiveAt: 'desc' },
      select: { id: true, email: true, name: true, aiWallet: { select: { balance: true, allocation: true, periodEnd: true } }, _count: { select: { chatConversations: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  return paginated(res, users.map((u) => ({
    userId: u.id, email: u.email, name: u.name, wallet: u.aiWallet, conversations: u._count.chatConversations,
  })), { page, pageSize, total });
};

async function targetUser(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, timezone: true } });
  if (!user) throw notFound('User');
  return user;
}

/** GET /api/admin/chat/users/:userId */
export const getUser = async (req, res) => {
  const user = await targetUser(req.valid.params.userId);
  const [raw, transactions, conversations] = await Promise.all([
    wallet.raw(user),
    prisma.aiWalletTransaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.chatConversation.count({ where: { userId: user.id } }),
  ]);
  return ok(res, { user, wallet: raw, transactions, conversations });
};

/** POST /api/admin/chat/users/:userId/grant */
export const grant = async (req, res) => {
  const user = await targetUser(req.valid.params.userId);
  const { tokens, note } = req.valid.body;
  await wallet.open(user); // makes the wallet if this person has never chatted
  const balance = await wallet.credit({ userId: user.id, tokens, source: 'ADMIN_GRANT', note, createdById: req.auth.user.id });
  await audit.record(req, { action: 'chat.wallet.grant', entityType: 'User', entityId: user.id, before: null, after: { tokens, note, balance } });
  return ok(res, { balance });
};

/** POST /api/admin/chat/users/:userId/adjust */
export const adjust = async (req, res) => {
  const user = await targetUser(req.valid.params.userId);
  const { tokens, note } = req.valid.body;
  await wallet.open(user);
  const balance = await wallet.adjust({ userId: user.id, tokens, note, createdById: req.auth.user.id });
  await audit.record(req, { action: 'chat.wallet.adjust', entityType: 'User', entityId: user.id, before: null, after: { tokens, note, balance } });
  return ok(res, { balance });
};

/** GET /api/admin/chat/stats */
export const stats = async (req, res) => {
  const since = new Date(Date.now() - 30 * 86400000);
  const [bySource, conversations, messages, users] = await Promise.all([
    prisma.aiWalletTransaction.groupBy({ by: ['source', 'type'], where: { createdAt: { gte: since } }, _sum: { tokens: true }, _count: true }),
    prisma.chatConversation.count({ where: { createdAt: { gte: since } } }),
    prisma.chatMessage.count({ where: { createdAt: { gte: since }, role: 'USER' } }),
    prisma.chatConversation.groupBy({ by: ['userId'], where: { lastMessageAt: { gte: since } } }),
  ]);
  return ok(res, {
    days: 30,
    conversations,
    userMessages: messages,
    activeUsers: users.length,
    tokens: bySource.map((r) => ({ source: r.source, type: r.type, tokens: r._sum.tokens || 0, count: r._count })),
  });
};
