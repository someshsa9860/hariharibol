// The Home screen's "for what you are working on" row: how far back a reported vikara still counts, and how many
// issues and verses the row shows. Read by controllers/app/home.js; the ranking and rotation are in utils/home-issues.js.

// A vikara reported this many days ago (in the reader's own calendar) still earns a place on Home.
const ISSUE_LOOKBACK_DAYS = 14;

// At most this many issues get a row of verses.
const ISSUE_VERSES_MAX_ISSUES = 3;

// At most this many verses are shown for each issue.
const ISSUE_VERSES_PER_ISSUE = 2;

export { ISSUE_LOOKBACK_DAYS, ISSUE_VERSES_MAX_ISSUES, ISSUE_VERSES_PER_ISSUE };
