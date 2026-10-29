// The dashboard.
//
// One endpoint that assembles what the first screen shows, rather than six
// calls the app has to fire on launch and then wait on together. Launch is the
// moment where round trips are most expensive — the user is staring at a
// spinner — and every query here is indexed and small.
//
// It is public. A signed-out visitor gets the sloka of the day and the books;
// the personal sections simply come back empty rather than as an error.

import { prisma } from '../../config/database.js';
import * as present from '../../utils/present.js';
import * as language from '../../utils/language.js';
import * as s3 from '../../services/s3.js';
import * as sadhana from './sadhana.js';
import * as slokaController from './sloka.js';
import { ok } from '../../utils/respond.js';
import { localDateString, toDateColumn, shiftDays } from '../../utils/date.js';
import { rankIssues, rotate, dayNumber, topBand } from '../../utils/home-issues.js';
import { ISSUE_LOOKBACK_DAYS, ISSUE_VERSES_MAX_ISSUES, ISSUE_VERSES_PER_ISSUE } from '../../config/home.js';

export const home = async (req, res) => {
  const user = req.auth.user;
  const timezone = user?.timezone || 'Asia/Kolkata';
  const date = localDateString(timezone);
  // The languages the call names win over the account's saved ones: the phone
  // changes its own reading language at once and tells the account a moment later,
  // so without this the first screen ran one change behind.
  const reader = language.withReadingLanguages(user, language.fromQuery(req.valid.query.languages));
  const readingChain = language.readingChain(reader);

  const [dailySloka, books, mantras, personal] = await Promise.all([
    prisma.dailySloka.findFirst({
      where: { date: toDateColumn(date), isPublished: true },
      include: { verse: { include: present.includes.verse(readingChain) } },
    }),

    prisma.book.findMany({
      where: { isPublished: true },
      orderBy: [{ displayOrder: 'asc' }, { bookNumber: 'asc' }],
      take: 8,
    }),

    prisma.mantra.findMany({
      where: { isPublished: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      take: 6,
      include: present.includes.mantra(language.mantraTextChain(reader), readingChain),
    }),

    user ? loadPersonal(user, reader, date, readingChain) : Promise.resolve(null),
  ]);

  return ok(res, {
    date,
    slokaOfTheDay: dailySloka
      ? {
          imageUrl: dailySloka.imagePath ? await s3.presignGet(dailySloka.imagePath) : null,
          verse: await present.verse(dailySloka.verse, reader),
        }
      : null,
    books: await present.books(books, reader),
    mantras: await present.mantras(mantras, reader),
    ...(personal || {}),
  });
};

/**
 * GET /api/app/home/issue-verses
 *
 * Verses for the vikaras this reader has reported lately, for the Home row "For what you are working on". Empty when
 * nothing was reported in the lookback, so the app draws nothing. No AI call and no wallet charge: the verses come from
 * the same mapping the sloka picks from, and the choice inside each issue's top band is fixed for the day.
 */
export const issueVerses = async (req, res) => {
  const user = req.auth.user;
  const date = localDateString(user.timezone);
  const reader = language.withReadingLanguages(user, language.fromQuery(req.valid.query.languages));
  const readingChain = language.readingChain(reader);
  const since = toDateColumn(shiftDays(date, -ISSUE_LOOKBACK_DAYS));

  const counts = await prisma.userIssue.groupBy({
    by: ['issueId'],
    where: { userId: user.id, date: { gte: since }, issue: { category: 'VIKARA', isPublished: true } },
    _count: { _all: true },
    _max: { reportedAt: true },
  });
  const ranked = rankIssues(
    counts.map((row) => ({ issueId: row.issueId, count: row._count._all, lastAt: row._max.reportedAt })),
    ISSUE_VERSES_MAX_ISSUES
  );
  if (!ranked.length) return ok(res, { items: [] });

  const issues = await prisma.issue.findMany({
    where: { id: { in: ranked.map((row) => row.issueId) } },
    select: { id: true, slug: true, name: true, nameI18n: true, category: true },
  });
  const exclude = await slokaController.recentVerseIds(user.id);

  const candidates = await Promise.all(
    ranked.map((row) => slokaController.topVersesForIssue(row.issueId, exclude))
  );

  // Pairs of (issue, verse id) in the order the row shows them. A verse already shown under an earlier issue is skipped.
  const day = dayNumber(date);
  const shown = new Set();
  const picks = [];
  ranked.forEach((row, index) => {
    const issue = issues.find((candidate) => candidate.id === row.issueId);
    if (!issue || !candidates[index].length) return;
    const band = topBand(candidates[index]);
    rotate(band, day)
      .map((candidate) => candidate.verseId)
      .filter((verseId) => !shown.has(verseId))
      .slice(0, ISSUE_VERSES_PER_ISSUE)
      .forEach((verseId) => {
        shown.add(verseId);
        picks.push({ issue, verseId });
      });
  });
  if (!picks.length) return ok(res, { items: [] });

  const verses = await prisma.verse.findMany({
    where: { id: { in: picks.map((pick) => pick.verseId) } },
    include: present.includes.verse(readingChain),
  });
  const byId = new Map(verses.map((verse) => [verse.id, verse]));

  const items = [];
  for (const pick of picks) {
    const verse = byId.get(pick.verseId);
    if (!verse) continue;
    items.push({
      issue: slokaController.presentIssue(pick.issue, readingChain),
      verse: await present.verse(verse, reader),
    });
  }
  return ok(res, { items });
};

// The signed-in half. Kept separate so the public path does none of this work.
// `user` is the account (its rows, its timezone); `reader` is the same account
// reading in the languages the call named.
async function loadPersonal(user, reader, date, readingChain) {
  const [day, mySloka, issuesToday, continueReading, unread, streak] = await Promise.all([
    prisma.sadhanaDay.findUnique({
      where: { userId_date: { userId: user.id, date: toDateColumn(date) } },
      select: { roundTarget: true, roundsCompleted: true, tasksTotal: true, tasksDone: true },
    }),

    prisma.userDailySloka.findUnique({
      where: { userId_date: { userId: user.id, date: toDateColumn(date) } },
      include: {
        verse: { include: present.includes.verse(readingChain) },
        issue: { select: { slug: true, name: true, nameI18n: true } },
      },
    }),

    // Distinct issues reported today — not the full log, just enough for the
    // dashboard to grey out a vikara already answered rather than ask again.
    prisma.userIssue.findMany({
      where: { userId: user.id, date: toDateColumn(date) },
      select: { issue: { select: { slug: true } } },
    }),

    prisma.readingProgress.findFirst({
      where: { userId: user.id },
      orderBy: { lastReadAt: 'desc' },
      include: { book: true, verse: { select: { verseId: true } } },
    }),

    prisma.notification.count({ where: { userId: user.id, readAt: null } }),

    sadhana.currentStreak(user.id, user.timezone),
  ]);

  return {
    sadhana: {
      // Null rather than zeroes when the day has not been opened yet — the app
      // shows a "start your day" card, not a target of zero already met.
      today: day || null,
      streak,
    },
    mySloka: mySloka
      ? {
          id: mySloka.id,
          reason: slokaController.reasonFor(mySloka, readingChain),
          issue: slokaController.presentIssue(mySloka.issue, readingChain),
          seenAt: mySloka.seenAt,
          verse: await present.verse(mySloka.verse, reader),
        }
      : null,
    issuesReportedToday: [...new Set(issuesToday.map((row) => row.issue.slug))],
    continueReading: continueReading
      ? {
          book: await present.book(continueReading.book, reader),
          verseId: continueReading.verse?.verseId || null,
          cantoNumber: continueReading.cantoNumber,
          chapterNumber: continueReading.chapterNumber,
          verseNumber: continueReading.verseNumber,
        }
      : null,
    unreadNotifications: unread,
    isPremium: user.isPremium,
  };
}
