// "Is there a festival push to send today?" — the 04:45 IST job (config/cron.js).
//
// Looks at the calendar for today and the days just ahead (the same query the push itself uses,
// `dueFestivals`) and, if anything is due, queues the `festival.notify` job for 05:00 IST. A day
// with nothing due queues nothing. Run late — a restart after 05:00 — the push is queued to go at
// once, so the day is not lost; run twice, the job id keeps it to one.

import logger from '../../config/logger.js';
import { queues, JOBS } from '../index.js';
import { LOCATIONS, localMidnight } from '../../services/panchang.js';
import { currentLocationKey } from '../../services/panchang-store.js';
import { localDateString } from '../../utils/date.js';
import { dueFestivals } from './festival-notify.js';

const PUSH_HOUR = 5; // local time at the calendar's place
const HOUR_MS = 3600 * 1000;

/** The instant the push goes out on `date` (YYYY-MM-DD) in the calendar's zone. */
function pushTime(date, timezone) {
  return new Date(localMidnight(date, timezone).getTime() + PUSH_HOUR * HOUR_MS);
}

export default async function festivalPlan() {
  const key = await currentLocationKey();
  const { timezone } = LOCATIONS[key];
  const today = localDateString(timezone);

  const due = await dueFestivals(key, today);
  if (!due.length) {
    logger.info({ today }, 'no festival push due today');
    return { today, planned: false, due: 0 };
  }

  const at = pushTime(today, timezone);
  const delay = Math.max(0, at.getTime() - Date.now());
  await queues.notification.add(JOBS.FESTIVAL_NOTIFY, { date: today }, { delay, jobId: `festival-notify-${today}` });

  logger.info(
    { today, at: at.toISOString(), delayMs: delay, festivals: due.map((d) => `${d.festival.name} (${d.days === 0 ? 'today' : `in ${d.days}d`})`) },
    'festival push queued'
  );
  return { today, planned: true, due: due.length, at: at.toISOString() };
}

export { pushTime };
