import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ||= 'test-secret-test-secret-test-secret-123';
const { normalise } = await import('../utils/book-reel-style.js');
const { DEFAULT_BOOK_REEL_STYLE } = await import('../config/book-reel.js');

test('an empty or garbage style falls back to the defaults', () => {
  assert.deepEqual(normalise({}), DEFAULT_BOOK_REEL_STYLE);
  assert.deepEqual(normalise({ colorTop: 'red', textScale: 'big', showLike: undefined }), DEFAULT_BOOK_REEL_STYLE);
});

test('values are clamped and flags are 0 or 1', () => {
  const style = normalise({ textScale: 9, minPageSeconds: 0, wordsPerSecond: 100, showComments: 0, showShare: 5, colorTop: '#112233' });
  assert.equal(style.textScale, 1.5);
  assert.equal(style.minPageSeconds, 2);
  assert.equal(style.wordsPerSecond, 8);
  assert.equal(style.showComments, 0);
  assert.equal(style.showShare, 1);
  assert.equal(style.colorTop, '#112233');
});

test('an image background without a picture is a gradient', () => {
  assert.equal(normalise({ background: 'image' }).background, 'gradient');
  assert.equal(normalise({ background: 'image', imageKey: 'hariharibol/x.jpg' }).background, 'image');
});
