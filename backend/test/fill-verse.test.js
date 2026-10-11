// The rules for filling the scripture source from vedabase.io (Prabhupada):
// what counts as the same verse, what is missing, what is broken, and that
// nothing already good is changed. No network, no database, no bucket.
//
//   npm test

import test from 'node:test';
import assert from 'node:assert/strict';

import { synonymPairs } from '../scripts/lib/vedabase.js';
import {
  alignPairs,
  fillBgChapter,
  fillSbChapter,
  onlyAdditions,
  similarity,
  splitPairs,
  wordMeaningState,
} from '../scripts/lib/fill-verse.js';

const entry = (word, meaning, last) => `<span class="inline"><a href="/x"><em>${word}</em></a> — <span class="inline">${meaning}</span>${last ? '.' : '; '}</span>`;

test('synonymPairs reads entries from the markup, so a ";" inside a meaning is not a split', () => {
  const html = `<div>${entry('janma', 'birth; creation')}${entry('<a>x</a>-<em>ādi</em>', 'beginning', true)}</div>`;
  assert.deepEqual(synonymPairs(html), [
    { word: 'janma', meaning: 'birth; creation' },
    { word: 'x-ādi', meaning: 'beginning' },
  ]);
});

test('synonymPairs of nothing is nothing', () => {
  assert.deepEqual(synonymPairs(null), []);
  assert.deepEqual(synonymPairs(''), []);
});

test('similarity: the same verse spelled differently is close, another verse is not', () => {
  const scraped = 'karmaṇyevādhikāraste mā phaleṣu kadācana . mā karmaphalaheturbhūrmā te saṅgo.astvakarmaṇi';
  const bbt = 'karmaṇy evādhikāras te mā phaleṣu kadācana mā karma-phala-hetur bhūr mā te saṅgo ’stv akarmaṇi';
  const other = 'dharma-kṣetre kuru-kṣetre samavetā yuyutsavaḥ māmakāḥ pāṇḍavāś caiva kim akurvata sañjaya';
  assert.ok(similarity(scraped, bbt) > 0.85);
  assert.ok(similarity(scraped, other) < 0.5);
  assert.equal(similarity('', bbt), 0);
});

test('wordMeaningState tells empty, corrupt, unsplit and good apart', () => {
  assert.equal(wordMeaningState([]), 'empty');
  assert.equal(wordMeaningState(undefined), 'empty');
  assert.equal(wordMeaningState([{ raw: 'a—b; c—d' }]), 'blob');
  assert.equal(wordMeaningState([{ word: 'a', meaning: 'x'.repeat(401) }]), 'overlong');
  assert.equal(wordMeaningState([{ raw: 'y'.repeat(500) }]), 'overlong');
  assert.equal(wordMeaningState([{ word: 'a', meaning: 'b' }]), 'ok');
});

test('splitPairs gives each verse of a compound the words that are in it', () => {
  const pairs = [
    { word: 'rāma', meaning: 'Rāma' },
    { word: 'kṛṣṇa', meaning: 'Kṛṣṇa' },
    { word: 'hari', meaning: 'Hari' },
    { word: 'bola', meaning: 'chant' },
  ];
  const lists = splitPairs(pairs, ['rāma kṛṣṇa', 'hari bola']);
  assert.deepEqual(lists.map((l) => l.map((p) => p.word)), [['rāma', 'kṛṣṇa'], ['hari', 'bola']]);
});

test('splitPairs gives up (null) when there are fewer words than verses', () => {
  assert.equal(splitPairs([{ word: 'rāma', meaning: 'Rāma' }], ['rāma', 'hari']), null);
});

test('splitPairs still gives every verse a run of words when some words are not found in any verse', () => {
  const pairs = ['rāma', 'xxxx', 'yyyy', 'hari', 'zzzz'].map((word) => ({ word, meaning: word }));
  const lists = splitPairs(pairs, ['rāma kṛṣṇa', 'hari bola']);
  assert.equal(lists.length, 2);
  assert.ok(lists.every((l) => l.length > 0));
  assert.equal(lists.flat().length, 5);
  assert.equal(lists[0][0].word, 'rāma');
  assert.equal(lists[1].find((p) => p.word === 'hari').word, 'hari');
});

