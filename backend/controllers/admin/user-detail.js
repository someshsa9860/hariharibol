// Everything an admin can see about one person, in tabs so each request stays small: who they are, what they chant,
// day by day, what they read / watch / ask, and what they pay or are owed. Read only; `controllers/admin/user.js`
// holds the actions (role, ban, delete). The admin panel's `/users/:id` page is the one consumer.

import { prisma } from '../../config/database.js';
import * as entitlement from '../../services/entitlement.js';
import { ok } from '../../utils/respond.js';
import { notFound } from '../../utils/errors.js';
import { localDateString, shiftDays, toDateColumn } from '../../utils/date.js';

const take = (n) => ({ take: n });

async function requireUser(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, email: true, name: true, avatarUrl: true, authProvider: true, legacyUserId: true,
      appLanguage: true, mantraLanguage: true, readingLanguage: true, timezone: true, sampradaya: true,
      isPremium: true, premiumSince: true, premiumUntil: true,
      isBanned: true, bannedReason: true, bannedAt: true,
      createdAt: true, updatedAt: true, lastActiveAt: true,
      role: { select: { slug: true, name: true } },
      creatorProfile: { select: { id: true, status: true, displayName: true } },
    },
  });
  if (!user) throw notFound('User');
  return user;
}

// Consecutive days with chanting, ending today or yesterday.
function streaks(dates) {
  const set = new Set(dates);
  let current = 0;
  let cursor = localDateString('Asia/Kolkata');
  if (!set.has(cursor)) cursor = shiftDays(cursor, -1);
  while (set.has(cursor)) { current += 1; cursor = shiftDays(cursor, -1); }
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of [...set].sort()) {
    run = prev && shiftDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best };
}

/** GET /api/admin/users/:id/overview */
export const overview = async (req, res) => {
  const { id } = req.valid.params;
  const user = await requireUser(id);

  const [
    sadhanaProfile, chantTotals, chantDays, activeDays, firstActive, lastActive,
    favorites, notes, highlights, reelViews, reelLikes, reelComments, reelShares,
    conversations, messages, notifications, unread, devices, referralMade, referredBy, ent, routineTasks,
  ] = await Promise.all([
    prisma.sadhanaProfile.findUnique({
      where: { userId: id },
      select: { dailyRoundTarget: true, reminderTime: true, startedAt: true, preferredMantra: { select: { id: true, name: true } } },
    }),
    prisma.chantSession.aggregate({ where: { userId: id }, _sum: { rounds: true, durationSeconds: true }, _count: { _all: true } }),
    prisma.sadhanaDay.findMany({ where: { userId: id, roundsCompleted: { gt: 0 } }, select: { date: true }, orderBy: { date: 'desc' }, ...take(800) }),
    prisma.userActiveDay.count({ where: { userId: id } }),
    prisma.userActiveDay.findFirst({ where: { userId: id }, orderBy: { date: 'asc' }, select: { date: true } }),
    prisma.userActiveDay.findFirst({ where: { userId: id }, orderBy: { date: 'desc' }, select: { date: true } }),
    prisma.favorite.count({ where: { userId: id } }),
    prisma.verseNote.count({ where: { userId: id } }),
    prisma.verseHighlight.count({ where: { userId: id } }),
    prisma.reelView.count({ where: { userId: id } }),
    prisma.reelLike.count({ where: { userId: id } }),
    prisma.reelComment.count({ where: { userId: id } }),
    prisma.reelShare.count({ where: { userId: id } }),
    prisma.chatConversation.count({ where: { userId: id } }),
    prisma.chatMessage.count({ where: { conversation: { userId: id }, role: 'USER' } }),
    prisma.notification.count({ where: { userId: id } }),
    prisma.notification.count({ where: { userId: id, readAt: null } }),
    prisma.device.findMany({ where: { userId: id }, select: { platform: true, appVersion: true, lastSeenAt: true, fcmToken: true }, orderBy: { lastSeenAt: 'desc' } }),
    prisma.referral.groupBy({ by: ['status'], where: { referrerId: id }, _count: { _all: true } }),
    prisma.referral.findUnique({ where: { refereeId: id }, select: { status: true, attributedAt: true, referrer: { select: { id: true, name: true, email: true } } } }),
    entitlement.compute(id),
    prisma.routineTask.count({ where: { userId: id } }),
  ]);

  const mantraTop = await prisma.chantSession.groupBy({
    by: ['mantraId'], where: { userId: id, mantraId: { not: null } }, _sum: { rounds: true }, orderBy: { _sum: { rounds: 'desc' } }, ...take(1),
  });
  const favouriteMantra = mantraTop[0]
    ? { ...(await prisma.mantra.findUnique({ where: { id: mantraTop[0].mantraId }, select: { id: true, name: true } })), rounds: mantraTop[0]._sum.rounds ?? 0 }
    : null;

  const dateStrings = chantDays.map((d) => d.date.toISOString().slice(0, 10));
  return ok(res, {
    user,
    entitlement: { plan: ent.plan?.name ?? null, slug: ent.plan?.slug ?? null, reason: ent.reason, until: ent.premiumUntil },
    sadhanaProfile,
    chanting: {
      rounds: chantTotals._sum.rounds ?? 0,
      sittings: chantTotals._count._all,
      minutes: Math.round((chantTotals._sum.durationSeconds ?? 0) / 60),
      daysChanted: chantDays.length,
      ...streaks(dateStrings),
      favouriteMantra,
    },
    activity: {
      activeDays,
      firstActive: firstActive?.date ?? null,
      lastActive: lastActive?.date ?? null,
    },
    engagement: {
      favorites, notes, highlights, routineTasks,
      reels: { views: reelViews, likes: reelLikes, comments: reelComments, shares: reelShares },
      sakha: { conversations, messages },
      notifications: { total: notifications, unread },
    },
    devices,
    referrals: {
      made: Object.fromEntries(referralMade.map((r) => [r.status, r._count._all])),
      referredBy,
    },
  });
};

