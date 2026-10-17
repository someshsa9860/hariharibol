// The sloka jobs — building tomorrow's picks, and delivering today's.
//
// Split in two on purpose. Building runs once, late at night UTC, and can take
// as long as it needs. Delivering runs every half hour and pushes only to the
// users whose own local delivery time (04:30 unless the setting says otherwise)
// has come round — one job that did both would either send
// everyone their sloka at 3am somewhere, or hold a connection open for a day.

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import * as notify from '../../services/notify.js';
import * as slokaCard from '../../services/sloka-card.js';
import * as settings from '../../services/setting.js';
import * as websocket from '../../services/websocket.js';
import * as slokaController from '../../controllers/app/sloka.js';
import * as language from '../../utils/language.js';
import { slokaPush } from '../../utils/sloka-push.js';
import { deliveryMinutes, isDeliveryDue } from '../../utils/sloka-delivery.js';
import { localDateString, localMinutes, toDateColumn, shiftDays } from '../../utils/date.js';
import { SETTING_KEYS } from '../../config/constants.js';
import { SLOKA_DELIVERY_STEP_MINUTES } from '../../config/cron.js';

const BATCH_SIZE = 500;

/**
 * Picks the global sloka for a date, if an editor has not already set one.
 * Editors win — this only fills the gaps.
 */
async function buildGlobal(date) {
  const existing = await prisma.dailySloka.findUnique({ where: { date: toDateColumn(date) } });
  if (existing) return existing;

  // Avoid anything used as the global sloka in the last 90 days, so the same
  // verse does not come round while people still remember it.
  const recent = await prisma.dailySloka.findMany({
    where: { date: { gte: toDateColumn(shiftDays(date, -90)) } },
    select: { verseId: true },
  });

  const verseId = await slokaController.pickAnyEligibleVerse(recent.map((row) => row.verseId));
  if (!verseId) {
    logger.error('no sloka-eligible verses — the global sloka cannot be built');
    return null;
  }

  const sloka = await prisma.dailySloka.create({
    data: { date: toDateColumn(date), verseId, source: 'RULE', isPublished: true },
  });

  logger.info({ date, verseId }, 'global sloka built');
  return sloka;
}

/**
 * Picks each user's personal sloka for their own next date.
 *
 * No AI runs here. The verse-to-issue weights in VerseIssue were written by the
 * batch pass ahead of time, so this is a weighted indexed query per user — the
 * cost of this job scales with the number of users in database time, not in
 * model calls.
 */
