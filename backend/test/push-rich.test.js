import { test } from 'node:test';
import assert from 'node:assert/strict';

import { build, linkToUri } from '../utils/push-rich.js';
import { buildMessage, isDeadToken } from '../utils/push-message.js';

test('a tap target is written in the app\'s own words', () => {
  assert.equal(linkToUri({ target: 'sakha' }), 'hariharibol://sakha');
  assert.equal(linkToUri({ target: 'mantra', slug: 'maha-mantra' }), 'hariharibol://mantra?slug=maha-mantra');
  assert.equal(linkToUri(undefined), null);
});

test('a target that needs a value refuses to go without it', () => {
  assert.throws(() => linkToUri({ target: 'verse', book: 'gita' }), /chapter/);
  assert.throws(() => linkToUri({ target: 'nowhere' }), /Unknown/);
});

test('a verse link also carries the place in the daily sloka\'s own keys', async () => {
  const rich = await build({ link: { target: 'verse', book: 'bhagavat-gita', chapter: '2', verse: '47' } });
  assert.equal(rich.data.deeplink, 'hariharibol://verse?book=bhagavat-gita&chapter=2&verse=47');
  assert.equal(rich.data.bookSlug, 'bhagavat-gita');
  assert.equal(rich.data.chapterNumber, '2');
  assert.equal(rich.data.verseNumber, '47');
});

test('a pasted link must be https, and the style follows the picture', async () => {
  await assert.rejects(build({ image: 'http://example.com/a.jpg' }), /https/);
  const withPicture = await build({ image: 'https://example.com/a.jpg' });
  assert.equal(withPicture.image, 'https://example.com/a.jpg');
  assert.equal(withPicture.data.style, 'picture');
  assert.equal((await build({})).data.style, 'text');
  assert.equal((await build({ style: 'picture' })).data.style, 'text'); // nothing to show big
});

test('buttons are capped at two and each needs somewhere to go', async () => {
  const rich = await build({
    actions: [
      { label: 'Open Sakha', link: { target: 'sakha' } },
      { label: 'Read', link: { target: 'read' } },
      { label: 'Third', link: { target: 'reels' } },
    ],
  });
  const buttons = JSON.parse(rich.data.actions);
  assert.equal(buttons.length, 2);
  assert.equal(buttons[0].deeplink, 'hariharibol://sakha');
  assert.equal(rich.hasActions, true);
  await assert.rejects(build({ actions: [{ label: 'x', link: {} }] }), /somewhere/);
});

test('a plain push is a notification message with the picture on both platforms', () => {
  const m = buildMessage({ title: 't', body: 'b', image: 'https://x/y.jpg', data: { n: 1 } });
  assert.deepEqual(m.notification, { title: 't', body: 'b', imageUrl: 'https://x/y.jpg' });
  assert.equal(m.android.priority, 'high');
  assert.equal(m.android.notification.channelId, 'default');
  assert.equal(m.apns.payload.aps['mutable-content'], 1);
  assert.equal(m.apns.fcmOptions.imageUrl, 'https://x/y.jpg');
  assert.equal(m.data.n, '1');
});

test('a quiet push uses the quiet channel and normal priority', () => {
  const m = buildMessage({ title: 't', body: 'b', importance: 'quiet' });
  assert.equal(m.android.priority, 'normal');
  assert.equal(m.android.notification.channelId, 'updates');
  assert.equal(m.apns.payload.aps['mutable-content'], undefined);
});

test('with buttons Android gets data only, iOS an alert the extension finishes', () => {
  const m = buildMessage({ title: 't', body: 'b', image: 'https://x/y.jpg', hasActions: true, data: {} });
  assert.equal(m.notification, undefined);
  assert.equal(m.android.notification, undefined);
  assert.equal(m.data.title, 't');
  assert.equal(m.data.image, 'https://x/y.jpg');
  assert.deepEqual(m.apns.payload.aps.alert, { title: 't', body: 'b' });
  assert.equal(m.apns.payload.aps['mutable-content'], 1);
});

test('only a token FCM calls dead is dropped, never one refused over the message', () => {
  assert.equal(isDeadToken({ code: 'messaging/registration-token-not-registered', message: 'Requested entity was not found.' }), true);
  assert.equal(isDeadToken({ code: 'messaging/invalid-registration-token', message: 'Invalid registration token' }), true);
  assert.equal(
    isDeadToken({ code: 'messaging/invalid-argument', message: 'The registration token is not a valid FCM registration token' }),
    true,
    'a token that is not a token at all'
  );
  assert.equal(isDeadToken({ code: 'messaging/invalid-argument', message: 'Invalid value at message.android.notification.image' }), false);
  assert.equal(isDeadToken({ code: 'messaging/invalid-argument' }), false);
  assert.equal(isDeadToken({ code: 'messaging/internal-error', message: 'Internal error' }), false);
  assert.equal(isDeadToken(undefined), false);
});
