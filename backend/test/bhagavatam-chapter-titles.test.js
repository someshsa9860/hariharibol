// The Bhagavatam's 335 translated chapter headings (prisma/seed/section-titles/bhagavatam/).
import test from 'node:test';
import assert from 'node:assert/strict';

import { bhagavatamChapters, bhagavatamEnglish, bhagavatamChapterTitles } from '../prisma/seed/section-titles/bhagavatam/index.js';
import { sectionTitles } from '../prisma/seed/section-titles/index.js';

const BLOCKS = {
  hi: [0x0900, 0x097f], mr: [0x0900, 0x097f], gu: [0x0a80, 0x0aff], bn: [0x0980, 0x09ff], as: [0x0980, 0x09ff],
  ta: [0x0b80, 0x0bff], te: [0x0c00, 0x0c7f], kn: [0x0c80, 0x0cff], or: [0x0b00, 0x0b7f], pa: [0x0a00, 0x0a7f],
  ml: [0x0d00, 0x0d7f],
};
const NEUTRAL = /^[0-9 ,;:.!?()'"\-—‘’“”।]$/u;

test('English has 12 cantos and 335 chapters', () => {
  assert.equal(Object.keys(bhagavatamEnglish).length, 12);
  assert.equal(Object.values(bhagavatamEnglish).flat().length, 335);
});

test('every reading language has a file', () => {
  assert.deepEqual(Object.keys(bhagavatamChapters).sort(), Object.keys(sectionTitles).sort());
});

for (const [code, file] of Object.entries(bhagavatamChapters)) {
  test(`${code}: every chapter is titled, in the language's own script`, () => {
    const [from, to] = BLOCKS[code];
    assert.deepEqual(Object.keys(file), Object.keys(bhagavatamEnglish));
    for (const [canto, list] of Object.entries(file)) {
      assert.equal(list.length, bhagavatamEnglish[canto].length, `canto ${canto} length`);
      for (const [i, title] of list.entries()) {
        const where = `canto ${canto} chapter ${i + 1}`;
        assert.equal(typeof title, 'string', where);
        assert.ok(title.trim() && title === title.trim(), `${where} is empty or padded`);
        const stray = [...title].filter((ch) => {
          const p = ch.codePointAt(0);
          return p >= from && p <= to ? /\p{Nd}/u.test(ch) : !NEUTRAL.test(ch);
        });
        assert.deepEqual(stray, [], `${where} has characters from another script`);
        assert.ok([...title].some((ch) => ch.codePointAt(0) >= from && ch.codePointAt(0) <= to), `${where} is not in the script`);
      }
    }
  });
}

test('Assamese uses ৰ and ৱ, never Bengali র; Bengali has neither', () => {
  for (const t of Object.values(bhagavatamChapters.as).flat()) assert.ok(!t.includes('র'), t);
  for (const t of Object.values(bhagavatamChapters.bn).flat()) assert.ok(!/[ৰৱ]/u.test(t), t);
});

test('lookup is by canto and chapter number', () => {
  assert.equal(Object.keys(bhagavatamChapterTitles(1, 1)).length, 11);
  assert.equal(bhagavatamChapterTitles(10, 90).hi, bhagavatamChapters.hi[10][89]);
  assert.deepEqual(bhagavatamChapterTitles(1, 20), {});
});