test('splitPairs keeps short common words with the verse around them', () => {
  const pairs = ['rāma', 'ca', 'kṛṣṇa', 'hari', 'ca', 'bola'].map((word) => ({ word, meaning: word }));
  const lists = splitPairs(pairs, ['rāma ca kṛṣṇa', 'hari ca bola']);
  assert.deepEqual(lists.map((l) => l.map((p) => p.word)), [['rāma', 'ca', 'kṛṣṇa'], ['hari', 'ca', 'bola']]);
});

// ---------- Bhagavad Gita ----------

const bgPage = (over = {}) => ({
  devanagari: null,
  transliteration: 'karmaṇy evādhikāras te mā phaleṣu kadācana',
  synonyms: null,
  synonymPairs: [{ word: 'karmaṇi', meaning: 'in prescribed duties' }, { word: 'eva', meaning: 'certainly' }],
  translation: 'You have a right to perform your prescribed duty.',
  purport: 'A long purport.',
  ...over,
});
const bgChapter = (saOver = {}, commentaries = []) => ({
  sa: { verses: [{ verseId: '1.2.47', verseNumber: 47, verseNumberEnd: null, sanskrit: 'x', transliteration: 'karmaṇyevādhikāraste mā phaleṣu kadācana', wordMeanings: [], ...saOver }] },
  en: { verses: [{ verseId: '1.2.47', commentaries }] },
});

test('fillBgChapter adds the word-by-word the source lacks, and nothing else when nothing else is missing', () => {
  const { sa, en } = bgChapter({}, [
    { translatorSlug: 'prabhupada', type: 'translation', language: 'en', text: 'T' },
    { translatorSlug: 'prabhupada', type: 'purport', language: 'en', text: 'P' },
  ]);
  const report = fillBgChapter({ sa, en, indexRanges: ['47'], pages: new Map([['47', bgPage()]]), rangeOf: () => '47' });
  assert.deepEqual(sa.verses[0].wordMeanings, [{ word: 'karmaṇi', meaning: 'in prescribed duties' }, { word: 'eva', meaning: 'certainly' }]);
  assert.equal(report.wordMeanings, 1);
  assert.equal(report.translation + report.purport, 0);
  assert.equal(en.verses[0].commentaries.length, 2);
});

test('fillBgChapter adds a missing Prabhupada translation and purport', () => {
  const { sa, en } = bgChapter();
  const report = fillBgChapter({ sa, en, indexRanges: ['47'], pages: new Map([['47', bgPage()]]), rangeOf: () => '47' });
  assert.deepEqual(en.verses[0].commentaries.map((c) => [c.type, c.text]), [
    ['translation', 'You have a right to perform your prescribed duty.'],
    ['purport', 'A long purport.'],
  ]);
  assert.equal(report.translation, 1);
  assert.equal(report.purport, 1);
});

test('fillBgChapter does not touch word-by-word a verse already has', () => {
  const have = [{ word: 'a', meaning: 'b' }];
  const { sa, en } = bgChapter({ wordMeanings: have });
  fillBgChapter({ sa, en, indexRanges: ['47'], pages: new Map([['47', bgPage()]]), rangeOf: () => '47' });
  assert.deepEqual(sa.verses[0].wordMeanings, have);
});

