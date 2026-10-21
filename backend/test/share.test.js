// The grammar of shared links. No database.
//
//   npm test

import test from 'node:test';
import assert from 'node:assert/strict';

import { CODE_PATTERN, contentUrl, inbox, newCode, newReferralCode, normaliseReferralCode, parseLink, referralUrl } from '../utils/share.js';

const HOST = 'hariharibol.com';

test('codes are random and use only the readable alphabet', () => {
  const codes = new Set(Array.from({ length: 500 }, () => newCode()));
  assert.equal(codes.size, 500);
  for (const code of codes) assert.match(code, CODE_PATTERN);
  for (let i = 0; i < 200; i += 1) assert.match(newReferralCode(), /^[A-HJ-NP-Z2-9]{8}$/);
});

test('content and referral links live on different paths', () => {
  assert.equal(contentUrl('https://x', 'VERSE', 'abc'), 'https://x/shloka/abc');
  assert.equal(contentUrl('https://x', 'MANTRA', 'abc'), 'https://x/naam/abc');
  assert.equal(contentUrl('https://x', 'REEL', 'abc'), 'https://x/darshan/abc');
  assert.equal(contentUrl('https://x', 'NOPE', 'abc'), null);
  assert.equal(referralUrl('https://x', 'ABCD2345'), 'https://x/satsang/ABCD2345');
});

test('a link is read back to what it points at', () => {
  const code = newCode();
  assert.deepEqual(parseLink(`https://hariharibol.com/shloka/${code}`, { host: HOST }), { kind: 'content', type: 'VERSE', code });
  assert.deepEqual(parseLink(`https://www.hariharibol.com/darshan/${code}?utm=x`, { host: HOST }), { kind: 'content', type: 'REEL', code });
  assert.deepEqual(parseLink(`/naam/${code}`), { kind: 'content', type: 'MANTRA', code });
  assert.deepEqual(parseLink(`hariharibol://satsang/abcd2345`), { kind: 'referral', code: 'ABCD2345' });
});

test('a referral code is never read as content, nor content as a referral', () => {
  assert.equal(parseLink('/satsang/abc'), null);
  assert.equal(parseLink('/satsang/0OIl0OIl'), null);
});

test('other sites, odd schemes and junk are refused', () => {
  assert.equal(parseLink('https://evil.com/shloka/abcdefghij', { host: HOST }), null);
  assert.equal(parseLink('https://hariharibol.com.evil.com/shloka/abcdefghij', { host: HOST }), null);
  assert.equal(parseLink('/shloka/../etc/passwd'), null);
  assert.equal(parseLink('/shloka/'), null);
  assert.equal(parseLink(''), null);
  assert.equal(parseLink(null), null);
  assert.equal(parseLink('/verse/1.2.3'), null);
});

test('typed referral codes are forgiving about case, spaces and dashes', () => {
  assert.equal(normaliseReferralCode(' abcd-2345 '), 'ABCD2345');
  assert.equal(normaliseReferralCode('abc'), null);
  assert.equal(normaliseReferralCode('ABCD0OIL'), null);
});

test('one inbox is one person', () => {
  assert.equal(inbox('Anna.Ref+x@gmail.com'), inbox('annaref@googlemail.com'));
  assert.notEqual(inbox('a.b@corp.com'), inbox('ab@corp.com'));
  assert.equal(inbox('a+tag@corp.com'), inbox('a@corp.com'));
});
