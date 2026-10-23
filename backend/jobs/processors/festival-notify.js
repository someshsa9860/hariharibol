// "Ekadashi is tomorrow" — the push before an Ekadashi, Chaturthi or festival.
//
// Not on a schedule of its own: `festival.plan` (jobs/processors/festival-plan.js) looks every
// morning at 04:45 IST and, when something is due, queues this job for 05:00 IST.
//
// A festival is always announced on its own day. `notifyDaysBefore` (1 by default) adds earlier
// heads-ups; `notifiedDays` records what has gone so a restarted or retried run never sends the
// same one twice. Festivals are dated for the calendar's place (services/panchang-store.js), and
// "today" is that place's today — the calendar is India's.
//
// The wrapper words ("today", "tomorrow", the Vaishnava date, the fortnight) are said in each
// reader's app language, so the audience is grouped by language and each group gets one send. The
// festival's own name and description are the calendar's data: they go in the reader's language where the admin has
// translated them (Hindu calendar → Translate) and as they are where not. A parana row
// (the morning after an Ekadashi fast) is worded from its times, in the reader's language and
// script. All of that is `message` in utils/festival-message.js. There is no "Hari Bol <name>"
// here: this is one message for everyone (see notify.toUsers), not a notification written for a
// person.

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import * as notify from '../../services/notify.js';
import * as translations from '../../services/calendar-translation.js';
import { LOCATIONS } from '../../services/panchang.js';
import { currentLocationKey, asDate } from '../../services/panchang-store.js';
import { localDateString, shiftDays } from '../../utils/date.js';
import { message } from '../../utils/festival-message.js';
import { appChain } from '../../utils/language.js';

const BATCH_SIZE = 500;

// Readers with a phone that can be pushed to, a page at a time.
async function* audience() {
  let cursor = null;
  for (;;) {
    const users = await prisma.user.findMany({
      where: { isBanned: false, devices: { some: { fcmToken: { not: null }, isBanned: false } } },
      select: { id: true, appLanguage: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!users.length) return;
    cursor = users[users.length - 1].id;
    yield users;
  }
}

// A page of readers split by the language their app speaks: [[chain, [id, ...]], ...].
function byLanguage(users) {
  const groups = new Map();
  for (const user of users) {
    const chain = appChain(user);
    if (!groups.has(chain[0])) groups.set(chain[0], { chain, ids: [] });
    groups.get(chain[0]).ids.push(user.id);
  }
  return [...groups.values()];
}

// The pushes due on `today`: [{ festival, days, date }], `days` being how far off the festival is.
// Today's festivals are always due; one a few days off is due only if its `notifyDaysBefore` says so.
async function dueFestivals(key, today) {
  const due = [];
  for (const days of [0, 1, 2, 3]) {
    const date = shiftDays(today, days);
    const festivals = await prisma.festival.findMany({
      where: {
        locationKey: key,
        date: asDate(date),
        isActive: true,
        notify: true,
        ...(days > 0 ? { notifyDaysBefore: { has: days } } : {}),
        NOT: { notifiedDays: { has: days } },
      },
    });
    for (const festival of festivals) due.push({ festival, days, date });
  }
  return due;
}

export default async function festivalNotify() {
  const key = await currentLocationKey();
  const today = localDateString(LOCATIONS[key].timezone);
  let sent = 0;

  for (const { festival, days, date } of await dueFestivals(key, today)) {
    // The festival's words in each language, looked up once however many pages of readers there are.
    const wordsOf = new Map();
    const wordsFor = async (chain) => {
      if (!wordsOf.has(chain[0])) wordsOf.set(chain[0], await translations.wordsFor(chain, [], [festival]));
      return wordsOf.get(chain[0]);
    };
    for await (const users of audience()) {
      for (const { chain, ids } of byLanguage(users)) {
        const { title, body } = message(festival, days, chain, await wordsFor(chain));
        // One campaign per language, so each keeps the words its readers were sent.
        await notify.toUsers(ids, {
          type: 'FESTIVAL',
          campaign: `festival:${festival.id}:${days}:${chain[0]}`,
          title,
          body,
          data: { deeplink: 'hariharibol://calendar', date, kind: festival.kind, festivalId: festival.id },
        });
        sent += ids.length;
      }
    }
    await prisma.festival.update({
      where: { id: festival.id },
      data: { notifiedDays: { push: days } },
    });
    logger.info({ festival: festival.name, date, days }, 'festival push sent');
  }

  return { sent };
}

export { dueFestivals };
