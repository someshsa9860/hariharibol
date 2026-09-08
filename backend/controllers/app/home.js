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
import { ok } from '../../utils/respond.js';
import { localDateString, toDateColumn } from '../../utils/date.js';

export const home = async (req, res) => {
  const user = req.auth.user;
  const timezone = user?.timezone || 'Asia/Kolkata';
  const date = localDateString(timezone);
  const readingChain = language.readingChain(user);

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
      include: present.includes.mantra(language.mantraChain(user), readingChain),
    }),

    user ? loadPersonal(user, date, readingChain) : Promise.resolve(null),
  ]);

  return ok(res, {
    date,
    slokaOfTheDay: dailySloka
      ? {
          imageUrl: dailySloka.imagePath ? await s3.presignGet(dailySloka.imagePath) : null,
          verse: await present.verse(dailySloka.verse, user),
        }
      : null,
    books: await present.books(books, user),
    mantras: await present.mantras(mantras, user),
    ...(personal || {}),
  });
};

// The signed-in half. Kept separate so the public path does none of this work.
async function loadPersonal(user, date, readingChain) {
  const [day, mySloka, continueReading, unread, streak] = await Promise.all([
    prisma.sadhanaDay.findUnique({
      where: { userId_date: { userId: user.id, date: toDateColumn(date) } },
      select: { roundTarget: true, roundsCompleted: true, tasksTotal: true, tasksDone: true },
    }),

    prisma.userDailySloka.findUnique({
      where: { userId_date: { userId: user.id, date: toDateColumn(date) } },
      include: {
        verse: { include: present.includes.verse(readingChain) },
        issue: { select: { slug: true, name: true } },
      },
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
          reason: mySloka.reason,
          issue: mySloka.issue,
          seenAt: mySloka.seenAt,
          verse: await present.verse(mySloka.verse, user),
        }
      : null,
    continueReading: continueReading
      ? {
          book: await present.book(continueReading.book, user),
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
