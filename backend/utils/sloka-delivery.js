// When the daily sloka is due. No database and no clock — loaded on its own.
//
//   npm test

import { SLOKA_DEFAULT_DELIVERY_TIME } from '../config/constants.js';

const DAY_MINUTES = 24 * 60;

/** "04:30" → 270 (minutes after midnight), or null when it is not a 24-hour time. */
function parseTimeOfDay(text) {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(text ?? '').trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** The setting's minutes after midnight; a missing or unreadable value is the default. */
function deliveryMinutes(setting) {
  return parseTimeOfDay(setting) ?? parseTimeOfDay(SLOKA_DEFAULT_DELIVERY_TIME);
}

/**
 * Whether a run that happens every [windowMinutes] should send to a reader whose
 * clock says [localMinutes]: the target has come, and by less than one run ago.
 *
 * The window is a whole run wide, so each reader falls in exactly one run's — also
 * in a zone a quarter hour off UTC (Nepal), where the runs are seen at :15 and :45.
 * Counted round the clock, so 00:10 is 20 minutes after 23:50. `notifiedAt` on the
 * row is what stops a second send, not this.
 */
function isDeliveryDue({ localMinutes, targetMinutes, windowMinutes }) {
  return (localMinutes - targetMinutes + DAY_MINUTES) % DAY_MINUTES < windowMinutes;
}

export { parseTimeOfDay, deliveryMinutes, isDeliveryDue };
