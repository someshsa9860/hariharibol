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

module.exports = {
  DAY_MS,
  localDateString,
  localHour,
  toDateColumn,
  today,
  shiftDays,
  dateRange,
  isValidDateString,
  isValidTimezone,
};