async function buildPersonal(job) {
  let cursor = null;
  let picked = 0;
  let skipped = 0;

  for (;;) {
    const users = await prisma.user.findMany({
      where: { isBanned: false },
      select: { id: true, timezone: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!users.length) break;
    cursor = users[users.length - 1].id;

    for (const user of users) {
      // Each user's *own* tomorrow. Someone in Toronto and someone in Mumbai are
      // not on the same date when this runs.
      const date = shiftDays(localDateString(user.timezone), 1);

      const already = await prisma.userDailySloka.findUnique({
        where: { userId_date: { userId: user.id, date: toDateColumn(date) } },
        select: { id: true },
      });
      if (already) {
        skipped += 1;
        continue;
      }

      const lastIssue = await prisma.userIssue.findFirst({
        where: { userId: user.id, reportedAt: { gte: new Date(Date.now() - 14 * 86400000) } },
        orderBy: { reportedAt: 'desc' },
        include: { issue: { select: { id: true, name: true } } },
      });

      const exclude = await slokaController.recentVerseIds(user.id);
      const verseId =
        (lastIssue ? await slokaController.pickVerseForIssue(lastIssue.issueId, exclude) : null) ||
        (await slokaController.pickAnyEligibleVerse(exclude)) ||
        // A repeat beats no sloka at all — see pickAnyEligibleVerse.
        (await slokaController.pickAnyEligibleVerse([]));

      if (!verseId) {
        skipped += 1;
        continue;
      }

      await prisma.userDailySloka.create({
        data: {
          userId: user.id,
          date: toDateColumn(date),
          verseId,
          source: 'RULE',
          issueId: lastIssue?.issueId || null,
          reason: lastIssue ? `Because you mentioned ${lastIssue.issue.name.toLowerCase()}` : null,
        },
      });
      picked += 1;
    }

    await job.updateProgress({ picked, skipped });
  }

  logger.info({ picked, skipped }, 'personal slokas built');
  return { picked, skipped };
}

/**
 * The verse a push shows: its text, where it lives in its book, and the
 * renderings in the languages this person reads.
 *
 * Read per push rather than with the pending rows — only the users whose hour
 * has come are sent anything, and which translations to fetch depends on who.
 */
function loadVerseForPush(verseRowId, user) {
  return prisma.verse.findUnique({
    where: { id: verseRowId },
    select: {
      verseId: true,
      sanskrit: true,
      transliteration: true,
      cantoNumber: true,
      chapterNumber: true,
      verseNumber: true,
      verseNumberEnd: true,
      book: { select: { slug: true, title: true, titleI18n: true } },
      translations: {
        where: { isPublished: true, languageCode: { in: language.readingChain(user) } },
        select: { languageCode: true, type: true, meaning: true },
      },
    },
  });
}

/**
 * Pushes the day's sloka to the users whose local delivery time has arrived.
 *
 * Runs every half hour (`SLOKA_DELIVERY_STEP_MINUTES`). The time is one setting
 * for everyone, not learned per reader: the point is a sloka waiting at the start
 * of the day, and a time worked out from when people open it would drift toward
 * whenever they happen to wake. `notifiedAt` is what stops a second run in the
 * same window from sending twice — the state on the row, not the schedule, is
 * what makes this safe to retry.
 */
async function deliver() {
  const targetMinutes = deliveryMinutes(await settings.get(SETTING_KEYS.SLOKA_DELIVERY_TIME));
  const now = new Date();

  // A reader east of UTC is already on tomorrow's date for the first hours of
  // their day (Kolkata until 05:30, so 04:30 is one of them), and nobody is
  // more than a day ahead. Bounding at UTC's today would hide their row until
  // after the delivery window had passed; the per-row check below is what
  // keeps a stale one from going out.
  const latestLocalDate = toDateColumn(shiftDays(localDateString('UTC'), 1));

  let sent = 0;
  let cursor = null;

  for (;;) {
    const pending = await prisma.userDailySloka.findMany({
      where: { notifiedAt: null, date: { lte: latestLocalDate } },
      select: {
        id: true,
        userId: true,
        date: true,
        verseId: true,
        user: {
          select: {
            timezone: true,
            readingLanguage: true,
            appLanguage: true,
          },
        },
      },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!pending.length) break;
    cursor = pending[pending.length - 1].id;

    for (const row of pending) {
      const due = isDeliveryDue({
        localMinutes: localMinutes(row.user.timezone, now),
        targetMinutes,
        windowMinutes: SLOKA_DELIVERY_STEP_MINUTES,
      });
      if (!due) continue;

      // Only the day it is for — a row from an earlier date that was never
      // delivered is stale, and sending yesterday's sloka today is worse than
      // not sending it.
      if (row.date.toISOString().slice(0, 10) !== localDateString(row.user.timezone)) continue;

      // The verse itself is the notification. Why it was chosen stays in the
      // app (`reason` on the sloka), where there is room to say it.
      const verse = await loadVerseForPush(row.verseId, row.user);
      const { title, body, data } = slokaPush({ verse, user: row.user });

      // The picture is the same for everyone who is sent this verse, so it is
      // drawn the first time and found after that. No picture, still a push.
      const image = await slokaCard.cardUrl(verse);

      await notify.toUser(row.userId, { type: 'SLOKA', title, body, image, data });

      await prisma.userDailySloka.update({
        where: { id: row.id },
        data: { notifiedAt: new Date() },
      });

      websocket.toUser(row.userId, websocket.EVENTS.SLOKA_READY, { verseId: verse.verseId });
      sent += 1;
    }
  }

  // The global sloka is marked sent once, for the record.
  await prisma.dailySloka.updateMany({
    where: { date: toDateColumn(localDateString('Asia/Kolkata')), sentAt: null, isPublished: true },
    data: { sentAt: new Date() },
  });

  logger.info({ sent }, 'slokas delivered');
  return { sent };
}

export default async function slokaProcessor(job) {
  switch (job.name) {
    case 'sloka.build': {
      // Tomorrow in the timezone most users are in; per-user dates are worked
      // out individually inside buildPersonal.
      const date = shiftDays(localDateString('Asia/Kolkata'), 1);
      const global = await buildGlobal(date);
      const personal = await buildPersonal(job);
      return { global: global?.id || null, ...personal };
    }

    case 'sloka.deliver':
      return deliver();

    default:
      throw new Error(`Unknown sloka job: ${job.name}`);
  }
}

export { buildGlobal, deliver, loadVerseForPush };
