// Share codes, paths and the referral rules. No database.
//
//   node --test test/share.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  newCode, normaliseCode, kindOfPath, shareUrl, referralUrl, keptQuery, appUri, KIND_PATHS,
} from '../utils/share.js';
import { canClaim, qualifies, rewardWindow, DEFAULT_RULES } from '../utils/referral.js';

test('a code is random, long enough and uses only unambiguous letters', () => {
  const seen = new Set();
  for (let i = 0; i < 500; i += 1) {
    const code = newCode();
    assert.match(code, /^[A-HJKMNP-TV-Z2-9]{10}$/);
    seen.add(code);
  }
  assert.equal(seen.size, 500);
});

test('a typed code is cleaned up, and rubbish is refused', () => {
  assert.equal(normaliseCode(' abcd2345kk '), 'ABCD2345KK');
  assert.equal(normaliseCode('ab'), null);
  assert.equal(normaliseCode('../etc/passwd'), null);
  assert.equal(normaliseCode('ABCD0OIL1U'), null); // letters the alphabet leaves out
  assert.equal(normaliseCode(undefined), null);
});

test('each kind has its own path, and a path maps back', () => {
  assert.equal(shareUrl('https://hariharbol.com/', 'SHLOKA', 'ABC'), 'https://hariharbol.com/shloka/ABC');
  assert.equal(kindOfPath('divya'), 'REEL');
  assert.equal(kindOfPath('share'), null);
  assert.equal(referralUrl('https://hariharbol.com', 'Z'), 'https://hariharbol.com/satsang/Z');
  assert.equal(appUri('hariharibol', 'MANTRA', 'X'), 'hariharibol://mantra/X');
  assert.equal(new Set(Object.values(KIND_PATHS)).size, 3);
});

test('only attribution survives onto a landing page — never a destination', () => {
  const q = keptQuery({ utm_source: 'whatsapp', redirect: 'https://evil.test', next: '/x', ref: 'a b' });
  assert.equal(q, 'utm_source=whatsapp');
});

const now = new Date('2026-10-21T10:00:00Z');
const hoursAgo = (h) => new Date(now - h * 3_600_000);

test('claiming: self, repeat, old accounts and unknown codes are refused', () => {
  const referee = { id: 'u2', createdAt: hoursAgo(2) };
  assert.deepEqual(canClaim({ referrerId: 'u1', referee, alreadyReferred: false, now }), { ok: true });
  assert.equal(canClaim({ referrerId: 'u2', referee, alreadyReferred: false, now }).reason, 'SELF_REFERRAL');
  assert.equal(canClaim({ referrerId: 'u1', referee, alreadyReferred: true, now }).reason, 'ALREADY_REFERRED');
  assert.equal(canClaim({ referrerId: null, referee, alreadyReferred: false, now }).reason, 'CODE_UNKNOWN');
  const old = { id: 'u3', createdAt: hoursAgo(24 * 30) };
  assert.equal(canClaim({ referrerId: 'u1', referee: old, alreadyReferred: false, now }).reason, 'NOT_NEW');
});

test('qualifying needs time, activity and room under the yearly limit', () => {
  const base = { status: 'PENDING', refereeCreatedAt: hoursAgo(30) };
  assert.equal(qualifies({ referral: base, actions: 1, rewardsThisYear: 0, now }).ok, true);
  assert.equal(qualifies({ referral: { ...base, refereeCreatedAt: hoursAgo(1) }, actions: 5, rewardsThisYear: 0, now }).reason, 'TOO_SOON');
  assert.equal(qualifies({ referral: base, actions: 0, rewardsThisYear: 0, now }).reason, 'NOT_ACTIVE_YET');
  assert.equal(qualifies({ referral: base, actions: 3, rewardsThisYear: DEFAULT_RULES.maxRewardsPerYear, now }).reason, 'LIMIT_REACHED');
  assert.equal(qualifies({ referral: { ...base, status: 'REWARDED' }, actions: 3, rewardsThisYear: 0, now }).reason, 'NOT_PENDING');
});

test('the month starts now, or after the access already held — it never shortens it', () => {
  assert.equal(rewardWindow({ coveredUntil: null, now }).startsAt.getTime(), now.getTime());
  const paidUntil = new Date('2026-12-01T00:00:00Z');
  const w = rewardWindow({ coveredUntil: paidUntil, now });
  assert.equal(w.startsAt.getTime(), paidUntil.getTime());
  assert.equal(w.endsAt - w.startsAt, 30 * 86_400_000);
  assert.equal(rewardWindow({ coveredUntil: new Date('2026-01-01'), now }).startsAt.getTime(), now.getTime());
});

import { buildPrompt, canAfford, planFor } from '../utils/share-background.js';

test('a background prompt is cleaned, capped, and always asks for no lettering', () => {
  const p = buildPrompt('  A golden   sunrise\n over a temple  ');
  assert.match(p, /^A golden sunrise over a temple\. /);
  assert.match(p, /No letters, no words, no typography, no watermark/);
  assert.equal(buildPrompt('  '), null);
  assert.equal(buildPrompt('ab'), null);
  assert.ok(buildPrompt('x'.repeat(5000)).length < 700);
});

test('a request key decides charge, replay or wait', () => {
  assert.equal(planFor(null), 'START');
  assert.equal(planFor({ status: 'DONE' }), 'REPLAY');
  assert.equal(planFor({ status: 'FAILED' }), 'RETRY');
  assert.equal(planFor({ status: 'PENDING' }), 'WAIT');
  assert.equal(canAfford({ spendable: 100, cost: 100 }), true);
  assert.equal(canAfford({ spendable: 99, cost: 100 }), false);
});
