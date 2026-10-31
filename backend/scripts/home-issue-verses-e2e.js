// Walks Home's "for what you are working on" over real HTTP against a running API:
//
//   npm run test:home-issue-verses
//
// What it checks: who may ask, nothing when nothing was reported, only the vikaras (not practices), only verses the
// sloka picker would use (an ineligible verse linked to a vikara never shows), the most reported vikara first, the
// same answer twice in a day, a report older than the lookback does not count, and the reading language follows
// `?languages=`. Makes its own users, issues and links, and removes them again.

import { prisma } from '../config/database.js';
import * as authService from '../services/auth.js';
import { localDateString, toDateColumn, shiftDays } from '../utils/date.js';
import { ISSUE_LOOKBACK_DAYS, ISSUE_VERSES_MAX_ISSUES, ISSUE_VERSES_PER_ISSUE } from '../config/home.js';
import { SLOKA_ELIGIBLE_BOOK_NUMBERS } from '../config/constants.js';

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const DEVICE = 'home-issue-verses-e2e';
const HEAD = { 'content-type': 'application/json', 'x-device-id': DEVICE, 'x-platform': 'ios' };
const PATH = '/api/app/home/issue-verses';

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) passed += 1;
  else failed += 1;
}

async function call(path, { token } = {}) {
  const res = await fetch(BASE + path, {
    headers: { ...HEAD, ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // no body
  }
  return { status: res.status, json };
}

const stamp = Date.now();
const made = { users: [], issues: [], verseIssues: [] };

async function makeUser(label) {
  const role = await prisma.role.findUnique({ where: { slug: 'user' } });
  const user = await prisma.user.create({
    data: {
      email: `home-issues-e2e-${label}-${stamp}@example.com`,
      name: label,
      authProvider: 'GOOGLE',
      providerUserId: `home-issues-e2e-${label}-${stamp}`,
      roleId: role.id,
    },
  });
  made.users.push(user.id);
  const token = (await authService.issueSession(user, DEVICE)).accessToken;
  return { user, token };
}

async function makeIssue(label, category) {
  const issue = await prisma.issue.create({
    data: { slug: `home-e2e-${label}-${stamp}`, name: `Home e2e ${label}`, category, isPublished: true },
  });
  made.issues.push(issue.id);
  return issue;
}

async function link(issueId, verseId, weight) {
  await prisma.verseIssue.create({ data: { issueId, verseId, weight } });
  made.verseIssues.push({ issueId, verseId });
}

async function report(userId, issueId, date, reportedAt = new Date()) {
  await prisma.userIssue.create({ data: { userId, issueId, date: toDateColumn(date), reportedAt } });
}

const slugsOf = (items) => [...new Set(items.map((item) => item.issue.slug))];

async function main() {
  const health = await fetch(`${BASE}/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`\nThe API is not answering on ${BASE}. Start it with \`npm run dev\` first.\n`);
    process.exit(1);
  }

  const verses = await prisma.verse.findMany({
    where: { isSlokaEligible: true, bookNumber: { in: SLOKA_ELIGIBLE_BOOK_NUMBERS }, book: { isPublished: true } },
    take: 4,
    select: { id: true },
  });
  if (verses.length < 3) {
    console.error('\nNeed at least three sloka-eligible verses in a published book. Run the seed and importers first.\n');
    process.exit(1);
  }
  const hidden = await prisma.verse.findFirst({ where: { isSlokaEligible: false }, select: { id: true } });

  try {
    const today = localDateString('Asia/Kolkata');
    const { user, token } = await makeUser('reader');

    console.log('\nWho may ask');
    const anon = await call(PATH);
    check('no token is refused (403 UNAUTHENTICATED, not a 200 with nothing in it)', anon.status === 403 && anon.json?.error?.code === 'UNAUTHENTICATED', `status ${anon.status}`);

    console.log('\nNothing reported');
    const empty = await call(PATH, { token });
    check('a reader with no reports gets an empty list', empty.status === 200 && Array.isArray(empty.json?.data?.items) && empty.json.data.items.length === 0, `status ${empty.status}`);

    const krodha = await makeIssue('krodha', 'VIKARA');
    const moha = await makeIssue('moha', 'VIKARA');
    const practice = await makeIssue('practice', 'PRACTICE');
    await link(krodha.id, verses[0].id, 100);
    await link(krodha.id, verses[1].id, 90);
    await link(moha.id, verses[2].id, 100);
    if (hidden) await link(krodha.id, hidden.id, 100);

    console.log('\nWhat is reported');
    await report(user.id, krodha.id, today);
    await report(user.id, krodha.id, today);
    await report(user.id, moha.id, today);
    await report(user.id, practice.id, today);

    const first = await call(PATH, { token });
    const items = first.json?.data?.items || [];
    const slugs = slugsOf(items);
    check('answers 200 with items once something was reported', first.status === 200 && items.length > 0, `status ${first.status}, ${items.length} item(s)`);
    check('only the vikaras reported appear, never a practice', slugs.every((slug) => slug === krodha.slug || slug === moha.slug) && !slugs.includes(practice.slug), slugs.join(', '));
    check('at most the row limit of items', items.length <= ISSUE_VERSES_MAX_ISSUES * ISSUE_VERSES_PER_ISSUE, `${items.length}`);
    check('the most reported vikara comes first', items[0]?.issue.slug === krodha.slug, items[0]?.issue.slug);
    check('no more than the per-issue limit for a vikara', items.filter((item) => item.issue.slug === krodha.slug).length <= ISSUE_VERSES_PER_ISSUE);
    if (hidden) {
      const hiddenShown = items.some((item) => item.verse?.id === hidden.id);
      check('a verse the sloka picker would not use is never shown', !hiddenShown);
    }
    check('each item carries a verse with an id', items.every((item) => typeof item.verse?.id === 'string'));

    console.log('\nSame day, same answer');
    const again = await call(PATH, { token });
    check('asking again the same day gives the same verses in the same order', JSON.stringify(again.json?.data) === JSON.stringify(first.json?.data));

    console.log('\nThe reading language');
    const hindi = await call(`${PATH}?languages=hi,en`, { token });
    check('a call naming a reading language answers 200', hindi.status === 200 && Array.isArray(hindi.json?.data?.items), `status ${hindi.status}`);
    const bad = await call(`${PATH}?languages=zz-not-a-language`, { token });
    check('a malformed languages value is refused, not served', bad.status === 400, `status ${bad.status}`);

    console.log('\nThe lookback');
    const old = await makeUser('old-report');
    const oldDate = shiftDays(today, -(ISSUE_LOOKBACK_DAYS + 3));
    await report(old.user.id, moha.id, oldDate, new Date(Date.now() - (ISSUE_LOOKBACK_DAYS + 3) * 86_400_000));
    const stale = await call(PATH, { token: old.token });
    check(`a vikara reported more than ${ISSUE_LOOKBACK_DAYS} days ago does not count`, stale.status === 200 && stale.json.data.items.length === 0, `${stale.json?.data?.items?.length} item(s)`);
  } finally {
    console.log('\nClean-up');
    await prisma.userIssue.deleteMany({ where: { userId: { in: made.users } } });
    for (const { issueId, verseId } of made.verseIssues) {
      await prisma.verseIssue.deleteMany({ where: { issueId, verseId } });
    }
    await prisma.issue.deleteMany({ where: { id: { in: made.issues } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: made.users } } });
    await prisma.user.deleteMany({ where: { id: { in: made.users } } });
    console.log(`  removed ${made.users.length} user(s), ${made.issues.length} issue(s), ${made.verseIssues.length} link(s)`);
    await prisma.$disconnect();
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
