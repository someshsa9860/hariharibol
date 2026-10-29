// Who a campaign reaches: counts and samples for the audience builder, and the paged walk the worker uses to write the
// audience into MarketingDelivery rows when a campaign starts. The rules of a filter are pure (utils/marketing-audience.js);
// this file runs them.
//
// A campaign's audience is `{ users: <filter> | null, lists: [listId, …] }`: readers who match the filter, and invitees on
// the lists. `users: null` means no readers; `{}` means every reader.

import { prisma } from '../config/database.js';
import { marketing } from '../config/marketing.js';
import { buildWhere, parseFilter } from '../utils/marketing-audience.js';
import { emailKey } from '../utils/marketing-address.js';

/** Users who chanted every day up to yesterday or today for at least `n` days: the streak filter, computed in the database. */
export async function streakUserIds(n) {
  const rows = await prisma.$queryRaw`
    WITH d AS (
      SELECT "userId", "date", "date" - (ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "date"))::int AS grp
      FROM "SadhanaDay"
      WHERE "roundsCompleted" > 0 AND "date" >= CURRENT_DATE - 420
    )
    SELECT DISTINCT "userId" AS id
    FROM (SELECT "userId", grp, COUNT(*) AS n, MAX("date") AS last FROM d GROUP BY "userId", grp) t
    WHERE n >= ${n} AND last >= CURRENT_DATE - 1`;
  return rows.map((r) => r.id);
}

/** The Prisma where for readers (async because a streak filter needs a computed list). Throws on a bad filter. */
export async function userWhere(rawFilter, channel = 'EMAIL', now = new Date()) {
  const parsed = parseFilter(rawFilter);
  if (!parsed.ok) throw Object.assign(new Error(parsed.errors.join(' ')), { filterErrors: parsed.errors });
  const streakIds = parsed.filter.minStreak ? await streakUserIds(parsed.filter.minStreak) : null;
  return buildWhere(parsed.filter, { channel, now, streakIds });
}

export async function countUsers(filter, channel = 'EMAIL') {
  return prisma.user.count({ where: await userWhere(filter, channel) });
}

/** A few readers who match, for the builder's "does this look right" list. */
export async function sampleUsers(filter, channel = 'EMAIL', take = 8) {
  const rows = await prisma.user.findMany({
    where: await userWhere(filter, channel),
    orderBy: { lastActiveAt: 'desc' },
    take,
    select: { id: true, name: true, email: true, readingLanguage: true, countryCode: true, lastActiveAt: true },
  });
  return rows;
}

/* ---------- invitees ---------- */

const contactWhere = (listIds, channel) => ({
  lists: { some: { listId: { in: listIds } } },
  ...(channel === 'WHATSAPP' ? { phone: { not: null }, whatsappOptInAt: { not: null } } : { emailKey: { not: null } }),
});

export async function countContacts(listIds, channel = 'EMAIL') {
  if (!listIds?.length) return 0;
  return prisma.marketingContact.count({ where: contactWhere(listIds, channel) });
}

/** The size of a whole audience, before suppression and the weekly cap (those are applied when it is written). */
export async function countAudience(audience, channel = 'EMAIL') {
  const [users, contacts] = await Promise.all([
    audience?.users ? countUsers(audience.users, channel) : 0,
    countContacts(audience?.lists, channel),
  ]);
  return { users, contacts, total: users + contacts };
}

/* ---------- writing the audience (the worker) ---------- */

/**
 * Calls `handler(page)` with pages of readers and then pages of invitees: `{ kind: 'user'|'contact', rows }`, each row with
 * what the handler needs. Cursor paging on id, so a long audience is never loaded at once.
 */
export async function walkAudience(audience, channel, handler, { pageSize = marketing.materialisePageSize } = {}) {
  if (audience?.users) {
    const where = await userWhere(audience.users, channel);
    let cursor = null;
    for (;;) {
      const rows = await prisma.user.findMany({
        where,
        orderBy: { id: 'asc' },
        take: pageSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true, email: true, name: true, readingLanguage: true, appLanguage: true, timezone: true, isPremium: true,
          marketingPreference: { select: { whatsappPhone: true } },
        },
      });
      if (rows.length === 0) break;
      cursor = rows[rows.length - 1].id;
      await handler({ kind: 'user', rows });
    }
  }
  if (audience?.lists?.length) {
    const where = contactWhere(audience.lists, channel);
    let cursor = null;
    for (;;) {
      const rows = await prisma.marketingContact.findMany({
        where,
        orderBy: { id: 'asc' },
        take: pageSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, email: true, emailKey: true, phone: true, name: true, language: true },
      });
      if (rows.length === 0) break;
      cursor = rows[rows.length - 1].id;
      await handler({ kind: 'contact', rows });
    }
  }
}

/** Contacts whose address now belongs to an account: a page of them is checked in one query. → Set of emailKeys. */
export async function keysOfReaders(emails) {
  const lower = emails.filter(Boolean).map((e) => e.toLowerCase());
  if (lower.length === 0) return new Set();
  const users = await prisma.user.findMany({ where: { email: { in: lower, mode: 'insensitive' } }, select: { email: true } });
  return new Set(users.map((u) => emailKey(u.email)));
}
