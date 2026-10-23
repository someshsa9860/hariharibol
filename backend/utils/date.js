// Sadhana days, daily slokas and reminders are all anchored to the user's own
// calendar date, not the server's. A user in Toronto starting their day is on a
// different date from the server in Mumbai, and getting this wrong shows up as
// a missing day in someone's practice record.
//
// Date-only columns are stored as UTC midnight of the user's local date.

const DAY_MS = 24 * 60 * 60 * 1000;

// "2026-09-08" for the given instant in the given zone.
function localDateString(timezone, at = new Date()) {
  try {
    // en-CA formats as YYYY-MM-DD, which is exactly the key we want.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(at);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(at);
  }
}

// 0–23 in the user's zone — what the delivery cron compares against.
function localHour(timezone, at = new Date()) {
  try {
    return Number.parseInt(
      new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', hour12: false }).format(at),
      10
    );
  } catch {
    return at.getUTCHours();
  }
}

// Minutes since midnight in the user's zone, 0–1439 — for a time of day that is
// not on the hour (04:30). `h23` so midnight is 0, where `hour12: false` can say 24.
function localMinutes(timezone, at = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(at);
    const part = (type) => Number.parseInt(parts.find((p) => p.type === type).value, 10);
    return (part('hour') % 24) * 60 + part('minute');
  } catch {
    return at.getUTCHours() * 60 + at.getUTCMinutes();
  }
}

// "2026-09-08" → Date at UTC midnight, the form every @db.Date column takes.
function toDateColumn(dateString) {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function today(timezone) {
  return toDateColumn(localDateString(timezone));
}

function shiftDays(dateString, days) {
  const shifted = new Date(toDateColumn(dateString).getTime() + days * DAY_MS);
  return shifted.toISOString().slice(0, 10);
}

function isValidDateString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function isValidTimezone(value) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// Inclusive list of date strings, used to fill gaps in a report so a chart has
// a point for every day rather than only the days with activity.
function dateRange(fromDateString, toDateString) {
  const out = [];
  let cursor = fromDateString;
  while (cursor <= toDateString) {
    out.push(cursor);
    cursor = shiftDays(cursor, 1);
  }
  return out;
}

// A date the way the reader's language writes it ("22 अक्टूबर 2026"), in India's calendar day. `chain`
// is a language chain (utils/language.js); India's English when the runtime has no data for it.
function longDate(date, chain = []) {
  const options = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' };
  for (const locale of [chain[0], 'en-IN']) {
    try {
      return new Date(date).toLocaleDateString(locale, options);
    } catch {
      // a language code the runtime does not know: try the next one
    }
  }
  return '';
}

// A time of day the way the reader's language writes it ("6:26 am", "६:२६ AM"), in the given zone.
// Same fallback as `longDate`.
function clockTime(date, chain = [], timezone = 'Asia/Kolkata') {
  const options = { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone };
  for (const locale of [chain[0], 'en-IN']) {
    try {
      return new Date(date).toLocaleTimeString(locale, options);
    } catch {
      // a language code the runtime does not know: try the next one
    }
  }
  return '';
}

export {
  DAY_MS,
  clockTime,
  longDate,
  localDateString,
  localHour,
  localMinutes,
  toDateColumn,
  today,
  shiftDays,
  dateRange,
  isValidDateString,
  isValidTimezone,
};
