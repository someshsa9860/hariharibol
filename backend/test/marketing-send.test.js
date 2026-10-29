// The rules of sending marketing email that need no database: a mail server's answer, the reputation guard, the language a
// reader is sent, addresses and phone numbers, the suppression hash and the links.
//
//   node --test test/marketing-send.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyMailError, gapMs, istDay, judgeReputation, listHeaders, nextIstMidnight, pickVariant, retryDelayMs, sesMessageId } from '../utils/marketing-send.js';
import { cleanEmail, cleanPhone, emailKey, suppressionHash, waIdOf } from '../utils/marketing-address.js';
import { newDeliveryCode, oneClickUnsubscribeUrl, targetProblem, trackedUrl, unsubscribeUrl, utm, withParams } from '../utils/marketing-links.js';
import { marketing } from '../config/marketing.js';
import { webPathFor, linkFromUri } from '../utils/push-rich.js';

test('a mail server’s answer is read by its code', () => {
  assert.equal(classifyMailError({ code: 'EAUTH', message: 'Invalid login' }).kind, 'auth');
  assert.equal(classifyMailError({ responseCode: 535 }).kind, 'auth');
  assert.equal(classifyMailError({ code: 'ECONNECTION' }).kind, 'connection');
  assert.equal(classifyMailError({ code: 'ETIMEDOUT' }).kind, 'retry');
  assert.equal(classifyMailError({ responseCode: 421, response: '421 try later' }).kind, 'retry');
  assert.equal(classifyMailError({ responseCode: 450 }).kind, 'retry');
  assert.equal(classifyMailError({ responseCode: 550, response: '550 5.1.1 User unknown' }).kind, 'hard_bounce');
  assert.equal(classifyMailError({ responseCode: 550, response: '550 mailbox unavailable' }).kind, 'hard_bounce');
  assert.equal(classifyMailError({ responseCode: 554, response: '554 Message rejected: spam content' }).kind, 'rejected');
  assert.equal(classifyMailError({ responseCode: 550, response: '550 blocked by policy' }).kind, 'rejected');
  assert.equal(classifyMailError({ code: 'EENVELOPE' }).kind, 'invalid');
  assert.equal(classifyMailError(new Error('who knows')).kind, 'retry');
});

test('the SES message id is read from the SMTP reply', () => {
  assert.equal(sesMessageId({ response: '250 Ok 0100018f1234abcd-aaaa-bbbb-cccc-000000000000-000000' }), '0100018f1234abcd-aaaa-bbbb-cccc-000000000000-000000');
  assert.equal(sesMessageId({ response: '250 queued' }), null);
});

test('retries wait longer each time, up to a ceiling', () => {
  assert.equal(retryDelayMs(1), marketing.retryBaseMs);
  assert.equal(retryDelayMs(2), marketing.retryBaseMs * 2);
  assert.equal(retryDelayMs(30), marketing.retryMaxMs);
});

test('reputation: nothing is judged on a small sample, then bounce and complaint limits pause the run', () => {
  const ok = (n) => Array(n).fill('ok');
  assert.equal(judgeReputation([...ok(10), 'bounce', 'bounce', 'bounce']).pause, false); // 13 sends: too few to judge
  assert.equal(judgeReputation([...ok(97), 'bounce', 'bounce', 'bounce']).pause, true); // 3% of 100
  assert.equal(judgeReputation([...ok(98), 'bounce', 'bounce']).pause, false); // 2% is the limit, not over it
  const complaints = judgeReputation([...ok(99), 'complaint', 'complaint']);
  assert.equal(complaints.pause, true);
  assert.equal(complaints.reason, 'complaint_rate');
  // Only the most recent window counts: old bounces scroll out.
  const old = [...Array(20).fill('bounce'), ...ok(marketing.reputationWindow)];
  assert.equal(judgeReputation(old).pause, false);
});

test('a reader is sent the first approved language of their chain, else English', () => {
  const variants = [
    { language: 'en', status: 'APPROVED' }, { language: 'hi', status: 'APPROVED' }, { language: 'mr', status: 'DRAFT' },
  ];
  assert.deepEqual(pickVariant(variants, ['hi', 'en']).language, 'hi');
  assert.equal(pickVariant(variants, ['hi', 'en']).fellBack, false);
  const marathi = pickVariant(variants, ['mr', 'hi', 'en']);
  assert.equal(marathi.language, 'hi'); // mr is a draft; the next in the chain is used
  assert.equal(marathi.fellBack, true);
  assert.equal(pickVariant(variants, ['ta']).language, 'en');
  assert.equal(pickVariant([{ language: 'hi', status: 'APPROVED' }], ['ta']), null);
  assert.equal(pickVariant([{ language: 'en', status: 'DRAFT' }], ['en']), null);
});

test('pace and the Indian day', () => {
  assert.equal(gapMs(120), 500);
  assert.equal(gapMs(0), 60000);
  assert.equal(istDay(new Date('2026-10-29T19:00:00Z')), '2026-10-30'); // 00:30 next day in India
  assert.equal(istDay(new Date('2026-10-29T18:00:00Z')), '2026-10-29');
  const lift = nextIstMidnight(new Date('2026-10-29T10:00:00Z'));
  assert.equal(lift.toISOString().slice(0, 16), '2026-10-29T18:30'); // 00:00 IST + 5s
});

