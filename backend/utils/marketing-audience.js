// Who a campaign is for, among the people who have an account: a saved filter (MarketingSegment.filter) turned into a
// Prisma `where`. Pure — the one filter that needs a computed list (a streak) is handed in already computed — so
// `npm test` covers it. services/marketing-audience.js runs it.
//
// Every filter is optional and they add up (all must hold). Always left out, whatever the filter: a banned account, a
// stand-in address from the old app, a reader who has switched marketing off. Suppression and the weekly cap are checked
// when the audience is written (a hash and a count per reader), not here.

import { z } from 'zod';

import { PLACEHOLDER_DOMAIN } from './legacy.js';

const codes = (max = 50) => z.array(z.string().trim().min(1).max(100)).max(max);
const days = z.number().int().min(0).max(3650);

export const FILTER_SCHEMA = z
  .object({
    readingLanguages: codes(12).optional(),
    appLanguages: codes(12).optional(),
    countries: codes().optional(), // ISO 3166-1 alpha-2, e.g. "IN"
    states: codes().optional(),
    plans: codes().optional(), // plan slugs held now, by subscription or grant
    donors: z.boolean().optional(), // true: has donated; false: has not
    premium: z.boolean().optional(),
    joinedWithinDays: days.optional(),
    joinedBeforeDays: days.optional(),
    activeWithinDays: days.optional(),
    lapsedDays: days.optional(), // last seen more than this many days ago
    chantedWithinDays: days.optional(),
    neverChanted: z.boolean().optional(),
    minStreak: z.number().int().min(1).max(400).optional(),
    mantraIds: codes().optional(), // chanted it in the last 60 days, or it is their favourite
    bookSlugs: codes(20).optional(), // has read in the book
    platforms: z.array(z.enum(['android', 'ios', 'web'])).max(3).optional(),
  })
  .strict();

/** → `{ ok, filter }` or `{ ok: false, errors }`. An empty object means every reader. */
export function parseFilter(raw) {
  const parsed = FILTER_SCHEMA.safeParse(raw ?? {});
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.') || 'filter'}: ${i.message}`) };
  const f = parsed.data;
  const errors = [];
  if (f.activeWithinDays !== undefined && f.lapsedDays !== undefined) errors.push('Choose either “active within” or “lapsed for”, not both.');
  if (f.chantedWithinDays !== undefined && f.neverChanted) errors.push('“Chanted within” and “never chanted” cannot both hold.');
  if (f.joinedWithinDays !== undefined && f.joinedBeforeDays !== undefined && f.joinedWithinDays >= f.joinedBeforeDays) errors.push('“Joined within” must be fewer days than “joined before”.');
  return errors.length ? { ok: false, errors } : { ok: true, filter: f };
}

const daysAgo = (now, n) => new Date(now.getTime() - n * 86_400_000);
const MANTRA_WINDOW_DAYS = 60;

/**
 * The Prisma `where` on User for a filter and a channel.
 * `streakIds`: the user ids that satisfy `minStreak` (the caller computes them); required when the filter has one.
 */
