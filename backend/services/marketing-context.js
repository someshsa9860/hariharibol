// The small "context card" marketing writes each reader from: first name, favourite mantra, rounds a day, streak, days
// since last chanting, the book last read, verses read, plan. Built for a batch of readers in a handful of queries (never
// one query per reader), from sadhana and reading data only.
//
// What Sakha was told never comes here: SakhaProfile (traits and keywords) and chat text are not read, so nothing a reader
// said in confidence can reach a prompt or an email. The card is ~60 tokens, which is also what AI_PER_USER mode sends.

import { prisma } from '../config/database.js';
import { FAVOURITE_WINDOW_DAYS } from './sadhana-stats.js';
import { firstNameOf } from '../utils/chat-name.js';
import { localDateString, shiftDays } from '../utils/date.js';
import { readingChain, pickName, localised } from '../utils/language.js';
import { hariBol } from '../utils/messages.js';

const STREAK_WINDOW_DAYS = 60;
const ENTITLING = ['IN_TRIAL', 'ACTIVE', 'GRACE', 'CANCELLED'];

const group = (rows, key) => {
  const map = new Map();
  for (const row of rows) map.set(row[key], [...(map.get(row[key]) || []), row]);
  return map;
};

/**
 * Cards for `users` (each with id, name, readingLanguage, appLanguage, timezone, isPremium). → Map userId → card.
 * A value that is not known is an empty string, which a merge field's fallback then replaces.
 */
export async function cardsFor(users, now = new Date()) {
  if (users.length === 0) return new Map();
  const ids = users.map((u) => u.id);
  const since = new Date(now.getTime() - FAVOURITE_WINDOW_DAYS * 86_400_000);
  const dayFloor = new Date(now.getTime() - (STREAK_WINDOW_DAYS + 2) * 86_400_000);

  const [profiles, sessions, sadhana, days, reading, subs] = await Promise.all([
    prisma.userPreferenceProfile.findMany({ where: { userId: { in: ids } }, select: { userId: true, avgRoundsPerDay: true } }),
    prisma.chantSession.groupBy({
      by: ['userId', 'mantraId'],
      where: { userId: { in: ids }, mantraId: { not: null }, startedAt: { gte: since } },
      _sum: { rounds: true },
      _count: { _all: true },
    }),
    prisma.sadhanaProfile.findMany({ where: { userId: { in: ids } }, select: { userId: true, preferredMantraId: true, legacyFavoriteMantraId: true } }),
    prisma.sadhanaDay.findMany({
      where: { userId: { in: ids }, roundsCompleted: { gt: 0 }, date: { gte: dayFloor } },
      select: { userId: true, date: true },
    }),
    prisma.readingProgress.findMany({
      where: { userId: { in: ids } },
      orderBy: { lastReadAt: 'desc' },
      select: { userId: true, versesRead: true, book: { select: { title: true, titleI18n: true } } },
    }),
    prisma.subscription.findMany({
      where: { userId: { in: ids }, status: { in: ENTITLING }, currentPeriodEnd: { gt: now } },
      orderBy: { plan: { tier: 'desc' } },
      select: { userId: true, plan: { select: { name: true } } },
    }),
  ]);

  // The favourite: most rounds in 60 days (sessions break a tie), else the profile's preferred / carried-over mantra.
  const topByUser = new Map();
  for (const [userId, rows] of group(sessions, 'userId')) {
    const ranked = rows.sort((a, b) => (b._sum.rounds || 0) - (a._sum.rounds || 0) || b._count._all - a._count._all);
    topByUser.set(userId, ranked[0].mantraId);
  }
  const profileByUser = new Map(sadhana.map((s) => [s.userId, s]));
  const mantraIds = new Set();
  for (const user of users) {
    const id = topByUser.get(user.id) ?? profileByUser.get(user.id)?.preferredMantraId ?? profileByUser.get(user.id)?.legacyFavoriteMantraId;
    if (id) mantraIds.add(id);
  }
  const mantras = mantraIds.size
    ? await prisma.mantra.findMany({
        where: { id: { in: [...mantraIds] }, isPublished: true, mantraType: 'PUBLIC' },
        select: { id: true, name: true, translations: { where: { isPublished: true }, select: { languageCode: true, name: true } } },
      })
    : [];
  const mantraById = new Map(mantras.map((m) => [m.id, m]));

  const avgByUser = new Map(profiles.map((p) => [p.userId, p.avgRoundsPerDay]));
  const daysByUser = group(days, 'userId');
  const subByUser = new Map();
  for (const sub of subs) if (!subByUser.has(sub.userId)) subByUser.set(sub.userId, sub.plan.name);
  const readingByUser = group(reading, 'userId');

  const cards = new Map();
  for (const user of users) {
    const chain = readingChain(user);
    const firstName = firstNameOf(user.name) ?? '';
    const today = localDateString(user.timezone || 'Asia/Kolkata', now);

    const chanted = new Set((daysByUser.get(user.id) || []).map((d) => d.date.toISOString().slice(0, 10)));
    let streak = 0;
    let cursor = chanted.has(today) ? today : shiftDays(today, -1);
    while (chanted.has(cursor)) {
      streak += 1;
      cursor = shiftDays(cursor, -1);
    }
    const last = [...chanted].sort().pop();
    const daysSinceChant = last ? Math.max(0, Math.round((Date.parse(today) - Date.parse(last)) / 86_400_000)) : '';

    const mantra = mantraById.get(topByUser.get(user.id) ?? profileByUser.get(user.id)?.preferredMantraId ?? profileByUser.get(user.id)?.legacyFavoriteMantraId);
    const progress = readingByUser.get(user.id) || [];
    const avg = avgByUser.get(user.id);

    cards.set(user.id, {
      greeting: hariBol(firstName || null, chain),
      firstName,
      favoriteMantra: mantra ? pickName(mantra.translations, chain, mantra.name) : '',
      avgRounds: avg ? String(Math.round(avg)) : '',
      streak: streak ? String(streak) : '',
      daysSinceChant: daysSinceChant === '' ? '' : String(daysSinceChant),
      lastBook: progress[0] ? localised(progress[0].book, 'title', 'titleI18n', chain) : '',
      versesRead: progress.length ? String(progress.reduce((n, p) => n + p.versesRead, 0)) : '',
      plan: subByUser.get(user.id) ?? (user.isPremium ? 'Premium' : 'Free'),
    });
  }
  return cards;
}

/** The card as sent to a model (AI_PER_USER): empty values dropped, the greeting kept out (the model writes its own opening). */
export function promptCard(card) {
  const { greeting, ...rest } = card; // eslint-disable-line no-unused-vars
  return Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== ''));
}

/** The card a stranger gets: only the greeting ("Hari Bol") and the name they were listed with. */
export function strangerCard(contact) {
  const firstName = firstNameOf(contact.name) ?? '';
  return { greeting: hariBol(firstName || null, [contact.language || 'en', 'en']), firstName };
}