test('every email carries the one-click unsubscribe headers', () => {
  const h = listHeaders({ unsubscribeUrl: 'https://api.test/u/CODE', mailto: 'unsub@hariharibol.com', configurationSet: 'hhb', campaignId: 'c1' });
  assert.equal(h['List-Unsubscribe'], '<https://api.test/u/CODE>, <mailto:unsub@hariharibol.com?subject=unsubscribe>');
  assert.equal(h['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.equal(h.Precedence, 'bulk');
  assert.equal(h['X-SES-CONFIGURATION-SET'], 'hhb');
  assert.equal(listHeaders({ unsubscribeUrl: 'x' })['X-SES-CONFIGURATION-SET'], undefined);
});

test('addresses: cleaned, de-duplicated by inbox, stand-ins refused', () => {
  assert.equal(cleanEmail('  Somesh@Gmail.com '), 'somesh@gmail.com');
  assert.equal(cleanEmail('legacy-12@legacy.invalid'), null);
  assert.equal(cleanEmail('not an address'), null);
  assert.equal(cleanEmail('a..b@x.com'), null);
  assert.equal(emailKey('So.mesh+news@gmail.com'), emailKey('somesh@googlemail.com'));
  assert.notEqual(emailKey('a@x.com'), emailKey('b@x.com'));
});

test('phone numbers become E.164, or are refused rather than guessed', () => {
  assert.equal(cleanPhone('98765 43210'), '+919876543210');
  assert.equal(cleanPhone('09876543210'), '+919876543210');
  assert.equal(cleanPhone('+91 (98765) 43-210'), '+919876543210');
  assert.equal(cleanPhone('0044 7911 123456'), '+447911123456');
  assert.equal(cleanPhone('+14155552671'), '+14155552671');
  assert.equal(cleanPhone('12345'), null);
  assert.equal(cleanPhone('+0123'), null);
  assert.equal(cleanPhone(''), null);
  assert.equal(waIdOf('+919876543210'), '919876543210');
});

test('the suppression hash is keyed, stable, per channel, and the same for one inbox', () => {
  const a = suppressionHash('EMAIL', 'So.mesh+x@gmail.com', 'k1');
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(a, suppressionHash('EMAIL', 'somesh@gmail.com', 'k1'));
  assert.notEqual(a, suppressionHash('EMAIL', 'somesh@gmail.com', 'k2'));
  assert.notEqual(suppressionHash('EMAIL', 'a@x.com', 'k'), suppressionHash('WHATSAPP', '+919876543210', 'k'));
  assert.equal(suppressionHash('EMAIL', 'nope', 'k'), null);
});

test('tracked links: opaque codes, the grammar, utm values', () => {
  const code = newDeliveryCode();
  assert.equal(code.length, marketing.codeLength);
  assert.notEqual(code, newDeliveryCode());
  assert.equal(trackedUrl('https://hariharibol.com', code, 2), `https://hariharibol.com/l/${code}/2`);
  assert.equal(unsubscribeUrl('https://hariharibol.com', code), `https://hariharibol.com/unsubscribe/${code}`);
  assert.equal(oneClickUnsubscribeUrl('https://api.hariharibol.com', code), `https://api.hariharibol.com/api/web/marketing/unsubscribe/${code}`);
  assert.deepEqual(utm('c1', 'EMAIL', 2), { utm_source: 'mkt', utm_medium: 'email', utm_campaign: 'c1', utm_content: '2' });
  assert.equal(withParams('https://x.test/a?utm_source=keep', { utm_source: 'mkt', b: 1 }), 'https://x.test/a?utm_source=keep&b=1');
});

test('a link target must be an https URL or a known place in the app', () => {
  assert.equal(targetProblem('WEB', 'https://hariharibol.com/plans'), null);
  assert.match(targetProblem('WEB', 'http://x.test'), /https/);
  assert.match(targetProblem('WEB', 'javascript:alert(1)'), /https/);
  assert.equal(targetProblem('APP', 'hariharibol://sakha'), null);
  assert.equal(targetProblem('APP', 'hariharibol://verse?book=gita&chapter=2'), null);
  assert.match(targetProblem('APP', 'hariharibol://verse?book=gita'), /needs chapter/);
  assert.match(targetProblem('APP', 'hariharibol://nowhere'), /not a place in the app/);
  assert.match(targetProblem('APP', 'https://x.test'), /hariharibol:\/\//);
  assert.match(targetProblem('WEB', ''), /somewhere to go/);
});

test('an app destination has a website page for people without the app', () => {
  assert.equal(webPathFor(linkFromUri('hariharibol://sakha')), '/sakha');
  assert.equal(webPathFor(linkFromUri('hariharibol://premium')), '/plans');
  assert.equal(webPathFor(linkFromUri('hariharibol://verse?book=sb&canto=1&chapter=3&verse=4')), '/read/sb/1/3');
  assert.equal(webPathFor(linkFromUri('hariharibol://verse?book=gita&chapter=2')), '/read/gita/2');
  assert.equal(webPathFor(linkFromUri('hariharibol://reel?id=r1')), '/reels/r1');
  assert.equal(webPathFor(linkFromUri('hariharibol://support')), null);
  assert.equal(linkFromUri('https://x.test'), null);
});