test('fillBgChapter writes nothing from a page that is a different verse', () => {
  const { sa, en } = bgChapter();
  const wrong = bgPage({
    transliteration: 'dharma-kṣetre kuru-kṣetre samavetā yuyutsavaḥ',
    synonymPairs: [{ word: 'dharma-kṣetre', meaning: 'in the place of pilgrimage' }, { word: 'kuru-kṣetre', meaning: 'in the place named Kurukṣetra' }],
    translation: 'Dhṛtarāṣṭra said: ...',
  });
  const report = fillBgChapter({ sa, en, indexRanges: ['47'], pages: new Map([['47', wrong]]), rangeOf: () => '47' });
  assert.deepEqual(sa.verses[0].wordMeanings, []);
  assert.deepEqual(en.verses[0].commentaries, []);
  assert.match(report.skipped.map((s) => s.reason).join(' '), /not aligned/);
  assert.match(report.skipped.map((s) => s.reason).join(' '), /does not match/);
});

test('alignPairs cuts the list by the Sanskrit verses, not by where vedabase ends its verse', () => {
  // The BBT prints one list for what the Sanskrit edition splits as two verses, with the
  // words in text order; the second line of verse 26 here is the first of the next verse.
  const verses = ['tatra apaśyat sthitān pārthaḥ pitṝn atha', 'śvaśurān suhṛdaḥ caiva tān samīkṣya sarvān'];
  const pairs = ['tatra', 'apaśyat', 'sthitān', 'pārthaḥ', 'pitṝn', 'atha', 'śvaśurān', 'suhṛdaḥ', 'ca', 'eva', 'tān', 'samīkṣya', 'sarvān'].map((word) => ({ word, meaning: word }));
  const { lists, found } = alignPairs(pairs, verses);
  assert.deepEqual(lists.map((l) => l.length), [6, 7]);
  assert.equal(lists[1][0].word, 'śvaśurān');
  assert.ok(found > 0.8);
});

test('alignPairs finds words through sandhi and does not lose its place to a stray early match', () => {
  // "parayā upetāḥ" is written "parayopetāḥ", "saṁnyasya" "sannyasya", and "ye" opens the text twice:
  // a walk that stops at the first stray hit would be ahead of the real words from then on.
  const verses = ['ye bhaktā mām upāsate parayopetāḥ', 'te me yuktatamā matāḥ sannyasya karmāṇi'];
  const pairs = ['ye', 'bhaktāḥ', 'mām', 'upāsate', 'parayā', 'upetāḥ', 'te', 'me', 'yuktatamāḥ', 'matāḥ', 'saṁnyasya', 'karmāṇi'].map((word) => ({ word, meaning: word }));
  const { lists, found } = alignPairs(pairs, verses);
  assert.deepEqual(lists.map((l) => l.map((p) => p.word)), [['ye', 'bhaktāḥ', 'mām', 'upāsate', 'parayā', 'upetāḥ'], ['te', 'me', 'yuktatamāḥ', 'matāḥ', 'saṁnyasya', 'karmāṇi']]);
  assert.equal(found, 1);
});

test('alignPairs reports a low share when the words are not this text', () => {
  const pairs = ['dharma-kṣetre', 'kuru-kṣetre', 'samavetāḥ'].map((word) => ({ word, meaning: word }));
  assert.ok(alignPairs(pairs, ['karmaṇy evādhikāras te mā phaleṣu', 'mā karma-phala-hetur bhūr']).found < 0.5);
});

test('alignPairs puts a one-letter word where the text has it, between its neighbours', () => {
  const verses = ['rāmaḥ kṛṣṇaḥ ca', 'harir bolaḥ'];
  const pairs = ['rāmaḥ', 'kṛṣṇaḥ', 'ca', 'hariḥ', 'bolaḥ'].map((word) => ({ word, meaning: word }));
  const { lists } = alignPairs(pairs, verses);
  assert.deepEqual(lists.map((l) => l.map((p) => p.word)), [['rāmaḥ', 'kṛṣṇaḥ', 'ca'], ['hariḥ', 'bolaḥ']]);
});

test('fillBgChapter reports a verse with no vedabase range instead of guessing one', () => {
  const { sa, en } = bgChapter();
  const report = fillBgChapter({ sa, en, indexRanges: [], pages: new Map(), rangeOf: () => undefined });
  assert.equal(report.skipped.length, 1);
  assert.deepEqual(sa.verses[0].wordMeanings, []);
});