/** GET /api/admin/users/:id/chanting — per-mantra totals and the sittings themselves, newest first. */
export const chanting = async (req, res) => {
  const { id } = req.valid.params;
  await requireUser(id);
  const page = req.valid.query.page ?? 1;
  const pageSize = req.valid.query.pageSize ?? 25;

  const [byMantra, sessions, total] = await Promise.all([
    prisma.chantSession.groupBy({
      by: ['mantraId'], where: { userId: id },
      _sum: { rounds: true, beads: true, durationSeconds: true }, _count: { _all: true }, _max: { startedAt: true },
      orderBy: { _sum: { rounds: 'desc' } },
    }),
    prisma.chantSession.findMany({
      where: { userId: id }, orderBy: { startedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
      select: {
        id: true, rounds: true, beads: true, source: true, startedAt: true, endedAt: true, durationSeconds: true,
        mantra: { select: { id: true, name: true } }, day: { select: { date: true } },
      },
    }),
    prisma.chantSession.count({ where: { userId: id } }),
  ]);
  const mantras = await prisma.mantra.findMany({ where: { id: { in: byMantra.map((m) => m.mantraId).filter(Boolean) } }, select: { id: true, name: true, category: true } });
  const nameOf = new Map(mantras.map((m) => [m.id, m]));

  return ok(res, {
    mantras: byMantra.map((m) => ({
      mantraId: m.mantraId,
      name: m.mantraId ? nameOf.get(m.mantraId)?.name ?? 'Deleted mantra' : 'Plain counter (no mantra)',
      category: m.mantraId ? nameOf.get(m.mantraId)?.category ?? null : null,
      rounds: m._sum.rounds ?? 0,
      sittings: m._count._all,
      minutes: Math.round((m._sum.durationSeconds ?? 0) / 60),
      lastChantedAt: m._max.startedAt,
    })),
    sessions: sessions.map((s) => ({ ...s, date: s.day.date, day: undefined })),
    page, pageSize, total,
  });
};

/** GET /api/admin/users/:id/daily?days=90 — one row per day: rounds against target, tasks, notes, chanting, active or not. */
export const daily = async (req, res) => {
  const { id } = req.valid.params;
  await requireUser(id);
  const days = Math.min(req.valid.query.days ?? 90, 365);
  const from = toDateColumn(shiftDays(localDateString('Asia/Kolkata'), -(days - 1)));

  const [sadhana, active, sessions] = await Promise.all([
    prisma.sadhanaDay.findMany({ where: { userId: id, date: { gte: from } }, orderBy: { date: 'desc' }, select: { date: true, roundTarget: true, roundsCompleted: true, tasksTotal: true, tasksDone: true, note: true } }),
    prisma.userActiveDay.findMany({ where: { userId: id, date: { gte: from } }, select: { date: true, platform: true } }),
    prisma.chantSession.groupBy({ by: ['sadhanaDayId'], where: { userId: id, day: { date: { gte: from } } }, _count: { _all: true }, _sum: { durationSeconds: true } }),
  ]);
  const sessionDays = await prisma.sadhanaDay.findMany({ where: { id: { in: sessions.map((s) => s.sadhanaDayId) } }, select: { id: true, date: true } });
  const dateOfDay = new Map(sessionDays.map((d) => [d.id, d.date.toISOString().slice(0, 10)]));
  const sessionsByDate = new Map(sessions.map((s) => [dateOfDay.get(s.sadhanaDayId), { sittings: s._count._all, minutes: Math.round((s._sum.durationSeconds ?? 0) / 60) }]));
  const activeByDate = new Map(active.map((a) => [a.date.toISOString().slice(0, 10), a.platform]));

  const rows = new Map();
  for (const d of sadhana) {
    const key = d.date.toISOString().slice(0, 10);
    rows.set(key, { ...d, date: key, ...(sessionsByDate.get(key) ?? { sittings: 0, minutes: 0 }), active: activeByDate.has(key), platform: activeByDate.get(key) ?? null });
  }
  for (const [key, platform] of activeByDate) {
    if (!rows.has(key)) rows.set(key, { date: key, roundTarget: 0, roundsCompleted: 0, tasksTotal: 0, tasksDone: 0, note: null, sittings: 0, minutes: 0, active: true, platform });
  }
  const list = [...rows.values()].sort((a, b) => b.date.localeCompare(a.date));
  return ok(res, {
    days,
    rows: list,
    totals: {
      activeDays: active.length,
      rounds: sadhana.reduce((n, d) => n + d.roundsCompleted, 0),
      targetMetDays: sadhana.filter((d) => d.roundTarget > 0 && d.roundsCompleted >= d.roundTarget).length,
    },
  });
};

/** GET /api/admin/users/:id/engagement — reading, saved things, notes, reels, Sakha, notifications. */
export const engagement = async (req, res) => {
  const { id } = req.valid.params;
  await requireUser(id);

  const [progress, favoriteKinds, favoriteRecent, notes, views, conversations, notifications] = await Promise.all([
    prisma.readingProgress.findMany({
      where: { userId: id }, orderBy: { lastReadAt: 'desc' },
      select: { cantoNumber: true, chapterNumber: true, verseNumber: true, versesRead: true, lastReadAt: true, book: { select: { slug: true, title: true } } },
    }),
    prisma.favorite.groupBy({ by: ['verseId', 'mantraId', 'bookId', 'reelId'], where: { userId: id }, _count: { _all: true } }),
    prisma.favorite.findMany({
      where: { userId: id }, orderBy: { createdAt: 'desc' }, ...take(15),
      select: { createdAt: true, verse: { select: { verseId: true } }, mantra: { select: { name: true } }, book: { select: { title: true } }, reel: { select: { id: true, caption: true } } },
    }),
    prisma.verseNote.findMany({ where: { userId: id }, orderBy: { updatedAt: 'desc' }, ...take(15), select: { id: true, text: true, updatedAt: true, verse: { select: { verseId: true } } } }),
    prisma.reelView.findMany({
      where: { userId: id }, orderBy: { lastViewedAt: 'desc' }, ...take(20),
      select: { watchCount: true, completed: true, lastViewedAt: true, reel: { select: { id: true, caption: true, creator: { select: { displayName: true } } } } },
    }),
    prisma.chatConversation.findMany({ where: { userId: id }, orderBy: { lastMessageAt: 'desc' }, ...take(5), select: { id: true, title: true, messageCount: true, tokensUsed: true, lastMessageAt: true, createdAt: true } }),
    prisma.notification.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, ...take(20), select: { id: true, type: true, title: true, sentAt: true, readAt: true, createdAt: true } }),
  ]);

  const saved = { verses: 0, mantras: 0, books: 0, reels: 0 };
  for (const f of favoriteKinds) {
    if (f.verseId) saved.verses += f._count._all;
    else if (f.mantraId) saved.mantras += f._count._all;
    else if (f.bookId) saved.books += f._count._all;
    else if (f.reelId) saved.reels += f._count._all;
  }
  return ok(res, {
    reading: progress,
    saved,
    recentSaved: favoriteRecent.map((f) => ({
      at: f.createdAt,
      label: f.verse?.verseId ? `Verse ${f.verse.verseId}` : f.mantra?.name ?? f.book?.title ?? (f.reel ? `Reel: ${f.reel.caption ?? f.reel.id}` : 'Item'),
    })),
    notes: notes.map((n) => ({ ...n, text: n.text.slice(0, 300) })),
    reelViews: views,
    sakha: conversations, // counts and titles only — what a person said to Sakha is not shown here
    notifications,
  });
};

