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

test('truncation lands on a token boundary and keeps short text whole', () => {
  assert.equal(tokens.truncateToTokens('short', 100), 'short');
  const cut = tokens.truncateToTokens('word '.repeat(200), 10);
  assert.ok(tokens.countText(cut) <= 10);
  assert.ok(cut.length > 0);
  assert.equal(tokens.truncateToTokens('', 5), '');
});
