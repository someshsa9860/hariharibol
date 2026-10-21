// The pure part of scripts/translate-chapter-titles.js, with a fake model. No database.
import test from 'node:test';
import assert from 'node:assert/strict';

import { problemWith, translateHeadings } from '../scripts/lib/chapter-titles.js';

const headings = ['Questions by the Sages', 'Divinity and Divine Service'];

test('a list of the wrong length, an empty title or the wrong script is refused', () => {
  assert.match(problemWith('hi', headings, ['ऋषियों के प्रश्न']), /expected 2/);
  assert.match(problemWith('hi', headings, ['ऋषियों के प्रश्न', ' ']), /empty/);
  assert.match(problemWith('ta', headings, ['முனிவர்கள் கேள்வி', 'Divinity']), /not in the ta script/);
  assert.equal(problemWith('hi', headings, ['ऋषियों के प्रश्न', 'दिव्यता और सेवा']), null);
});

test('a bad answer is sent back with the reason, and the next good one is used', async () => {
  const answers = [['Questions'], ['ऋषियों के प्रश्न ', 'दिव्यता और सेवा']];
  const prompts = [];
  const ask = async ({ user }) => (prompts.push(user), { data: { titles: answers.shift() }, costUsd: 0.01 });
  const spent = { usd: 0, calls: 0 };
  const titles = await translateHeadings({ ask, code: 'hi', headings, canto: 1, spent });
  assert.deepEqual(titles, ['ऋषियों के प्रश्न', 'दिव्यता और सेवा']);
  assert.match(prompts[1], /rejected: expected 2 titles/);
  assert.equal(spent.calls, 2);
});

test('it gives up after the rounds are spent', async () => {
  const ask = async () => ({ data: { titles: [] } });
  await assert.rejects(translateHeadings({ ask, code: 'hi', headings, canto: 3, rounds: 2 }), /hi, canto 3/);
});