/** GET /api/admin/users/:id/billing — plan, subscriptions, payments, the Sakha wallet and its ledger, referral grants. */
export const billing = async (req, res) => {
  const { id } = req.valid.params;
  await requireUser(id);

  const [ent, subscriptions, payments, wallet, ledger, usage, grants] = await Promise.all([
    entitlement.compute(id),
    prisma.subscription.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, include: { plan: { select: { name: true, slug: true } } } }),
    prisma.payment.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, ...take(30), select: { id: true, provider: true, purpose: true, status: true, amountMinor: true, currency: true, paidAt: true, refundedAt: true, createdAt: true } }),
    prisma.aiWallet.findUnique({ where: { userId: id }, select: { balance: true, allocation: true, periodStart: true, periodEnd: true } }),
    prisma.aiWalletTransaction.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, ...take(30), select: { id: true, type: true, tokens: true, source: true, note: true, balanceAfter: true, createdAt: true } }),
    prisma.aiDailyUsage.findMany({ where: { userId: id }, orderBy: { date: 'desc' }, ...take(30) }),
    prisma.entitlementGrant.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, include: { plan: { select: { name: true } } } }),
  ]);
  return ok(res, {
    entitlement: { plan: ent.plan?.name ?? null, reason: ent.reason, until: ent.premiumUntil },
    subscriptions: subscriptions.map((s) => ({ id: s.id, plan: s.plan.name, provider: s.provider, status: s.status, startedAt: s.startedAt, currentPeriodEnd: s.currentPeriodEnd, autoRenew: s.autoRenew })),
    payments,
    wallet,
    ledger,
    dailyUsage: usage,
    grants: grants.map((g) => ({ id: g.id, plan: g.plan.name, source: g.source, note: g.note, startsAt: g.startsAt, endsAt: g.endsAt, revokedAt: g.revokedAt })),
  });
};
