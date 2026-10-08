// Which tradition someone's chanting says they follow.
//
// `User.sampradaya` is a cache, the same way `User.isPremium` is (see
// entitlement.js). The person never chooses it and nobody edits it by hand:
// this module owns it, and rebuilding it from ChantSession gives the same
// answer every time.
//
// The rule, in full:
//
//   - A day counts for a tradition when the person chanted one of its mantras
//     on it — a mantra whose `sampradaya` names it, with a bead or a round
//     actually counted. Opening the counter and leaving does not count. Neither
//     does a sitting with no mantra attached: the counter opens on the
//     mahamantra with nothing chosen, which says nothing about their path.
//   - A tradition is *held* once it has SAMPRADAYA_MIN_DAYS separate days. They
//     need not be in a row, and several sittings on one day are still one day.
//   - When more than one is held, the one whose latest days are the more recent
//     wins. That is the whole of "it can change at any time": a Shaiva who
//     chants Vishnu's mantras on three days becomes Vaishnav, and three days of
//     Shiva's mantras afterwards makes them Shaiva again. The older habit is not
//     weighed against the newer one.
//   - A dead heat changes nothing — whoever they already were, if that is one
//     of the tied, otherwise nobody yet.
//
// The tradition is whatever string `Mantra.sampradaya` carries, so a Shakta or
// Smarta mantra works with no change here.

import { prisma } from '../config/database.js';
import logger from '../config/logger.js';
import { SAMPRADAYA_MIN_DAYS } from '../config/constants.js';

/**
 * Each tradition's most recent chanting days, newest first, at most
 * SAMPRADAYA_MIN_DAYS of them — all `decide` needs, so a user with years of
 * history costs the same as one with a week. Days are the user's own local
 * dates (SadhanaDay.date), as 'YYYY-MM-DD'.
 */
async function recentDays(userId) {
  const rows = await prisma.$queryRaw`
    SELECT "sampradaya", to_char("date", 'YYYY-MM-DD') AS "day"
    FROM (
      SELECT "sampradaya", "date",
             ROW_NUMBER() OVER (PARTITION BY "sampradaya" ORDER BY "date" DESC) AS "rank"
      FROM (
        SELECT DISTINCT m."sampradaya" AS "sampradaya", d."date" AS "date"
        FROM "ChantSession" s
        JOIN "Mantra" m ON m."id" = s."mantraId"
        JOIN "SadhanaDay" d ON d."id" = s."sadhanaDayId"
        WHERE s."userId" = ${userId} AND (s."rounds" > 0 OR s."beads" > 0)
      ) AS chanted
    ) AS ranked
    WHERE "rank" <= ${SAMPRADAYA_MIN_DAYS}
    ORDER BY "sampradaya", "day" DESC
  `;

  const byTradition = new Map();
  for (const { sampradaya, day } of rows) {
    if (!byTradition.has(sampradaya)) byTradition.set(sampradaya, []);
    byTradition.get(sampradaya).push(day);
  }
  return byTradition;
}

/**
 * The tradition those days point to, or null. Pure: `byTradition` is what
 * `recentDays` returns and `current` is what the person is stored as now, which
 * only matters for a dead heat.
 */
function decide(byTradition, current = null) {
  // Held traditions, each with the date from which it has had enough days. A
  // later date means its latest run of days began more recently.
  const held = [];
  for (const [sampradaya, days] of byTradition) {
    if (days.length >= SAMPRADAYA_MIN_DAYS) {
      held.push({ sampradaya, since: days[SAMPRADAYA_MIN_DAYS - 1] });
    }
  }
  if (!held.length) return null;

  const latest = held.reduce((best, entry) => (entry.since > best ? entry.since : best), '');
  const leaders = held.filter((entry) => entry.since === latest);
  if (leaders.length === 1) return leaders[0].sampradaya;

  return leaders.some((entry) => entry.sampradaya === current) ? current : null;
}

/**
 * Works the person's tradition out from their chanting and stores it if it
 * changed. Call it when a day first gets chanting on a mantra — there is
 * nothing new to learn from more beads on a day already counted.
 *
 * Returns the tradition, which is null while none has enough days.
 */
async function refresh(userId) {
  const [user, byTradition] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { sampradaya: true } }),
    recentDays(userId),
  ]);
  if (!user) return null;

  const sampradaya = decide(byTradition, user.sampradaya);
  if (sampradaya === user.sampradaya) return sampradaya;

  await prisma.user.update({ where: { id: userId }, data: { sampradaya } });
  logger.info({ userId, from: user.sampradaya, to: sampradaya }, 'sampradaya changed');
  return sampradaya;
}

export { recentDays, decide, refresh };
