// "Ekadashi is tomorrow" — the push before an Ekadashi, Chaturthi or festival.
//
// Runs once a day (config/cron.js). A Festival says how many days ahead to tell people
// (`notifyDaysBefore`, 1 by default); `notifiedDays` records what has gone so a restarted or
// retried run never sends the same one twice. Festivals are dated for the calendar's place
// (services/panchang-store.js), and "today" is that place's today — the calendar is India's.

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import * as notify from '../../services/notify.js';
import { LOCATIONS } from '../../services/panchang.js';
import { currentLocationKey, asDate } from '../../services/panchang-store.js';
import { localDateString, shiftDays } from '../../utils/date.js';

const BATCH_SIZE = 500;

const when = (days) => (days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`);

function message(festival, days) {
  const date = festival.date.toISOString().slice(0, 10);
  const later = festival.details?.vaishnavaDate && festival.details.vaishnavaDate !== date;
  const lines = [festival.description?.trim()];
  if (later) lines.push(`Vaishnavas keep it on ${festival.details.vaishnavaDate}.`);
  const fortnight = festival.paksha ? ` · ${festival.paksha === 'SHUKLA' ? 'Shukla' : 'Krishna'} paksha` : '';
  return {
    title: `${festival.name} ${when(days)}`,
    body: lines.filter(Boolean).join(' ') || `${festival.name}${fortnight}`,
  };
}

// Readers with a phone that can be pushed to, a page at a time.
async function* audience() {
  let cursor = null;
  for (;;) {
    const users = await prisma.user.findMany({
      where: { isBanned: false, devices: { some: { fcmToken: { not: null }, isBanned: false } } },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!users.length) return;
    cursor = users[users.length - 1].id;
    yield users.map((u) => u.id);
  }
}

export default async function festivalNotify() {
  const key = await currentLocationKey();
  const today = localDateString(LOCATIONS[key].timezone);
  let sent = 0;

  for (const days of [0, 1, 2, 3]) {
    const date = shiftDays(today, days);
    const festivals = await prisma.festival.findMany({
      where: {
        locationKey: key,
        date: asDate(date),
        isActive: true,
        notify: true,
        notifyDaysBefore: { has: days },
        NOT: { notifiedDays: { has: days } },
      },
    });

    for (const festival of festivals) {
      const { title, body } = message(festival, days);
      for await (const ids of audience()) {
        await notify.toUsers(ids, {
          type: 'FESTIVAL',
          title,
          body,
          data: { deeplink: 'hariharibol://calendar', date, kind: festival.kind, festivalId: festival.id },
        });
        sent += ids.length;
      }
      await prisma.festival.update({
        where: { id: festival.id },
        data: { notifiedDays: { push: days } },
      });
      logger.info({ festival: festival.name, date, days }, 'festival push sent');
    }
  }

  return { sent };
}
