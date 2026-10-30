// Who a campaign reaches (the pure filter rules) and the SNS message checks of the bounce webhook. No database.
//
//   node --test test/marketing-audience.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { buildWhere, describeFilter, parseFilter } from '../utils/marketing-audience.js';
import { eventsOf, stringToSign, validCertUrl, validSubscribeUrl, verifySignature } from '../utils/marketing-sns.js';

const NOW = new Date('2026-10-29T00:00:00Z');
const flat = (where) => JSON.stringify(where);

test('an empty filter is every reader, minus the ones who are never written to', () => {
  const where = buildWhere({}, { now: NOW });
  const text = flat(where);
  assert.match(text, /"isBanned":false/);
  assert.match(text, /legacy\.invalid/);
  assert.match(text, /"emailEnabled":true/);
  assert.equal(describeFilter({}), 'every reader');
});

test('a WhatsApp audience needs a verified number and no opt-out', () => {
  const text = flat(buildWhere({}, { channel: 'WHATSAPP', now: NOW }));
  assert.match(text, /whatsappVerifiedAt/);
  assert.match(text, /whatsappOptOutAt/);
  assert.doesNotMatch(text, /legacy\.invalid/);
});

test('each filter adds a condition', () => {
  const where = buildWhere({
    readingLanguages: ['hi', 'mr'], countries: ['in'], lapsedDays: 30, chantedWithinDays: 7, donors: false, platforms: ['android'], bookSlugs: ['gita'], plans: ['free'],
  }, { now: NOW });
  const text = flat(where);
  assert.match(text, /"readingLanguage":\{"in":\["hi","mr"\]\}/);
  assert.match(text, /"countryCode":\{"in":\["IN"\]\}/);
  assert.match(text, /"lastActiveAt":\{"lt":"2026-09-29/);
  assert.match(text, /"roundsCompleted":\{"gt":0\},"date":\{"gte":"2026-10-22/);
  assert.match(text, /"payments":\{"none"/);
  assert.match(text, /"platform":\{"in":\["android"\]\}/);
  assert.match(text, /"slug":\{"in":\["gita"\]\}/);
  assert.match(text, /"isPremium":false/);
});

test('a streak filter uses the list the caller computed', () => {
  const text = flat(buildWhere({ minStreak: 7 }, { now: NOW, streakIds: ['u1', 'u2'] }));
  assert.match(text, /"id":\{"in":\["u1","u2"\]\}/);
  assert.match(flat(buildWhere({ minStreak: 7 }, { now: NOW })), /"id":\{"in":\[\]\}/); // never "everyone" by mistake
});

test('a filter that contradicts itself or has an unknown key is refused', () => {
  assert.equal(parseFilter({ activeWithinDays: 7, lapsedDays: 30 }).ok, false);
  assert.equal(parseFilter({ chantedWithinDays: 7, neverChanted: true }).ok, false);
  assert.equal(parseFilter({ joinedWithinDays: 30, joinedBeforeDays: 10 }).ok, false);
  assert.equal(parseFilter({ password: 'x' }).ok, false);
  assert.equal(parseFilter({ readingLanguages: 'hi' }).ok, false);
  assert.equal(parseFilter({ platforms: ['palm'] }).ok, false);
  assert.equal(parseFilter({ minStreak: 7, lapsedDays: 60 }).ok, true);
  assert.equal(parseFilter(null).ok, true);
});

test('a filter is described in words', () => {
  assert.equal(describeFilter({ readingLanguages: ['hi'], lapsedDays: 30, neverChanted: true }), 'reads in: hi; not seen for 30 days; never chanted');
});

// ---------- SNS ----------

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = publicKey.export({ type: 'spki', format: 'pem' });
function signed(fields, version = '1') {
  const message = { Type: 'Notification', MessageId: 'm1', TopicArn: 'arn:aws:sns:ap-south-1:1:t', Timestamp: '2026-10-29T10:00:00.000Z', Message: '{"a":1}', SignatureVersion: version, ...fields };
  message.Signature = crypto.createSign(version === '2' ? 'RSA-SHA256' : 'RSA-SHA1').update(stringToSign(message), 'utf8').sign(privateKey, 'base64');
  return message;
}

test('an SNS message verifies with its certificate and not after any change', () => {
  assert.ok(verifySignature(signed({}), pem));
  assert.ok(verifySignature(signed({}, '2'), pem));
  assert.ok(verifySignature(signed({ Subject: 'Hello' }), pem));
  const tampered = signed({});
  tampered.Message = '{"a":2}';
  assert.equal(verifySignature(tampered, pem), false);
  assert.equal(verifySignature({ ...signed({}), SignatureVersion: '3' }, pem), false);
  assert.equal(verifySignature({ ...signed({}), Signature: undefined }, pem), false);
  assert.equal(verifySignature(signed({}), crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ type: 'spki', format: 'pem' })), false);
});

test('the string to sign lists only the fields the type has, in SNS’s order', () => {
  const text = stringToSign({ Type: 'Notification', Message: 'm', MessageId: 'i', Timestamp: 't', TopicArn: 'a' });
  assert.equal(text, 'Message\nm\nMessageId\ni\nTimestamp\nt\nTopicArn\na\nType\nNotification\n');
  assert.equal(stringToSign({ Type: 'Other' }), null);
});

test('only Amazon’s own SNS hosts are trusted for certificates and confirmations', () => {
  assert.ok(validCertUrl('https://sns.ap-south-1.amazonaws.com/SimpleNotificationService-abc.pem'));
  assert.equal(validCertUrl('http://sns.ap-south-1.amazonaws.com/x.pem'), false);
  assert.equal(validCertUrl('https://sns.ap-south-1.amazonaws.com.evil.test/x.pem'), false);
  assert.equal(validCertUrl('https://evil.test/sns.ap-south-1.amazonaws.com/x.pem'), false);
  assert.equal(validCertUrl('https://sns.ap-south-1.amazonaws.com:8443/x.pem'), false);
  assert.equal(validCertUrl('https://sns.ap-south-1.amazonaws.com/x.txt'), false);
  assert.equal(validCertUrl(undefined), false);
  assert.ok(validSubscribeUrl('https://sns.ap-south-1.amazonaws.com/?Action=ConfirmSubscription&Token=t'));
  assert.equal(validSubscribeUrl('https://evil.test/?Action=ConfirmSubscription'), false);
});

test('SES events are read into bounces, complaints and deliveries', () => {
  const bounce = eventsOf({ eventType: 'Bounce', mail: { messageId: 'M1' }, bounce: { bounceType: 'Permanent', bouncedRecipients: [{ emailAddress: 'a@x.com', diagnosticCode: 'smtp; 550 5.1.1 user unknown' }] } });
  assert.deepEqual(bounce, [{ type: 'bounce', permanent: true, messageId: 'M1', emails: ['a@x.com'], detail: 'smtp; 550 5.1.1 user unknown' }]);
  assert.equal(eventsOf({ notificationType: 'Bounce', mail: {}, bounce: { bounceType: 'Transient', bouncedRecipients: [{ emailAddress: 'a@x.com' }] } })[0].permanent, false);
  const complaint = eventsOf({ eventType: 'Complaint', mail: { messageId: 'M2' }, complaint: { complainedRecipients: [{ emailAddress: 'b@x.com' }], complaintFeedbackType: 'abuse' } });
  assert.equal(complaint[0].type, 'complaint');
  assert.deepEqual(complaint[0].emails, ['b@x.com']);
  assert.equal(eventsOf({ eventType: 'Delivery', mail: { messageId: 'M3' }, delivery: { recipients: ['c@x.com'] } })[0].type, 'delivery');
  assert.deepEqual(eventsOf({ eventType: 'Send' }), []);
  assert.deepEqual(eventsOf(null), []);
});