export function buildWhere(filter = {}, { channel = 'EMAIL', now = new Date(), streakIds = null } = {}) {
  const and = [{ isBanned: false }];

  if (channel === 'EMAIL') {
    and.push({ NOT: { email: { endsWith: `@${PLACEHOLDER_DOMAIN}`, mode: 'insensitive' } } });
    and.push({ OR: [{ marketingPreference: null }, { marketingPreference: { emailEnabled: true } }] });
  } else {
    and.push({
      marketingPreference: { is: { whatsappVerifiedAt: { not: null }, whatsappOptOutAt: null, whatsappPhone: { not: null } } },
    });
  }

  const f = filter || {};
  if (f.readingLanguages?.length) and.push({ readingLanguage: { in: f.readingLanguages } });
  if (f.appLanguages?.length) and.push({ appLanguage: { in: f.appLanguages } });
  if (f.countries?.length) and.push({ countryCode: { in: f.countries.map((c) => c.toUpperCase()) } });
  if (f.states?.length) and.push({ state: { in: f.states, mode: 'insensitive' } });

  if (f.plans?.length) {
    and.push({
      OR: [
        { subscriptions: { some: { status: { in: ['IN_TRIAL', 'ACTIVE', 'GRACE', 'CANCELLED'] }, currentPeriodEnd: { gt: now }, plan: { slug: { in: f.plans } } } } },
        { entitlementGrants: { some: { revokedAt: null, startsAt: { lte: now }, endsAt: { gt: now }, plan: { slug: { in: f.plans } } } } },
        // The free plan is nobody's row: a reader on it holds nothing paid.
        ...(f.plans.includes('free') ? [{ isPremium: false }] : []),
      ],
    });
  }
  if (f.donors === true) and.push({ payments: { some: { purpose: 'DONATION', status: 'SUCCEEDED' } } });
  if (f.donors === false) and.push({ payments: { none: { purpose: 'DONATION', status: 'SUCCEEDED' } } });
  if (f.premium !== undefined) and.push({ isPremium: f.premium });

  if (f.joinedWithinDays !== undefined) and.push({ createdAt: { gte: daysAgo(now, f.joinedWithinDays) } });
  if (f.joinedBeforeDays !== undefined) and.push({ createdAt: { lt: daysAgo(now, f.joinedBeforeDays) } });
  if (f.activeWithinDays !== undefined) and.push({ lastActiveAt: { gte: daysAgo(now, f.activeWithinDays) } });
  if (f.lapsedDays !== undefined) and.push({ lastActiveAt: { lt: daysAgo(now, f.lapsedDays) } });

  if (f.chantedWithinDays !== undefined) and.push({ sadhanaDays: { some: { roundsCompleted: { gt: 0 }, date: { gte: daysAgo(now, f.chantedWithinDays) } } } });
  if (f.neverChanted) and.push({ sadhanaDays: { none: { roundsCompleted: { gt: 0 } } } });
  if (f.minStreak !== undefined) and.push({ id: { in: streakIds ?? [] } });

  if (f.mantraIds?.length) {
    and.push({
      OR: [
        { chantSessions: { some: { mantraId: { in: f.mantraIds }, startedAt: { gte: daysAgo(now, MANTRA_WINDOW_DAYS) } } } },
        { sadhanaProfile: { is: { preferredMantraId: { in: f.mantraIds } } } },
      ],
    });
  }
  if (f.bookSlugs?.length) and.push({ readingProgress: { some: { book: { slug: { in: f.bookSlugs } } } } });
  if (f.platforms?.length) and.push({ devices: { some: { platform: { in: f.platforms }, app: 'main' } } });

  return { AND: and };
}

/** A short description of a filter, for a campaign's review page and the audit trail. */
export function describeFilter(filter = {}) {
  const f = filter || {};
  const parts = [];
  const list = (label, values) => values?.length && parts.push(`${label}: ${values.join(', ')}`);
  list('reads in', f.readingLanguages);
  list('app in', f.appLanguages);
  list('country', f.countries);
  list('state', f.states);
  list('plan', f.plans);
  if (f.donors !== undefined) parts.push(f.donors ? 'donors' : 'not donors');
  if (f.premium !== undefined) parts.push(f.premium ? 'premium' : 'not premium');
  if (f.joinedWithinDays !== undefined) parts.push(`joined in the last ${f.joinedWithinDays} days`);
  if (f.joinedBeforeDays !== undefined) parts.push(`joined over ${f.joinedBeforeDays} days ago`);
  if (f.activeWithinDays !== undefined) parts.push(`active in the last ${f.activeWithinDays} days`);
  if (f.lapsedDays !== undefined) parts.push(`not seen for ${f.lapsedDays} days`);
  if (f.chantedWithinDays !== undefined) parts.push(`chanted in the last ${f.chantedWithinDays} days`);
  if (f.neverChanted) parts.push('never chanted');
  if (f.minStreak !== undefined) parts.push(`${f.minStreak}+ day streak`);
  if (f.mantraIds?.length) parts.push(`${f.mantraIds.length} chosen mantra(s)`);
  list('read in', f.bookSlugs);
  list('on', f.platforms);
  return parts.length ? parts.join('; ') : 'every reader';
}
