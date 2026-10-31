// The pure half of Home's "for what you are working on": which reported issues come first, which verse of a band a
// given day starts from. No database, no I/O — tested by test/home-issue-verses.test.js.

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The issues to show, most reported first, then the most recently reported. `rows` are
 * `{ issueId, count, lastAt }` (a count of reports and the latest report's time); at most `max` come back.
 */
export function rankIssues(rows, max) {
  return [...rows]
    .sort((a, b) => b.count - a.count || new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
    .slice(0, max);
}

/**
 * The list started at an index taken from the day, so the same day gives the same order and the next day starts
 * somewhere else. A day number, not Math.random: pull-to-refresh must not reshuffle the row.
 */
export function rotate(list, dayNumber) {
  if (!list.length) return [];
  const start = ((dayNumber % list.length) + list.length) % list.length;
  return [...list.slice(start), ...list.slice(0, start)];
}

/**
 * Only the top band of candidates competes: everything within 20% of the best weight. Candidates must be sorted best
 * first. Shared by the sloka picker and Home's issue verses.
 */
export function topBand(candidates) {
  const best = candidates[0].weight;
  return candidates.filter((row) => row.weight >= best * 0.8);
}

/** Days since the Unix epoch for a `YYYY-MM-DD` calendar date. */
export function dayNumber(dateString) {
  return Math.floor(Date.parse(`${dateString}T00:00:00.000Z`) / DAY_MS);
}