// ---------- Srimad Bhagavatam ----------

const sbPage = (over = {}) => ({
  devanagari: 'ॐ नमो भगवते वासुदेवाय\nजन्माद्यस्य यतोऽन्वयात् ॥ १ ॥',
  transliteration: 'oṁ namo bhagavate vāsudevāya\njanmādy asya yato ’nvayād',
  synonyms: null,
  synonymPairs: [{ word: 'oṁ', meaning: 'O my Lord' }, { word: 'vāsudevāya', meaning: 'unto Vāsudeva' }],
  translation: 'O my Lord, Śrī Kṛṣṇa.',
  purport: null,
  ...over,
});
const sbChapter = (verse = {}) => ({
  verses: [{
    verseId: '2.1.1.1', verseNumber: 1, verseNumberEnd: null,
    transliteration: 'om namo bhagavate vasudevaya janmady asya yato ’nvayad',
    wordMeanings: [{ raw: 'om—O my Lord; namah—offering my obeisances' }],
    commentaries: [{ translatorSlug: 'prabhupada', type: 'translation', language: 'en', text: 'O my Lord, Sri Krsna.' }],
    ...verse,
  }],
});

test('fillSbChapter adds the Devanagari cantos 1-9 never had, on one line, and keeps their word-by-word', () => {
  const data = sbChapter();
  const report = fillSbChapter({ data, indexRanges: ['1'], pages: new Map([['1', sbPage()]]), plain: true });
  assert.equal(data.verses[0].sanskrit, 'ॐ नमो भगवते वासुदेवाय जन्माद्यस्य यतोऽन्वयात् ॥ १ ॥');
  assert.deepEqual(data.verses[0].wordMeanings, [{ raw: 'om—O my Lord; namah—offering my obeisances' }]);
  assert.equal(report.sanskrit, 1);
  assert.equal(report.replacedWordMeanings, 0);
});

test('fillSbChapter replaces the corrupt word-by-word of cantos 10-12 with clean pairs', () => {
  const data = sbChapter({ wordMeanings: [{ raw: 'oṁ — O my Lord ; Translation: ' + 'x'.repeat(600) }] });
  const report = fillSbChapter({ data, indexRanges: ['1'], pages: new Map([['1', sbPage()]]), plain: false });
  assert.deepEqual(data.verses[0].wordMeanings, [{ word: 'oṁ', meaning: 'O my Lord' }, { word: 'vāsudevāya', meaning: 'unto Vāsudeva' }]);
  assert.equal(report.replacedWordMeanings, 1);
});

test('fillSbChapter spells what it adds to cantos 1-9 without diacritics, like the rest of the canto', () => {
  const data = sbChapter({ wordMeanings: [] });
  fillSbChapter({ data, indexRanges: ['1'], pages: new Map([['1', sbPage()]]), plain: true });
  assert.deepEqual(data.verses[0].wordMeanings, [{ word: 'om', meaning: 'O my Lord' }, { word: 'vasudevaya', meaning: 'unto Vasudeva' }]);
});

test('fillSbChapter fills a missing transliteration and purport, vouched for by the translation it has', () => {
  const data = sbChapter({ transliteration: null });
  const page = sbPage({ purport: 'The purport.\n\nMore.' });
  const report = fillSbChapter({ data, indexRanges: ['1'], pages: new Map([['1', page]]), plain: true });
  assert.equal(data.verses[0].transliteration, 'om namo bhagavate vasudevaya janmady asya yato ’nvayad');
  assert.deepEqual(data.verses[0].commentaries.map((c) => c.type), ['translation', 'purport']);
  assert.equal(data.verses[0].commentaries[1].text, 'The purport.\nMore.');
  assert.equal(report.transliteration + report.purport, 2);
  assert.equal(report.translation, 0);
});

