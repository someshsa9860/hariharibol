import test from 'node:test';
import assert from 'node:assert/strict';
import * as tokens from '../services/ai/tokens.js';

test('English and Devanagari are both counted', () => {
  assert.ok(tokens.countText('Hello, world') >= 2);
  assert.ok(tokens.countText('कर्मण्येवाधिकारस्ते मा फलेषु कदाचन') > tokens.countText('Hello, world'));
  assert.equal(tokens.countText(''), 0);
  assert.equal(tokens.countText(null), 0);
});

test('the estimate is never below the count', () => {
  const text = 'Chant the holy names and your heart will be cleansed.';
  assert.ok(tokens.estimate(text) >= tokens.countText(text));
});

test('messages cost their text plus framing', () => {
  const one = tokens.estimateMessages([{ role: 'user', content: 'hare krishna' }]);
  assert.equal(one, tokens.estimate('hare krishna') + tokens.MESSAGE_OVERHEAD);
});

test('a long unbroken run is counted quickly and a little high, never low', () => {
  const run = 'कृष्णायवासुदेवायहरयेपरमात्मने'.repeat(140).slice(0, 4000);
  const started = performance.now();
  const count = tokens.countText(run);
  assert.ok(performance.now() - started < 1000, 'counting 4,000 letters without a space must not block for seconds');
  assert.ok(count > 1700 && count < 2100, `count ${count}`);
  // Text around a long run is counted as before.
  assert.equal(tokens.countText(`hare krishna ${'!'.repeat(100)} hare rama`) > tokens.countText('hare krishna hare rama'), true);
});

test('truncation decodes back to the text across a cut run', () => {
  const run = `om ${'नमो'.repeat(60)} namah`;
  assert.equal(tokens.truncateToTokens(run, 10_000), run);
  const cut = tokens.truncateToTokens(run, 20);
  assert.ok(run.startsWith(cut.replace(/�+$/, '')));
});

test('truncation lands on a token boundary and keeps short text whole', () => {
  assert.equal(tokens.truncateToTokens('short', 100), 'short');
  const cut = tokens.truncateToTokens('word '.repeat(200), 10);
  assert.ok(tokens.countText(cut) <= 10);
  assert.ok(cut.length > 0);
  assert.equal(tokens.truncateToTokens('', 5), '');
});
