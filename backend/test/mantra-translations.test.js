// The seeded mantras' translations (prisma/seed/mantra-translations/): every
// reading language is covered, every mantra is in every file, and each string
// is written in its own language's script. No database — it reads the seed data.
//
//   npm test
//
// This stops the mechanical failures: a language left out, a mantra added in
// English only, Latin text pasted into a Tamil field, Bengali র in an Assamese
// file. It cannot say whether a translation is *good* — they are AI-drafted and
// not yet read by a native speaker (see mantra-translations/index.js).

import test from 'node:test';
import assert from 'node:assert/strict';

import { languages, mantras } from '../prisma/seed/data.js';
import { translations } from '../prisma/seed/mantra-translations/index.js';

// The Unicode block each language is written in. A new reading language needs a
// line here as well as a file in mantra-translations/.
const BLOCKS = {
  hi: [0x0900, 0x097f],
  mr: [0x0900, 0x097f],
  gu: [0x0a80, 0x0aff],
  bn: [0x0980, 0x09ff],
  as: [0x0980, 0x09ff],
  ta: [0x0b80, 0x0bff],
  te: [0x0c00, 0x0c7f],
  kn: [0x0c80, 0x0cff],
  or: [0x0b00, 0x0b7f],
  pa: [0x0a00, 0x0a7f],
  ml: [0x0d00, 0x0d7f],
};

// A sentence ends in a danda in these and a full stop in the rest
// (app/lib/l10n/README.md).
const DANDA = new Set(['hi', 'bn', 'or', 'pa', 'as']);

// Characters that belong to no script: spaces, ASCII digits and punctuation, the
// em dash and curly quotes the English text uses, and the danda (U+0964) that
// every one of these scripts shares.
const NEUTRAL = /^[0-9 ,;:.!?()'"\-—‘’“”।]$/u;

const FIELDS = ['name', 'meaning', 'purport'];

const slugs = mantras.map((m) => m.slug);
const english = Object.fromEntries(
  mantras.map((m) => [m.slug, m.translations.find((t) => t.languageCode === 'en')]),
);

/** Every character of `text` that does not belong in a `code` string. */
function strays(text, code) {
  const [from, to] = BLOCKS[code];
  return [...text].filter((ch) => {
    const point = ch.codePointAt(0);
    // Latin digits only: a number inside the language's own block is a native digit.
    if (point >= from && point <= to) return /\p{Nd}/u.test(ch);
    return !NEUTRAL.test(ch);
  });
}

test('every reading language except English has a file, and no other does', () => {
  const wanted = languages
    .filter((l) => l.isReadingLanguage !== false && l.code !== 'en')
    .map((l) => l.code)
    .sort();

  assert.deepEqual(
    Object.keys(translations).sort(),
    wanted,
    'mantra-translations/index.js must export exactly the reading languages other than en',
  );
  assert.deepEqual(Object.keys(BLOCKS).sort(), wanted, 'BLOCKS in this test is missing a language');
});

test('every seeded mantra has English prose to follow', () => {
  for (const slug of slugs) {
    assert.ok(english[slug]?.meaning, `${slug} has no English meaning`);
    assert.ok(english[slug]?.name || mantras.find((m) => m.slug === slug).name, `${slug} has no name`);
  }
});

for (const [code, entries] of Object.entries(translations)) {
  test(`${code}: has exactly the seeded mantras`, () => {
    assert.deepEqual(Object.keys(entries).sort(), [...slugs].sort());
  });

  test(`${code}: each entry has a name and meaning, and a purport where English has one`, () => {
    for (const slug of slugs) {
      const entry = entries[slug];
      assert.deepEqual(Object.keys(entry).sort(), [...FIELDS].sort(), `${slug}: fields`);

      for (const field of ['name', 'meaning']) {
        assert.equal(typeof entry[field], 'string', `${slug}.${field}`);
        assert.ok(entry[field].trim(), `${slug}.${field} is empty`);
      }

      if (english[slug].purport) {
        assert.equal(typeof entry.purport, 'string', `${slug}.purport should be written`);
        assert.ok(entry.purport.trim(), `${slug}.purport is empty`);
      } else {
        assert.equal(entry.purport, null, `${slug}.purport should be null, English has none`);
      }
    }
  });

  test(`${code}: names are all different`, () => {
    const names = slugs.map((slug) => entries[slug].name);
    assert.equal(new Set(names).size, names.length);
  });

  test(`${code}: every string is in the language's own script`, () => {
    for (const slug of slugs) {
      for (const field of FIELDS) {
        const text = entries[slug][field];
        if (text === null) continue;
        assert.deepEqual(strays(text, code), [], `${slug}.${field} has characters from another script`);
      }
    }
  });

  test(`${code}: sentences end in ${DANDA.has(code) ? 'a danda' : 'a full stop'}`, () => {
    const right = DANDA.has(code) ? '।' : '.';
    const wrong = DANDA.has(code) ? '.' : '।';

    for (const slug of slugs) {
      for (const field of FIELDS) {
        const text = entries[slug][field];
        if (text === null) continue;
        assert.ok(!text.includes(wrong), `${slug}.${field} uses "${wrong}"`);
        // A name is a title; only the prose ends in a mark.
        if (field !== 'name') assert.ok(text.trimEnd().endsWith(right), `${slug}.${field} should end in "${right}"`);
      }
    }
  });
}

test('Assamese uses ৰ and ৱ, never Bengali র', () => {
  for (const [slug, entry] of Object.entries(translations.as)) {
    for (const field of FIELDS) {
      assert.ok(!(entry[field] ?? '').includes('র'), `as ${slug}.${field} has Bengali র (U+09B0)`);
    }
  }
});

test('Bengali does not use the Assamese letters ৰ and ৱ', () => {
  for (const [slug, entry] of Object.entries(translations.bn)) {
    for (const field of FIELDS) {
      assert.ok(!/[ৰৱ]/u.test(entry[field] ?? ''), `bn ${slug}.${field} has an Assamese letter`);
    }
  }
});