test('fillSbChapter fills a missing translation when the transliteration vouches for the page', () => {
  const data = sbChapter({ commentaries: [] });
  const report = fillSbChapter({ data, indexRanges: ['1'], pages: new Map([['1', sbPage()]]), plain: true });
  assert.equal(data.verses[0].commentaries[0].text, 'O my Lord, Sri Krsna.');
  assert.equal(report.translation, 1);
});

test('fillSbChapter fills nothing for a verse it has nothing to check against', () => {
  const data = sbChapter({ transliteration: null, commentaries: [] });
  const report = fillSbChapter({ data, indexRanges: ['1'], pages: new Map([['1', sbPage()]]), plain: true });
  assert.equal(data.verses[0].transliteration, null);
  assert.match(report.skipped[0].reason, /nothing to check/);
});

test('fillSbChapter does not give a compound page to a verse inside it', () => {
  const data = {
    verses: [
      { verseId: '2.1.1.1', verseNumber: 1, transliteration: 'oṁ namo bhagavate', wordMeanings: [], commentaries: [{ type: 'translation', translatorSlug: 'prabhupada', language: 'en', text: 'A' }] },
      { verseId: '2.1.1.2', verseNumber: 2, transliteration: 'vāsudevāya janmādy asya', wordMeanings: [], commentaries: [{ type: 'translation', translatorSlug: 'prabhupada', language: 'en', text: 'B' }] },
    ],
  };
  const page = sbPage({ transliteration: 'oṁ namo bhagavate\nvāsudevāya janmādy asya', synonymPairs: [{ word: 'oṁ', meaning: 'x' }, { word: 'vāsudevāya', meaning: 'y' }] });
  fillSbChapter({ data, indexRanges: ['1-2'], pages: new Map([['1-2', page]]), plain: false });
  assert.equal(data.verses[0].sanskrit, undefined);
  assert.deepEqual(data.verses[0].wordMeanings.map((w) => w.word), ['oṁ']);
  assert.deepEqual(data.verses[1].wordMeanings.map((w) => w.word), ['vāsudevāya']);
});

test('fillSbChapter checks a verse with no transliteration against its translation', () => {
  const data = sbChapter({ transliteration: null });
  const wrong = sbPage({ translation: 'Completely different words about another matter entirely.' });
  const report = fillSbChapter({ data, indexRanges: ['1'], pages: new Map([['1', wrong]]), plain: true });
  assert.equal(data.verses[0].sanskrit, undefined);
  assert.match(report.skipped[0].reason, /does not match/);
});

// ---------- the safety check ----------

test('onlyAdditions accepts a fill and rejects any change to existing text', () => {
  const before = [{ verseId: 'v1', sanskrit: 'S', transliteration: 'T', wordMeanings: [], commentaries: [{ translatorSlug: 'prabhupada', type: 'translation', language: 'en', text: 'X' }] }];
  const filled = structuredClone(before);
  filled[0].wordMeanings = [{ word: 'a', meaning: 'b' }];
  filled[0].commentaries.push({ translatorSlug: 'prabhupada', type: 'purport', language: 'en', text: 'P' });
  assert.deepEqual(onlyAdditions(before, filled), []);

  const reworded = structuredClone(filled);
  reworded[0].commentaries[0].text = 'changed';
  assert.match(onlyAdditions(before, reworded)[0], /translation changed/);

  const resung = structuredClone(filled);
  resung[0].sanskrit = 'other';
  assert.match(onlyAdditions(before, resung)[0], /sanskrit changed/);

  assert.match(onlyAdditions(before, [])[0], /verse count/);
});

test('onlyAdditions refuses to change word-by-word that was already good', () => {
  const good = [{ word: 'a', meaning: 'b' }];
  const before = [{ verseId: 'v1', wordMeanings: good, commentaries: [] }];
  const after = [{ verseId: 'v1', wordMeanings: [{ word: 'a', meaning: 'c' }], commentaries: [] }];
  assert.match(onlyAdditions(before, after)[0], /good word-by-word changed/);
});
