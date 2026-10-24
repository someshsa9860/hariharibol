// The Claude translation pipeline, against a stub model and a temporary folder.
// No network, no S3, no API key.

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, test } from 'node:test';

import { TruncatedError, createClaude, messageRequest, thinkingSettings } from '../scripts/lib/claude-translate-client.js';
import { LANGUAGE_CODES } from '../scripts/lib/claude-translate-languages.js';
import { PROMPT_VERSION, SYSTEM_PROMPT, answerSchema, userPrompt } from '../scripts/lib/claude-translate-prompt.js';
import { MADE_BY_LABELS, lanesOf, mainStampOf, normalizePlan, translatedByOf } from '../scripts/lib/claude-translate-parts.js';
import { PROVIDER_IDS } from '../scripts/lib/translate-providers.js';
import { dryRun, hasTranslation, isCurrent, mergeEntry, run, status, verifyEntry, VerseFailedError } from '../scripts/lib/claude-translate-run.js';
import { DEFAULT_GROUP_BUDGET, chapterKey, saChapterKey, sourceHash, unitsFromChapter } from '../scripts/lib/claude-translate-source.js';
import {
  ConflictError, DEFAULT_VERSION, backupKey, checkpointKey, dirStore, langChapterKey, testStore, versionFrom,
} from '../scripts/lib/claude-translate-store.js';
import { assessLanguage, checkText, unassignedChars, validateLanguage } from '../scripts/lib/claude-translate-validate.js';
// The importer's own helpers: what the saved files must satisfy for a database import to take them as they are.
import { buildTranslationRows } from '../scripts/lib/commentaries.js';
import { normalizeWordMeanings } from '../scripts/lib/word-meanings.js';

/* ---------- fixtures ---------- */

const NATIVE = { hi: 'भगवान', mr: 'भगवंत', bn: 'ভগবান', ta: 'பகவான்', te: 'భగవంతుడు', kn: 'ಭಗವಂತ', ml: 'ഭഗവാൻ' };

/** Stands in for a translator: every word becomes a native-script word; punctuation and numbers stay. */
function fake(text, lang) {
  return text.split(/(\s+)/).map((tok) => {
    if (/^\s*$/.test(tok)) return tok;
    const [, pre, core, post] = tok.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u);
    return /\d/.test(core) || !core ? tok : `${pre}${NATIVE[lang]}${post}`;
  }).join('');
}

const TRANSLATION_1 = 'Dhṛtarāṣṭra said: O Sañjaya, what did my sons and the sons of Pāṇḍu do on the sacred field of Kurukṣetra?';
const PURPORT_1 = ['Bhagavad-gītā is the widely read theistic science summarized in the Gītā-māhātmya (Bg. 2.47) (the glorification of the Gītā).', 'It is said there that one should read Bhagavad-gītā very scrutinizingly with the help of a person who is a devotee of Śrī Kṛṣṇa.'];
const TRANSLATION_2 = 'Sañjaya said: O King, after looking over the army arranged in military formation by the sons of Pāṇḍu, King Duryodhana went to his teacher and spoke these words.';
const LINES_1 = ['dharmakṣetre kurukṣetre samavetā yuyutsavaḥ .', 'māmakāḥ pāṇḍavāścaiva kimakurvata sañjaya ||1-1||'];
const LINES_2 = ['sañjaya uvāca .', 'dṛṣṭvā tu pāṇḍavānīkaṃ vyūḍhaṃ duryodhanastadā ||1-2||'];

function chapterFile() {
  const verse = (n, translation, purport, transliteration) => ({
    verseId: `1.2.${n}`, chapterNumber: 2, verseNumber: n, verseNumberEnd: null, cantoNumber: null, bookNumber: 1, globalVerseNumber: 40 + n,
    transliteration,
    commentaries: [
      { translatorSlug: 'sivananda', type: 'translation', language: 'en', displayOrder: 1, text: 'SIVANANDA-MARKER' },
      { translatorSlug: 'prabhupada', type: 'translation', language: 'en', displayOrder: 1, text: translation },
      ...(purport ? [{ translatorSlug: 'prabhupada', type: 'purport', language: 'en', displayOrder: 2, text: purport.join('\n') }] : []),
    ],
  });
  return {
    meta: {
      bookNumber: 1, bookSlug: 'bhagavat-gita', language: 'en', chapterNumber: 2, cantoNumber: null, chapterName: 'सांख्ययोग',
      totalVerses: 2, globalVerseStart: 41, globalVerseEnd: 42, chapterTitleEn: 'Contents of the Gītā Summarized',
    },
    // Verse 1's Roman text is in the Sanskrit file too, so that one wins; verse 2 only has it here.
    verses: [verse(1, TRANSLATION_1, PURPORT_1, 'EN-FALLBACK-MARKER'), verse(2, TRANSLATION_2, null, LINES_2.join('\n'))],
  };
}

const WORDS = [{ word: 'dhṛtarāṣṭraḥ uvāca', meaning: 'King Dhṛtarāṣṭra said' }, { word: 'dharma-kṣetre', meaning: 'in the place of pilgrimage' }];
const WORDS_2 = [{ word: 'sañjayaḥ uvāca', meaning: 'Sañjaya said' }, { word: 'rājan', meaning: 'O King' }];
const ENGLISH = {
  '2.1': { translation: TRANSLATION_1, purport: PURPORT_1, words: WORDS, lines: LINES_1 },
  '2.2': { translation: TRANSLATION_2, purport: [], words: WORDS_2, lines: LINES_2 },
};
// The Sanskrit chapter file: only its word list and its Roman transliteration are ever read.
function saFile() {
  return {
    meta: {},
    verses: [
      { verseId: '1.2.1', sanskrit: 'SANSKRIT-MARKER', transliteration: LINES_1.join('\n'), wordMeanings: WORDS },
      { verseId: '1.2.2', sanskrit: 'SANSKRIT-MARKER', wordMeanings: [{ raw: 'sañjayaḥ uvāca—Sañjaya said; rājan—O King' }] },
    ],
  };
}
const getSource = async (key) => {
  assert.ok([chapterKey(2), saChapterKey(2)].includes(key), 'only chapter 2 is read in these tests');
  return key === chapterKey(2) ? chapterFile() : saFile();
};

const dirs = [];
function freshStore() {
  const dir = mkdtempSync(join(tmpdir(), 'claude-translate-'));
  dirs.push(dir);
  return { dir, store: dirStore(dir) };
}
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

const VERSION = '9.9-test';
const LANGS = ['hi', 'mr', 'ta'];
const cfg = (extra = {}) => ({
  model: 'claude-sonnet-5-5', effort: 'off', version: VERSION, langs: LANGS, chapters: [2], only: null, limit: 0, maxSpend: null,
  maxTokens: 64000, groupBudget: 40000, maxRounds: 4, force: false, retryDelayMs: 1, ...extra,
});

const quiet = () => {
  const events = [];
  return { events, say: () => {}, event: (name, fields) => events.push({ name, ...fields }) };
};

const usage = { inputTokens: 100, outputTokens: 200, cacheReadTokens: 0, cacheWriteTokens: 0, calls: 1 };

/** What a faithful model answers for one language of a unit — and rates 3 (perfect) all through. */
function answerFor(unit, lang) {
  return {
    transliteration: unit.transliteration.map((l) => fake(l, lang)),
    translation: fake(unit.translation, lang),
    purport: unit.purport.map((p) => fake(p, lang)),
    wordMeanings: unit.wordMeanings.map((w) => ({ word: fake(w.word, lang), meaning: fake(w.meaning, lang) })),
    correctness: { translation: 3, transliteration: 3, wordMeanings: 3, purport: 3 },
    note: '',
  };
}

/** A stub `ask`. `tweak(lang, answer, ctx)` may break an answer; `before(ctx)` may throw. */
function stub({ tweak, before } = {}) {
  const calls = [];
  const ask = async ({ user, schema }) => {
    const ref = user.match(/Bhagavad-gītā (\S+)/)[1];
    const langs = Object.keys(schema.properties);
    const ctx = { ref, langs, user, schema, n: calls.length };
    calls.push(ctx);
    await before?.(ctx);
    const data = {};
    for (const lang of langs) {
      const en = ENGLISH[ref];
      data[lang] = {
        transliteration: en.lines.map((l) => fake(l, lang)),
        translation: fake(en.translation, lang),
        purport: en.purport.map((p) => fake(p, lang)),
        wordMeanings: en.words.map((w) => ({ word: fake(w.word, lang), meaning: fake(w.meaning, lang) })),
        correctness: { translation: 3, transliteration: 3, wordMeanings: 3, purport: 3 },
        note: '',
      };
      tweak?.(lang, data[lang], ctx);
    }
    return { data, usage, costUsd: 0.5, stopReason: 'end_turn' };
  };
  return { ask, calls };
}

const readLang = (dir, lang) => JSON.parse(readFileSync(join(dir, langChapterKey(lang, 2)), 'utf8'));
const verseOf = (file, id) => file.verses.find((v) => v.verseId === id);

function seed(dir, key, body) {
  mkdirSync(dirname(join(dir, key)), { recursive: true });
  const text = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
  writeFileSync(join(dir, key), text);
  return text;
}

function listFiles(dir, prefix = '') {
  return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listFiles(dir, join(prefix, e.name)) : [join(prefix, e.name)]));
}

/** A Hindi chapter file as it is in the bucket today: other translators' rows and a Roman transliteration. */
function existingHindi() {
  const verse = (n) => ({
    verseId: `1.2.${n}`, globalVerseNumber: 40 + n, bookNumber: 1, chapterNumber: 2, verseNumber: n, verseNumberEnd: null, cantoNumber: null,
    transliteration: `ROMAN-OLD-${n}`,
    commentaries: [
      { translatorSlug: 'ramsukhdas', type: 'translation', language: 'hi', displayOrder: 1, text: `RAMSUKHDAS-${n}` },
      { translatorSlug: 'ramsukhdas', type: 'purport', language: 'hi', displayOrder: 2, text: `VYAKHYA-${n}` },
      { translatorSlug: 'tejomayananda', type: 'translation', language: 'hi', displayOrder: 3, text: `TEJO-${n}` },
    ],
  });
  return { meta: { bookNumber: 1, bookSlug: 'bhagavat-gita', language: 'hi', chapterNumber: 2, totalVerses: 3 }, verses: [verse(1), verse(3)] };
}

/* ---------- version and layout helpers ---------- */

describe('version and keys', () => {
  test('the version is TRANSLATION_VERSION, else the default 1.0-12-10-26', () => {
    assert.equal(DEFAULT_VERSION, '1.0-12-10-26');
    assert.equal(versionFrom(undefined), '1.0-12-10-26');
    assert.equal(versionFrom('  '), '1.0-12-10-26');
    assert.equal(versionFrom(' 2.0-01-02-27 '), '2.0-01-02-27');
  });

  test('a version that is not safe in a file name is refused', () => {
    for (const bad of ['a b', '../x', 'v/1', '-lead', 'x'.repeat(41)]) assert.throws(() => versionFrom(bad), /TRANSLATION_VERSION/);
  });

  test('chapter files sit beside the English one; the folder names never say claude', () => {
    assert.equal(langChapterKey('ta', 7), 'json/bhagavat-gita/ta/ch-7.json');
    assert.equal(chapterKey(7), 'json/bhagavat-gita/en/ch-7.json');
    assert.equal(checkpointKey('1.0-12-10-26'), 'json/reports/translate-bhagavat-gita-1.0-12-10-26.json');
    assert.ok(!/claude/i.test(backupKey(langChapterKey('hi', 2))));
    assert.match(backupKey(langChapterKey('hi', 2)), /^json-backup-\d{4}-\d{2}-\d{2}\/json\/bhagavat-gita\/hi\/ch-2\.json$/);
  });
});

/* ---------- the stores ---------- */

describe('stores', () => {
  test('a write is conditional on the tag that was read', async () => {
    const { store } = freshStore();
    const tag1 = await store.write('a/b.json', '{"n":1}', null);
    await assert.rejects(store.write('a/b.json', '{"n":2}', null), ConflictError, 'creating over an existing object');
    await assert.rejects(store.write('a/b.json', '{"n":2}', 'stale'), ConflictError, 'a stale tag');
    assert.equal((await store.read('a/b.json')).tag, tag1);
    const tag2 = await store.write('a/b.json', '{"n":2}', tag1);
    assert.notEqual(tag2, tag1);
    assert.deepEqual((await store.read('a/b.json')).json, { n: 2 });
    await assert.rejects(store.write('a/missing.json', '{}', tag1), ConflictError, 'a tag for an object that is not there');
    assert.equal(await store.read('a/none.json'), null);
  });

  test('a backup is an exact copy, and an earlier one from the same day is kept', async () => {
    const { store, dir } = freshStore();
    assert.equal(await store.backup('x.json'), null, 'nothing to back up');
    const original = seed(dir, 'x.json', '{"original":true}');
    const to = await store.backup('x.json');
    assert.equal(to, backupKey('x.json'));
    assert.equal(readFileSync(join(dir, to), 'utf8'), original);
    seed(dir, 'x.json', '{"changed":true}');
    await store.backup('x.json');
    assert.equal(readFileSync(join(dir, to), 'utf8'), original, 'the first backup of the day is the original');
  });

  test('a test store starts from the real chapter file, writes only under its root, and ignores the real bookkeeping', async () => {
    const { store: real, dir } = freshStore();
    const original = seed(dir, langChapterKey('hi', 2), existingHindi());
    seed(dir, checkpointKey(VERSION), { running: true, costUsd: 99, usage, completedVerses: 5 });
    const t = testStore(real, '_test/x/');

    const start = await t.read(langChapterKey('hi', 2));
    assert.equal(start.tag, null, 'the first write under the root is a create');
    assert.equal(await t.read(checkpointKey(VERSION)), null, 'the real checkpoint (and its running flag) does not leak in');

    await run({ store: t, getSource, ask: stub().ask, cfg: cfg({ langs: ['hi'] }), log: quiet() });
    assert.equal(readFileSync(join(dir, langChapterKey('hi', 2)), 'utf8'), original, 'the real file is untouched');
    assert.ok(existsSync(join(dir, '_test/x/', langChapterKey('hi', 2))));
    assert.ok(verseOf(JSON.parse(readFileSync(join(dir, '_test/x/', langChapterKey('hi', 2)), 'utf8')), '1.2.1').aiTranslation, 'it started from the real file and added to it');
    assert.ok(!readdirSync(dir).some((n) => n.startsWith('json-backup')), 'a throwaway run makes no backup');
    assert.equal(JSON.parse(readFileSync(join(dir, checkpointKey(VERSION)), 'utf8')).costUsd, 99, 'the real checkpoint is as it was');
  });
});

/* ---------- the validator ---------- */

describe('validator', () => {
  const source = { translation: TRANSLATION_1, purport: PURPORT_1 };
  const good = (lang) => ({ translation: fake(TRANSLATION_1, lang), purport: PURPORT_1.map((p) => fake(p, lang)) });

  test('accepts a faithful answer in every language', () => {
    for (const lang of LANGUAGE_CODES) {
      const r = validateLanguage(source, good(lang), lang);
      assert.deepEqual(r.errors, [], lang);
      assert.ok(r.ok);
    }
  });

  const rejects = (name, mutate, pattern, lang = 'hi') =>
    test(`rejects: ${name}`, () => {
      const answer = good(lang);
      mutate(answer);
      const r = validateLanguage(source, answer, lang);
      assert.equal(r.ok, false);
      assert.ok(r.errors.some((e) => pattern.test(e)), `wanted ${pattern}, got ${r.errors.join(' | ')}`);
    });

  rejects('English left in', (a) => { a.translation = TRANSLATION_1; }, /identical|script/);
  rejects('a dropped number', (a) => { a.purport[0] = a.purport[0].replace('2.47', ''); }, /numbers differ/);
  rejects('a changed number', (a) => { a.purport[0] = a.purport[0].replace('2.47', '2.48'); }, /numbers differ/);
  rejects('a code point Unicode has not assigned (an avagraha written U+0BC3)', (a) => { a.translation = a.translation.replace(/ /, '\u0bc3 '); }, /do not exist in Unicode \(U\+0BC3\)/, 'te');
  test('unassignedChars finds only unassigned code points inside the Indic blocks', () => {
    assert.deepEqual(unassignedChars('శాశ్వతో\u0bc3యం ఽ क ।'), ['\u0bc3']);
    assert.deepEqual(unassignedChars('a \u0378 outside the Indic blocks, and a plain ऽ'), []);
  });
  rejects('a missing parenthesis', (a) => { a.purport[0] = a.purport[0].replace('(', ''); }, /parentheses/);
  rejects('a missing quotation mark', (a) => { a.translation = `"${a.translation}`; }, /quotation/);
  rejects('a truncated answer', (a) => { a.purport[1] = 'भगवान भगवान.'; }, /too short/);
  rejects('a runaway answer', (a) => { a.translation = `${a.translation} ${a.translation} ${a.translation}`; }, /too long/);
  rejects('meta-text', (a) => { a.translation = `Here is the translation: ${a.translation}`; }, /meta-text/);
  rejects('markdown fences', (a) => { a.translation = `\`\`\`${a.translation}\`\`\``; }, /meta-text/);
  rejects('a missing paragraph', (a) => { a.purport.pop(); }, /paragraph/);
  rejects('an extra paragraph', (a) => { a.purport.push(a.purport[0]); }, /paragraph/);
  rejects('a line break inside a paragraph', (a) => { a.purport[0] = a.purport[0].replace(/ /, '\n'); }, /line break/);
  rejects('another language\'s script', (a) => { a.translation = fake(TRANSLATION_1, 'bn'); }, /script/);
  rejects('Hindi written as Marathi', (a) => {
    a.translation = 'हे संजय, माझे पुत्र आणि पांडूचे पुत्र काय करत होते, ते आहे आणि नाही आणि आहे आणि होते आहे आणि आहेत.';
  }, /reads as Marathi/);

  test('word counts are not measured on a short gloss, and a long paragraph keeps the full floor', () => {
    const english = (n) => Array(n).fill('lord').join(' ');
    const tamil = (n) => Array(n).fill('பகவான்').join(' ');
    const tooShort = (words, answerWords) => checkText(english(words), tamil(answerWords), 'ta', 'x').some((f) => /too short/.test(f.msg));
    assert.equal(tooShort(10, 3), false, 'a gloss of 6–14 words is not measured');
    assert.equal(tooShort(14, 2), false);
    assert.equal(tooShort(20, 8), false, '0.40× of 20 words: under the full floor of 0.5, over the lowered 0.35');
    assert.equal(tooShort(20, 5), true, '0.25× of 20 words');
    assert.equal(tooShort(149, 60), false, '0.40× of 149 words');
    assert.equal(tooShort(150, 60), true, '0.40× of 150 words is under the full floor');
    assert.equal(tooShort(200, 110), false, '0.55× of 200 words');
    assert.equal(tooShort(200, 10), true, 'a truncated paragraph');
  });

  test('digits in the target language are accepted as the same number', () => {
    const answer = good('bn');
    answer.purport[0] = answer.purport[0].replace('2.47', '২.৪৭');
    assert.equal(validateLanguage(source, answer, 'bn').ok, true);
  });

  test('a verse without a purport takes an empty array', () => {
    const r = validateLanguage({ translation: TRANSLATION_2, purport: [] }, { translation: fake(TRANSLATION_2, 'ta'), purport: [] }, 'ta');
    assert.equal(r.ok, true);
  });
});

/* ---------- accepted with warnings, scored 1 to 3 ---------- */

describe('assessLanguage — everything usable is kept, with warnings and a score', () => {
  const source = { translation: TRANSLATION_1, purport: PURPORT_1 };
  const good = (lang) => ({ translation: fake(TRANSLATION_1, lang), purport: PURPORT_1.map((p) => fake(p, lang)) });

  test('a clean answer is scored 3 on every part and carries no warning', () => {
    const r = assessLanguage(source, good('hi'), 'hi');
    assert.equal(r.usable, true);
    assert.deepEqual(r.warnings, []);
    assert.deepEqual(r.scores, { translation: 3, purport: 3 });
    assert.equal(r.correctness, 3);
    assert.equal(r.note, '');
  });

  test('an incomplete purport is kept with a warning and a 1 — it is not rejected', () => {
    const a = good('hi');
    a.purport.pop();
    const r = assessLanguage(source, a, 'hi');
    assert.equal(r.usable, true);
    assert.deepEqual(r.warnings, ['purport has 1 paragraph(s), the English has 2']);
    assert.deepEqual(r.scores, { translation: 3, purport: 1 });
    assert.equal(r.correctness, 1, 'the verse is as good as its weakest part');
    assert.equal(r.value.purport.length, 1, 'what came back is what is saved');
    assert.equal(validateLanguage(source, a, 'hi').ok, false, 'the strict view, used by --status --verify, still calls it an error');
  });

  test('missing names the parts the English has that came back with nothing in them', () => {
    const full = { translation: TRANSLATION_1, purport: PURPORT_1, transliteration: LINES_1, wordMeanings: WORDS };
    const answer = (extra) => ({ translation: fake(TRANSLATION_1, 'hi'), purport: PURPORT_1.map((p) => fake(p, 'hi')), transliteration: LINES_1.map((l) => fake(l, 'hi')), wordMeanings: WORDS.map((w) => ({ word: fake(w.word, 'hi'), meaning: fake(w.meaning, 'hi') })), ...extra });
    assert.deepEqual(assessLanguage(full, answer(), 'hi').missing, []);
    assert.deepEqual(assessLanguage(full, answer({ purport: [] }), 'hi').missing, ['purport']);
    assert.deepEqual(assessLanguage(full, answer({ purport: ['', ' '] }), 'hi').missing, ['purport'], 'blank paragraphs are nothing');
    assert.deepEqual(assessLanguage(full, answer({ wordMeanings: [{ word: '', meaning: '' }] }), 'hi').missing, ['wordMeanings']);
    assert.deepEqual(assessLanguage(full, answer({ transliteration: undefined, wordMeanings: null }), 'hi').missing, ['transliteration', 'wordMeanings']);
    assert.deepEqual(assessLanguage(full, answer({ purport: [PURPORT_1[0] && fake(PURPORT_1[0], 'hi')] }), 'hi').missing, [], 'a short purport is a warning, not a missing part');
    // The English having none of a part means there is nothing to miss.
    const bare = { translation: TRANSLATION_2, purport: [] };
    assert.deepEqual(assessLanguage(bare, { translation: fake(TRANSLATION_2, 'hi') }, 'hi').missing, []);
  });

  test('English left in the translation is a warning and a 1', () => {
    const a = good('hi');
    a.translation = TRANSLATION_1;
    const r = assessLanguage(source, a, 'hi');
    assert.equal(r.usable, true);
    assert.equal(r.scores.translation, 1);
    assert.match(r.warnings.join(), /translation: identical to the English/);
  });

  test('a minor finding scores 2', () => {
    const a = good('hi');
    a.translation = `"${a.translation}`;
    const r = assessLanguage(source, a, 'hi');
    assert.match(r.warnings.join(), /translation: double quotation marks do not match/);
    assert.deepEqual(r.scores, { translation: 2, purport: 3 });
    assert.equal(r.correctness, 2);
  });

  test('Claude\'s own rating lowers a clean part, and cannot raise a flagged one', () => {
    const rated = { ...good('mr'), correctness: { translation: 2, purport: 3 }, note: 'The second sentence is free.' };
    const r = assessLanguage(source, rated, 'mr');
    assert.deepEqual(r.scores, { translation: 2, purport: 3 });
    assert.deepEqual(r.warnings, ['translation: rated 2 by Claude']);
    assert.equal(r.note, 'The second sentence is free.');

    const flagged = { ...good('mr'), correctness: { translation: 3, purport: 3 } };
    flagged.purport.pop();
    assert.equal(assessLanguage(source, flagged, 'mr').scores.purport, 1, 'a 3 from the model does not hide a missing paragraph');
  });

  test('a missing or invalid rating counts as 3', () => {
    for (const correctness of [undefined, null, 'high', [], { translation: 9, purport: 2.5 }, { translation: 0, purport: '3' }]) {
      const r = assessLanguage(source, { ...good('ta'), correctness }, 'ta');
      assert.deepEqual(r.scores, { translation: 3, purport: 3 }, JSON.stringify(correctness));
      assert.deepEqual(r.warnings, []);
    }
  });

  test('only an answer with nothing to save is unusable', () => {
    for (const answer of [undefined, null, 'text', [], {}, { translation: '  ' }, { translation: 42 }]) {
      const r = assessLanguage(source, answer, 'hi');
      assert.equal(r.usable, false, JSON.stringify(answer));
      assert.equal(r.scores, null);
      assert.equal(r.value, null);
      assert.equal(r.problems.length, 1);
    }
    assert.match(assessLanguage(source, 'text', 'hi').problems[0], /not an object/);
    assert.match(assessLanguage(source, {}, 'hi').problems[0], /translation is empty or not a string/);
  });

  test('a verse with no purport scores only what it has, and drops paragraphs the model made up', () => {
    const none = { translation: TRANSLATION_2, purport: [] };
    const r = assessLanguage(none, { translation: fake(TRANSLATION_2, 'ta'), purport: ['பகவான் பகவான்'] }, 'ta');
    assert.deepEqual(Object.keys(r.scores), ['translation']);
    assert.deepEqual(r.value.purport, []);
    assert.deepEqual(r.warnings, ['the English has no purport — the paragraphs returned were left out']);
    assert.equal(r.correctness, 3);
  });
});

/* ---------- what is sent ---------- */

describe('source and prompt', () => {
  test('only Prabhupāda\'s translation and purport become a unit', () => {
    const { units } = unitsFromChapter(chapterFile(), saFile());
    assert.equal(units.length, 2);
    assert.equal(units[0].ref, '2.1');
    assert.equal(units[0].purport.length, 2);
    assert.deepEqual(units[1].purport, []);
  });

  test('the transliteration is read line by line, from the Sanskrit file first and the English file otherwise', () => {
    const { units } = unitsFromChapter(chapterFile(), saFile());
    assert.deepEqual(units[0].transliteration, LINES_1);
    assert.deepEqual(units[1].transliteration, LINES_2);
  });

  test('the transliteration is part of what the stored hash fingerprints', () => {
    const { units } = unitsFromChapter(chapterFile(), saFile());
    const changed = { ...units[0], transliteration: [...LINES_1.slice(0, 1), 'x'] };
    assert.notEqual(sourceHash(units[0]), sourceHash(changed));
  });

  test('the transliteration is sent; the Devanagari verse and other commentators are not', async () => {
    const { store } = freshStore();
    const { ask, calls } = stub();
    await run({ store, getSource, ask, cfg: cfg(), log: quiet() });
    assert.ok(calls.length >= 2);
    for (const c of calls) {
      assert.ok(!/SANSKRIT-MARKER|SIVANANDA-MARKER|EN-FALLBACK-MARKER/.test(c.user));
      assert.ok(c.schema.properties.hi.required.includes('transliteration'));
    }
    const first = calls.find((c) => c.ref === '2.1').user;
    assert.match(first, /<transliteration lines="2">\n<line n="1">dharmakṣetre kurukṣetre samavetā yuyutsavaḥ \.<\/line>\n<line n="2">māmakāḥ pāṇḍavāścaiva kimakurvata sañjaya \|\|1-1\|\|<\/line>\n<\/transliteration>/);
  });

  test('the word-by-word list is sent (word and English meaning), in order, and read from the Sanskrit file', () => {
    const { units } = unitsFromChapter(chapterFile(), saFile());
    assert.deepEqual(units[0].wordMeanings, WORDS);
    assert.deepEqual(units[1].wordMeanings, WORDS_2, 'the scrape\'s raw string form is split');
    const prompt = userPrompt(units[0], ['hi']);
    assert.match(prompt, /<word_meanings count="2">\n1\. dhṛtarāṣṭraḥ uvāca — King Dhṛtarāṣṭra said\n2\. dharma-kṣetre — in the place of pilgrimage/);
  });
});

describe('the instructions and the answer schema', () => {
  test('the instructions ask for Prabhupāda\'s words as they are, in native grammar and respect, and a 1-3 rating', () => {
    assert.equal(PROMPT_VERSION, '8');
    assert.match(SYSTEM_PROMPT, /PRABHUPĀDA'S WORDS, AS THEY ARE/);
    assert.match(SYSTEM_PROMPT, /NATIVE GRAMMAR, CLARITY AND RESPECT/);
    assert.match(SYSTEM_PROMPT, /CORRECTNESS RATING/);
    assert.match(SYSTEM_PROMPT, /1 = needs a second round/);
    assert.doesNotMatch(SYSTEM_PROMPT, /think/i, 'nothing in it asks the model to reason first — thinking is off');
  });

  test('each language\'s answer carries a 1-3 rating for every part, and a note', () => {
    const schema = answerSchema(['hi', 'ta']);
    assert.deepEqual(schema.required, ['hi', 'ta']);
    for (const lang of ['hi', 'ta']) {
      const o = schema.properties[lang];
      assert.deepEqual(o.required, ['translation', 'transliteration', 'wordMeanings', 'purport', 'correctness', 'note']);
      assert.deepEqual(o.properties.correctness.required, ['translation', 'transliteration', 'wordMeanings', 'purport']);
      for (const part of o.properties.correctness.required) assert.deepEqual(o.properties.correctness.properties[part], { type: 'integer', enum: [1, 2, 3] });
      assert.equal(o.properties.note.type, 'string');
    }
  });

  test('a retry names the languages that could not be used and why', () => {
    const { units } = unitsFromChapter(chapterFile(), saFile());
    const prompt = userPrompt(units[0], ['hi', 'ta'], { ta: ['translation is empty or not a string'] });
    assert.match(prompt, /An earlier attempt for these languages could not be used/);
    assert.match(prompt, /- ta: translation is empty or not a string/);
    assert.doesNotMatch(prompt, /- hi:/);
  });
});

describe('the request sent to Claude', () => {
  const body = (model, effort) => messageRequest({ model, effort, system: 'SYSTEM', user: 'USER', schema: { type: 'object' }, maxTokens: 1000 });

  test('Sonnet 5.5 cannot be sent "disabled"; its lowest setting is between_tools, stated with effort high', () => {
    const r = body('claude-sonnet-5-5', 'off');
    assert.deepEqual(r.thinking, { type: 'between_tools' });
    assert.equal(r.output_config.effort, 'high');
    assert.deepEqual(r.output_config.format, { type: 'json_schema', schema: { type: 'object' } });
    assert.equal(r.max_tokens, 1000);
    assert.deepEqual(r.messages, [{ role: 'user', content: 'USER' }]);
    assert.deepEqual(r.system, [{ type: 'text', text: 'SYSTEM', cache_control: { type: 'ephemeral' } }], 'the instructions are cached');
  });

  test('other models are switched off the way their own rules allow', () => {
    assert.deepEqual(body('claude-sonnet-5', 'off').thinking, { type: 'disabled' });
    assert.equal(body('claude-sonnet-5', 'off').output_config.effort, undefined);
    for (const model of ['claude-opus-5', 'claude-haiku-5-5']) {
      const r = body(model, 'off');
      assert.deepEqual([r.thinking, r.output_config.effort], [{ type: 'disabled' }, 'high'], model);
    }
    for (const model of ['claude-sonnet-4-5', 'claude-opus-4-1']) {
      const r = body(model, 'off');
      assert.equal('thinking' in r, false, `${model} only thinks when asked, so nothing is sent`);
      assert.equal(r.output_config.effort, undefined);
    }
  });

  test('a dated model id is treated like its family', () => {
    assert.deepEqual(body('claude-sonnet-5-5-20260915', 'off').thinking, { type: 'between_tools' });
  });

  test('a model that cannot turn thinking off says so, with what to do instead', () => {
    for (const model of ['claude-opus-5-5', 'claude-fable-5-1', 'claude-mythos-5', 'claude-something-new']) {
      assert.throws(() => thinkingSettings(model, 'off'), /Cannot turn thinking off.*--effort low/s, model);
    }
    assert.throws(() => createClaude({ apiKey: 'x', model: 'claude-opus-5-5' }), /Cannot turn thinking off/, 'caught before any verse is sent');
  });

  test('any other effort lets the model think adaptively at that level', () => {
    const r = body('claude-opus-5-5', 'low');
    assert.deepEqual(r.thinking, { type: 'adaptive' });
    assert.equal(r.output_config.effort, 'low');
    assert.doesNotThrow(() => createClaude({ apiKey: 'x', model: 'claude-opus-5-5', effort: 'low' }));
  });
});

describe('transliteration and word-by-word answers', () => {
  const { units } = unitsFromChapter(chapterFile(), saFile());
  const source = units[0];
  const good = (lang) => answerFor(source, lang);
  const assess = (answer, lang = 'hi') => assessLanguage(source, answer, lang);

  test('accepts a complete answer and returns it trimmed', () => {
    const r = validateLanguage(source, good('kn'), 'kn');
    assert.deepEqual(r.errors, []);
    assert.equal(r.value.wordMeanings.length, 2);
    assert.equal(r.value.transliteration.length, 2);
    assert.deepEqual(assess(good('kn'), 'kn').scores, { translation: 3, transliteration: 3, wordMeanings: 3, purport: 3 });
  });

  test('transliteration: the wrong number of lines, an empty line and a non-string are kept with a 1', () => {
    const fewer = good('ta');
    fewer.transliteration.pop();
    const r = assess(fewer, 'ta');
    assert.equal(r.usable, true);
    assert.match(r.warnings.join(), /transliteration has 1 line\(s\), the source has 2/);
    assert.equal(r.scores.transliteration, 1);
    assert.deepEqual(r.scores, { translation: 3, transliteration: 1, wordMeanings: 3, purport: 3 }, 'the other parts are not marked down for it');
    assert.equal(r.correctness, 1);
    assert.equal(r.value.transliteration.length, 1, 'what came back is what is saved');

    const empty = good('ta');
    empty.transliteration[0] = ' ';
    assert.match(assess(empty, 'ta').warnings.join(), /transliteration line 1: empty or not a string/);
    assert.equal(assess(empty, 'ta').scores.transliteration, 1);

    const notStrings = good('ta');
    notStrings.transliteration[0] = 5;
    assert.match(assess(notStrings, 'ta').warnings.join(), /transliteration is not an array of strings/);

    const wrongType = good('ta');
    wrongType.transliteration = 'one string';
    assert.match(assess(wrongType, 'ta').warnings.join(), /transliteration is missing or not an array of strings/);

    const missing = good('ta');
    delete missing.transliteration;
    const m = assess(missing, 'ta');
    assert.match(m.warnings.join(), /transliteration is missing or not an array of strings/);
    assert.equal(m.scores.transliteration, 1);
    assert.equal('transliteration' in m.value, false, 'nothing is saved for a part that did not come back');
  });

  test('transliteration left in Roman letters is a warning and a 1, and an error when strict', () => {
    const a = good('hi');
    a.transliteration[0] = LINES_1[0];
    const r = assess(a);
    assert.match(r.warnings.join(), /transliteration line 1: identical to the English/);
    assert.match(r.warnings.join(), /transliteration line 1: only \d+% of its letters are/);
    assert.equal(r.usable, true);
    assert.equal(r.scores.transliteration, 1);
    assert.equal(validateLanguage(source, a, 'hi').ok, false);
  });

  test('the verse number survives the change of script', () => {
    const a = good('mr');
    a.transliteration[1] = a.transliteration[1].replace('1-1', '1-2');
    assert.match(validateLanguage(source, a, 'mr').errors.join(), /transliteration line 2: numbers differ/);
    assert.equal(assess(a, 'mr').scores.transliteration, 1);
  });

  test('a list with the wrong number of entries is kept with a 1', () => {
    const a = good('hi');
    a.wordMeanings.pop();
    const r = assess(a);
    assert.match(r.warnings.join(), /wordMeanings has 1 entries, the English list has 2/);
    assert.equal(r.scores.wordMeanings, 1);
    assert.equal(r.value.wordMeanings.length, 1);
  });

  test('a missing list, an empty meaning and a line break are each found', () => {
    const missing = good('hi');
    delete missing.wordMeanings;
    const m = assess(missing);
    assert.match(m.warnings.join(), /wordMeanings is missing or not an array/);
    assert.equal(m.scores.wordMeanings, 1);
    assert.equal('wordMeanings' in m.value, false);

    const empty = good('hi');
    empty.wordMeanings[0].meaning = ' ';
    assert.match(assess(empty).warnings.join(), /word 1 meaning: empty or not a string/);
    assert.equal(assess(empty).scores.wordMeanings, 1);

    const broken = good('hi');
    broken.wordMeanings[1].word = 'a\nb';
    assert.match(assess(broken).warnings.join(), /word 2: word contains a line break/);
  });

  test('a word left in Roman letters is a warning and a 1, and an error when strict', () => {
    const a = good('hi');
    a.wordMeanings[1].word = 'dharma-kṣetre';
    const r = assess(a);
    assert.match(r.warnings.join(), /word 2 word: only \d+% of its letters are/);
    assert.equal(r.usable, true);
    assert.equal(r.scores.wordMeanings, 1);
    assert.equal(validateLanguage(source, a, 'hi').ok, false);
  });

  test('a wrong-length transliteration is accepted on the first call, with a warning and a 1', async () => {
    const { store, dir } = freshStore();
    const { ask, calls } = stub({ tweak: (lang, answer, ctx) => { if (ctx.n === 0 && lang === 'hi') answer.transliteration.pop(); } });
    await run({ store, getSource, ask, cfg: cfg({ only: '1.2.1', langs: ['hi', 'mr'] }), log: quiet() });
    assert.equal(calls.length, 1, 'no second round');
    const hi = verseOf(readLang(dir, 'hi'), '1.2.1');
    assert.equal(hi.transliteration.split('\n').length, 1, 'saved as it came back');
    assert.ok(hi.aiTranslation.warnings.some((w) => /transliteration has 1 line\(s\), the source has 2/.test(w)));
    assert.equal(hi.aiTranslation.partScores.transliteration, 1);
    assert.equal(hi.aiTranslation.correctness, 1);
    assert.equal(verseOf(readLang(dir, 'mr'), '1.2.1').aiTranslation.correctness, 3, 'the other language is not marked down');
  });

  test('a wrong-length word list is accepted on the first call, with a warning and a 1', async () => {
    const { store, dir } = freshStore();
    const { ask, calls } = stub({ tweak: (lang, answer, ctx) => { if (ctx.n === 0 && lang === 'hi') answer.wordMeanings.pop(); } });
    await run({ store, getSource, ask, cfg: cfg({ only: '1.2.1', langs: ['hi', 'mr'] }), log: quiet() });
    assert.equal(calls.length, 1, 'no second round');
    const hi = verseOf(readLang(dir, 'hi'), '1.2.1');
    assert.equal(hi.wordMeanings.length, 1);
    assert.ok(hi.aiTranslation.warnings.some((w) => /wordMeanings has 1 entries, the English list has 2/.test(w)));
    assert.equal(hi.aiTranslation.partScores.wordMeanings, 1);
    assert.equal(hi.aiTranslation.correctness, 1);
  });
});

/* ---------- a run ---------- */

describe('run', () => {
  test('writes one chapter file per language, laid out like the English one, and records progress', async () => {
    const { store, dir } = freshStore();
    const { ask, calls } = stub();
    const result = await run({ store, getSource, ask, cfg: cfg(), log: quiet() });

    assert.equal(result.stopReason, 'finished');
    assert.equal(result.done, 2);
    assert.equal(calls.length, 2, 'one call per verse when the languages fit together');

    assert.deepEqual(listFiles(dir).sort(), [
      'json/bhagavat-gita/hi/ch-2.json', 'json/bhagavat-gita/mr/ch-2.json', 'json/bhagavat-gita/ta/ch-2.json', checkpointKey(VERSION),
    ].sort());
    assert.ok(listFiles(dir).every((f) => !/claude/i.test(f)), 'no folder or file is named after claude');

    const { units } = unitsFromChapter(chapterFile(), saFile());
    for (const lang of LANGS) {
      const file = readLang(dir, lang);
      assert.equal(file.meta.language, lang);
      assert.equal(file.meta.chapterNumber, 2);
      assert.equal(file.meta.chapterTitleEn, undefined, 'the English chapter title is not carried over');
      assert.deepEqual(file.verses.map((v) => v.verseId), ['1.2.1', '1.2.2']);

      const v1 = verseOf(file, '1.2.1');
      assert.equal(v1.globalVerseNumber, 41);
      assert.equal(v1.transliteration, LINES_1.map((l) => fake(l, lang)).join('\n'), 'the verse in this language\'s script, one line per line');
      assert.equal(v1.wordMeanings.length, 2);
      assert.deepEqual(v1.commentaries.map((c) => [c.translatorSlug, c.type, c.language, c.displayOrder]), [
        ['prabhupada', 'translation', lang, 1], ['prabhupada', 'purport', lang, 2],
      ]);
      assert.equal(v1.commentaries[1].text.split('\n').length, 2, 'purport paragraphs kept, joined by a newline');
      for (const row of v1.commentaries) assert.deepEqual([row.translatedBy, row.version, row.correctness], ['claude', VERSION, 3], 'every row says who, which version and how correct');
      assert.deepEqual(
        (({ parts, ...rest }) => ({ ...rest, generatedAt: 'x', warnings: 'x' }))(v1.aiTranslation),
        {
          translatedBy: 'claude', provider: 'anthropic', model: 'claude-sonnet-5-5', effort: 'off', version: VERSION, promptVersion: PROMPT_VERSION, sourceHash: sourceHash(units[0]), generatedAt: 'x',
          correctness: 3, partScores: { translation: 3, transliteration: 3, wordMeanings: 3, purport: 3 }, warnings: 'x',
        },
        'no `note` key when Claude had nothing to say'
      );
      assert.deepEqual(Object.keys(v1.aiTranslation.parts), ['translation', 'transliteration', 'wordMeanings', 'purport'], 'each part has its own stamp');
      assert.equal(v1.aiTranslation.parts.purport.sourceHash.length, 16);
      assert.deepEqual(verifyEntry(v1, units[0], lang), []);
      const v2 = verseOf(file, '1.2.2');
      assert.equal(v2.commentaries.length, 1, 'no purport row when the verse has none');
      assert.deepEqual(v2.aiTranslation.partScores, { translation: 3, transliteration: 3, wordMeanings: 3 }, 'a part the English lacks is not scored');
    }

    const cp = await store.getJson(checkpointKey(VERSION));
    assert.equal(cp.version, VERSION);
    assert.equal(cp.completedVerses, 2);
    assert.equal(cp.running, false);
    assert.deepEqual(cp.lastCompleted.verseId, '1.2.2');
    assert.deepEqual(cp.lastCompleted.langs, LANGS);
    assert.equal(cp.usage.outputTokens, 400);
    assert.equal(cp.costUsd, 1);
  });

  test('an answer with nothing to save is asked again alone, with the reason, and the others are kept', async () => {
    const { store, dir } = freshStore();
    const { ask, calls } = stub({ tweak: (lang, a, ctx) => { if (lang === 'ta' && ctx.ref === '2.1' && ctx.n === 0) a.translation = '  '; } });
    await run({ store, getSource, ask, cfg: cfg({ only: '1.2.1' }), log: quiet() });

    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1].langs, ['ta']);
    assert.match(calls[1].user, /ta: translation is empty or not a string/);
    for (const lang of LANGS) assert.ok(hasTranslation(readLang(dir, lang), '1.2.1', lang), lang);
  });

  test('an incomplete answer is accepted at once, with a warning and a 1 — it is not asked again', async () => {
    const { store, dir } = freshStore();
    const { ask, calls } = stub({ tweak: (lang, a, ctx) => { if (lang === 'ta' && ctx.ref === '2.1') a.purport.pop(); } });
    await run({ store, getSource, ask, cfg: cfg({ only: '1.2.1' }), log: quiet() });

    assert.equal(calls.length, 1, 'no second round');
    const ta = verseOf(readLang(dir, 'ta'), '1.2.1');
    const purport = ta.commentaries.find((c) => c.type === 'purport');
    assert.equal(purport.text.split('\n').length, 1, 'the one paragraph that came back is saved');
    assert.ok(ta.aiTranslation.warnings.some((w) => /purport has 1 paragraph\(s\), the English has 2/.test(w)));
    assert.equal(ta.aiTranslation.partScores.purport, 1);
    assert.equal(ta.aiTranslation.correctness, 1, 'the verse is as good as its weakest part');
    assert.deepEqual(ta.commentaries.map((c) => [c.type, c.correctness]), [['translation', 3], ['purport', 1]]);
    assert.equal(verseOf(readLang(dir, 'hi'), '1.2.1').aiTranslation.correctness, 3, 'another language is not marked down');
  });

  test('a verse that never passes stops the run and saves nothing for it, in any language', async () => {
    const { store, dir } = freshStore();
    const { ask } = stub({ tweak: (lang, a, ctx) => { if (lang === 'mr' && ctx.ref === '2.2') a.translation = ''; } });
    await assert.rejects(
      run({ store, getSource, ask, cfg: cfg({ maxRounds: 3 }), log: quiet() }),
      (err) => err instanceof VerseFailedError && err.verseId === '1.2.2' && Object.keys(err.problems).join() === 'mr'
    );
    for (const lang of LANGS) {
      assert.deepEqual(readLang(dir, lang).verses.map((v) => v.verseId), ['1.2.1'], `${lang}: the earlier verse is saved, the failed one is not`);
    }
    const cp = await store.getJson(checkpointKey(VERSION));
    assert.equal(cp.running, false);
    assert.equal(cp.lastError.verseId, '1.2.2');
    assert.equal(cp.completedVerses, 1);
    assert.ok(cp.costUsd > 0.5, 'spend on the failed attempts is still counted');
  });

  test('content findings are accepted on the first try and kept as warnings on the verse', async () => {
    const { store, dir } = freshStore();
    const { ask, calls } = stub({ tweak: (lang, a) => { if (lang === 'ta') a.translation = 'பகவான் பகவான்'; } });
    await run({ store, getSource, ask, cfg: cfg({ only: '1.2.2' }), log: quiet() });
    assert.equal(calls.length, 1, 'no second round');
    const ta = verseOf(readLang(dir, 'ta'), '1.2.2');
    assert.ok(ta.aiTranslation.warnings.some((w) => /too short/.test(w)));
    assert.equal(ta.commentaries[0].text, 'பகவான் பகவான்', 'saved as Claude wrote it');
    assert.equal(ta.aiTranslation.correctness, 1);
    assert.equal(ta.commentaries[0].correctness, 1);
    assert.deepEqual(verseOf(readLang(dir, 'hi'), '1.2.2').aiTranslation.warnings, [], 'another language\'s verse carries only its own warnings');
  });

  test('Claude\'s own rating and note are saved with the verse', async () => {
    const { store, dir } = freshStore();
    const { ask, calls } = stub({
      tweak: (lang, a, ctx) => {
        if (lang === 'mr' && ctx.ref === '2.1') { a.correctness.purport = 2; a.note = 'Paragraph 2 is a free rendering.'; }
      },
    });
    await run({ store, getSource, ask, cfg: cfg({ only: '1.2.1' }), log: quiet() });
    assert.equal(calls.length, 1);
    const mr = verseOf(readLang(dir, 'mr'), '1.2.1');
    assert.equal(mr.aiTranslation.correctness, 2);
    assert.equal(mr.aiTranslation.partScores.purport, 2);
    assert.equal(mr.aiTranslation.note, 'Paragraph 2 is a free rendering.');
    assert.ok(mr.aiTranslation.warnings.includes('purport: rated 2 by Claude'));
    assert.deepEqual(mr.commentaries.map((c) => [c.type, c.correctness]), [['translation', 3], ['purport', 2]]);
    assert.equal('note' in verseOf(readLang(dir, 'hi'), '1.2.1').aiTranslation, false, 'no note, no key');
  });

  test('a part that comes back empty every time is saved without it, flagged 1 — and the file\'s own text there is not blanked', async () => {
    const { store, dir } = freshStore();
    seed(dir, langChapterKey('hi', 2), existingHindi());
    const { ask, calls } = stub({ tweak: (lang, a, ctx) => { if (lang === 'hi' && ctx.ref === '2.1') a.transliteration = []; } });
    await run({ store, getSource, ask, cfg: cfg({ only: '1.2.1', langs: ['hi'] }), log: quiet() });
    assert.equal(calls.length, 4, 'asked again until --max-rounds, then saved as it was');
    const hi = verseOf(readLang(dir, 'hi'), '1.2.1');
    assert.equal(hi.transliteration, 'ROMAN-OLD-1');
    assert.equal(hi.aiTranslation.partScores.transliteration, 1);
    assert.equal(hi.aiTranslation.correctness, 1);
  });

  test('a whole part left out is asked for again, and the complete answer is what is saved', async () => {
    const { store, dir } = freshStore();
    const cases = [
      ['purport', (a) => { a.purport = []; }, (v) => v.commentaries.some((c) => c.type === 'purport')],
      ['wordMeanings', (a) => { a.wordMeanings = []; }, (v) => v.wordMeanings?.length === 2],
      ['transliteration', (a) => { a.transliteration = ['', '']; }, (v) => v.transliteration?.split('\n').length === 2],
    ];
    for (const [part, spoil, present] of cases) {
      let first = true;
      const { ask, calls } = stub({ tweak: (lang, a) => { if (first) spoil(a); } });
      const tracking = async (req) => { const out = await ask(req); first = false; return out; };
      const events = [];
      await run({ store, getSource, ask: tracking, cfg: cfg({ only: '1.2.1', langs: ['hi'], force: true }), log: { say: () => {}, event: (name, f) => events.push({ name, ...f }) } });
      assert.equal(calls.length, 2, `${part}: one more call`);
      assert.match(calls[1].user, new RegExp(`"${part}" came back empty`), `${part}: the second try is told what was missing`);
      assert.ok(events.some((e) => e.name === 'incomplete' && e.missing.includes(part)));
      const hi = verseOf(readLang(dir, 'hi'), '1.2.1');
      assert.ok(present(hi), `${part} is in the saved verse`);
      assert.equal(hi.aiTranslation.correctness, 3, `${part}: nothing left to flag`);
      rmSync(join(dir, langChapterKey('hi', 2)));
    }
  });

  test('every item reaches the file: meaning, transliteration, word meanings and purport, with a score each', async () => {
    const { store, dir } = freshStore();
    const { ask, calls } = stub();
    await run({ store, getSource, ask, cfg: cfg({ only: '1.2.1', groupBudget: DEFAULT_GROUP_BUDGET }), log: quiet() });
    assert.equal(calls.length, 3, 'one call per language');
    for (const lang of LANGS) {
      const v = verseOf(readLang(dir, lang), '1.2.1');
      const row = (type) => v.commentaries.find((c) => c.translatorSlug === 'prabhupada' && c.type === type);
      assert.ok(row('translation').text, `${lang} meaning`);
      assert.equal(v.transliteration.split('\n').length, 2, `${lang} transliteration, one line per line`);
      assert.equal(v.wordMeanings.length, 2, `${lang} word meanings`);
      assert.equal(row('purport').text.split('\n').length, 2, `${lang} purport, one paragraph per line`);
      assert.deepEqual(Object.keys(v.aiTranslation.partScores).sort(), ['purport', 'translation', 'transliteration', 'wordMeanings']);
    }
  });

  test('invalid JSON from the model counts as a failed round', async () => {
    const { store, dir } = freshStore();
    let first = true;
    const calls = [];
    const ask = async ({ schema }) => {
      calls.push(Object.keys(schema.properties));
      if (first) {
        first = false;
        throw Object.assign(new Error('answer was not valid JSON'), { badJson: true, usage, costUsd: 0.1 });
      }
      const data = Object.fromEntries(Object.keys(schema.properties).map((l) => [l, { ...answerFor(unitsFromChapter(chapterFile(), saFile()).units[1], l) }]));
      return { data, usage, costUsd: 0.1, stopReason: 'end_turn' };
    };
    await run({ store, getSource, ask, cfg: cfg({ only: '1.2.2' }), log: quiet() });
    assert.equal(calls.length, 2);
    assert.ok(hasTranslation(readLang(dir, 'hi'), '1.2.2', 'hi'));
  });

  test('a call that runs out of room is split in half', async () => {
    const { store, dir } = freshStore();
    const { ask, calls } = stub({ before: (ctx) => { if (ctx.langs.length > 3) throw Object.assign(new TruncatedError('ran out of output room'), { usage, costUsd: 0.2 }); } });
    await run({ store, getSource, ask, cfg: cfg({ only: '1.2.1', langs: LANGUAGE_CODES }), log: quiet() });
    assert.deepEqual(calls.map((c) => c.langs.length), [7, 4, 2, 2, 3], '7 splits into 4+3; the 4 is still too big and splits again');
    for (const lang of LANGUAGE_CODES) assert.ok(existsSync(join(dir, langChapterKey(lang, 2))), lang);
  });

  test('a single language that does not fit is a hard error', async () => {
    const { store, dir } = freshStore();
    const { ask } = stub({ before: () => { throw Object.assign(new TruncatedError('ran out of output room'), { usage, costUsd: 0.2 }); } });
    await assert.rejects(run({ store, getSource, ask, cfg: cfg({ only: '1.2.1', langs: ['hi'] }), log: quiet() }), /raise --max-tokens/);
    assert.ok(!existsSync(join(dir, langChapterKey('hi', 2))));
  });

  test('by default each language is written in a call of its own', async () => {
    assert.equal(DEFAULT_GROUP_BUDGET, 1);
    const { store, dir } = freshStore();
    const { ask, calls } = stub();
    await run({ store, getSource, ask, cfg: cfg({ groupBudget: DEFAULT_GROUP_BUDGET }), log: quiet() });
    assert.deepEqual(calls.map((c) => c.langs), [['hi'], ['mr'], ['ta'], ['hi'], ['mr'], ['ta']], 'verse by verse, language by language');
    assert.ok(calls.every((c) => Object.keys(c.schema.properties).length === 1), 'a call\'s schema asks for one language only');
    assert.deepEqual(readLang(dir, 'ta').verses.map((v) => v.verseId), ['1.2.1', '1.2.2']);
    assert.equal(verseOf(readLang(dir, 'mr'), '1.2.1').aiTranslation.correctness, 3);
  });

  test('a language that fails alone is asked again alone, and the others of the verse are not sent again', async () => {
    const { store, dir } = freshStore();
    const { ask, calls } = stub({ tweak: (lang, a, ctx) => { if (lang === 'mr' && ctx.ref === '2.1' && ctx.n === 1) a.translation = ''; } });
    await run({ store, getSource, ask, cfg: cfg({ only: '1.2.1', groupBudget: DEFAULT_GROUP_BUDGET }), log: quiet() });
    assert.deepEqual(calls.map((c) => c.langs), [['hi'], ['mr'], ['ta'], ['mr']]);
    assert.match(calls[3].user, /mr: translation is empty or not a string/);
    for (const lang of LANGS) assert.ok(hasTranslation(readLang(dir, lang), '1.2.1', lang), lang);
  });

  test('a language group is packed to the output budget', async () => {
    const { store } = freshStore();
    const { ask, calls } = stub();
    await run({ store, getSource, ask, cfg: cfg({ only: '1.2.1', groupBudget: 200 }), log: quiet() });
    assert.ok(calls.length > 1, 'a tiny budget forces several calls');
    assert.equal(calls.flatMap((c) => c.langs).sort().join(), [...LANGS].sort().join());
  });

  test('resume: saved verses are skipped and not sent again', async () => {
    const { store } = freshStore();
    const first = stub();
    await run({ store, getSource, ask: first.ask, cfg: cfg({ limit: 1 }), log: quiet() });
    assert.equal(first.calls.length, 1);

    const second = stub();
    const result = await run({ store, getSource, ask: second.ask, cfg: cfg(), log: quiet() });
    assert.deepEqual(second.calls.map((c) => c.ref), ['2.2']);
    assert.equal(result.skipped, 1);
    assert.equal((await store.getJson(checkpointKey(VERSION))).completedVerses, 2);

    const third = stub();
    await run({ store, getSource, ask: third.ask, cfg: cfg(), log: quiet() });
    assert.equal(third.calls.length, 0, 'a finished job asks nothing');
  });

  test('a language added later is translated alone; the finished languages\' files are not rewritten', async () => {
    const { store, dir } = freshStore();
    await run({ store, getSource, ask: stub().ask, cfg: cfg({ langs: ['hi', 'mr'] }), log: quiet() });
    const hiBefore = readFileSync(join(dir, langChapterKey('hi', 2)), 'utf8');

    const second = stub();
    const result = await run({ store, getSource, ask: second.ask, cfg: cfg({ langs: ['hi', 'mr', 'ta'] }), log: quiet() });
    assert.deepEqual(second.calls.map((c) => [c.ref, c.langs]), [['2.1', ['ta']], ['2.2', ['ta']]], 'only Tamil is asked for');
    assert.equal(result.skipped, 0, 'a verse still missing a language is not counted as skipped');
    assert.equal(readFileSync(join(dir, langChapterKey('hi', 2)), 'utf8'), hiBefore);
    assert.equal(readLang(dir, 'ta').verses.length, 2);
  });

  test('a language\'s existing chapter file is merged into, not replaced, and backed up first', async () => {
    const { store, dir } = freshStore();
    const key = langChapterKey('hi', 2);
    const original = seed(dir, key, existingHindi());
    const untouched = existingHindi().verses[1];

    const log = quiet();
    await run({ store, getSource, ask: stub().ask, cfg: cfg({ langs: ['hi'] }), log });

    const file = readLang(dir, 'hi');
    assert.deepEqual(file.verses.map((v) => v.verseId), ['1.2.1', '1.2.2', '1.2.3'], 'the new verse goes in verse order');
    assert.deepEqual(file.verses[2], untouched, 'a verse the run did not translate is exactly as it was');
    assert.equal(file.meta.totalVerses, 3, 'the file\'s own meta is kept');

    const v1 = verseOf(file, '1.2.1');
    assert.deepEqual(v1.commentaries.slice(0, 3), existingHindi().verses[0].commentaries, 'other translators\' rows keep their text and order');
    assert.deepEqual(v1.commentaries.slice(3).map((c) => [c.translatorSlug, c.type, c.displayOrder, c.translatedBy]), [
      ['prabhupada', 'translation', 4, 'claude'], ['prabhupada', 'purport', 5, 'claude'],
    ], 'ours go after the last displayOrder');
    assert.equal(v1.transliteration, LINES_1.map((l) => fake(l, 'hi')).join('\n'), 'the Roman transliteration is replaced by the Devanagari one');
    assert.ok(v1.aiTranslation);

    const backup = join(dir, backupKey(key));
    assert.equal(readFileSync(backup, 'utf8'), original, 'the backup holds the original bytes');
    assert.equal(log.events.filter((e) => e.name === 'backup').length, 1, 'taken once, before the first change');
  });

  test('a file this pipeline already wrote is not backed up again', async () => {
    const { store, dir } = freshStore();
    const key = langChapterKey('hi', 2);
    seed(dir, key, existingHindi());
    await run({ store, getSource, ask: stub().ask, cfg: cfg({ langs: ['hi'], limit: 1 }), log: quiet() });
    const backup = join(dir, backupKey(key));
    const firstBackup = readFileSync(backup, 'utf8');

    const log = quiet();
    await run({ store, getSource, ask: stub().ask, cfg: cfg({ langs: ['hi'] }), log });
    assert.equal(log.events.filter((e) => e.name === 'backup').length, 0);
    assert.equal(readFileSync(backup, 'utf8'), firstBackup, 'still the original');
  });

  test('an unconfirmed backup stops the run before the file is touched', async () => {
    const { store, dir } = freshStore();
    const key = langChapterKey('hi', 2);
    const original = seed(dir, key, existingHindi());
    const noBackup = { ...store, backup: async () => { throw new Error('backup does not match the original'); } };
    await assert.rejects(run({ store: noBackup, getSource, ask: stub().ask, cfg: cfg({ langs: ['hi'] }), log: quiet() }), /backup does not match/);
    assert.equal(readFileSync(join(dir, key), 'utf8'), original);
  });

  test('a change made by someone else between the read and the write survives', async () => {
    const { store, dir } = freshStore();
    const key = langChapterKey('hi', 2);
    let injected = false;
    const racing = {
      ...store,
      async write(k, body, tag) {
        if (!injected && k === key) {
          injected = true;
          // Another process creates the file after this run found it missing.
          await store.write(k, JSON.stringify({ meta: { language: 'hi' }, verses: [{ verseId: '1.2.9', globalVerseNumber: 49, commentaries: [], mine: 'EXTERNAL' }] }), null);
        }
        return store.write(k, body, tag);
      },
    };
    const log = quiet();
    await run({ store: racing, getSource, ask: stub().ask, cfg: cfg({ langs: ['hi'] }), log });

    const file = readLang(dir, 'hi');
    assert.deepEqual(file.verses.map((v) => v.verseId), ['1.2.1', '1.2.2', '1.2.9']);
    assert.equal(verseOf(file, '1.2.9').mine, 'EXTERNAL');
    assert.ok(log.events.some((e) => e.name === 'save-conflict'));
    assert.ok(existsSync(join(dir, backupKey(key))), 'the file that appeared was backed up before ours went over it');
    assert.equal(JSON.parse(readFileSync(join(dir, backupKey(key)), 'utf8')).verses[0].mine, 'EXTERNAL');
  });

  test('a file that keeps changing under the run stops it', async () => {
    const { store } = freshStore();
    const always = { ...store, write: async (k) => { throw new ConflictError(k); } };
    await assert.rejects(run({ store: always, getSource, ask: stub().ask, cfg: cfg({ langs: ['hi'] }), log: quiet() }), /keeps changing/);
  });

  test('a transient write failure is retried', async () => {
    const { store, dir } = freshStore();
    let failed = 0;
    const flaky = { ...store, write: async (k, b, t) => { if (k.includes('/hi/') && failed++ < 2) throw new Error('socket hang up'); return store.write(k, b, t); } };
    const log = quiet();
    await run({ store: flaky, getSource, ask: stub().ask, cfg: cfg({ langs: ['hi'], only: '1.2.1' }), log });
    assert.equal(log.events.filter((e) => e.name === 'save-retry').length, 2);
    assert.ok(hasTranslation(readLang(dir, 'hi'), '1.2.1', 'hi'));
  });

  test('the run stops before the next verse when a save does not read back', async () => {
    const { store } = freshStore();
    const stale = { ...store, read: async (k) => { const r = await store.read(k); return r && k.includes('/hi/') ? { ...r, json: { ...r.json, verses: [] } } : r; } };
    const { ask, calls } = stub();
    await assert.rejects(run({ store: stale, getSource, ask, cfg: cfg({ langs: ['hi'] }), log: quiet() }), /does not read back/);
    assert.equal(calls.length, 1, 'verse 2 was never started');
    const cp = await store.getJson(checkpointKey(VERSION));
    assert.equal(cp.completedVerses, 0);
    assert.equal(cp.costUsd, 0.5, 'the spend on the verse that was not saved is still recorded');
  });

  test('an unwritable store fails before any Claude call', async () => {
    const { store } = freshStore();
    const readOnly = { ...store, put: async () => { throw new Error('AccessDenied'); } };
    const { ask, calls } = stub();
    await assert.rejects(run({ store: readOnly, getSource, ask, cfg: cfg(), log: quiet() }), /AccessDenied/);
    assert.equal(calls.length, 0);
  });

  test('a model error halts the run and leaves the verse for next time', async () => {
    const { store, dir } = freshStore();
    const { ask } = stub({ before: () => { throw new Error('Anthropic API 401: invalid x-api-key'); } });
    await assert.rejects(run({ store, getSource, ask, cfg: cfg(), log: quiet() }), /401/);
    assert.ok(!existsSync(join(dir, langChapterKey('hi', 2))));
    const cp = await store.getJson(checkpointKey(VERSION));
    assert.equal(cp.running, false);
    assert.match(cp.lastError.message, /401/);
  });

  test('--limit and --max-spend stop between verses', async () => {
    const a = freshStore();
    const r1 = await run({ store: a.store, getSource, ask: stub().ask, cfg: cfg({ limit: 1 }), log: quiet() });
    assert.equal(r1.stopReason, 'limit');
    assert.equal(r1.done, 1);

    const b = freshStore();
    const r2 = await run({ store: b.store, getSource, ask: stub().ask, cfg: cfg({ maxSpend: 0.4 }), log: quiet() });
    assert.equal(r2.stopReason, 'max-spend');
    assert.equal(r2.done, 1, 'the verse in hand is finished, the next is not started');
  });

  test('an abort stops cleanly without saving the verse in hand', async () => {
    const { store, dir } = freshStore();
    const controller = new AbortController();
    const { ask } = stub({ before: () => { controller.abort(); throw new Error('aborted'); } });
    const result = await run({ store, getSource, ask, cfg: cfg(), log: quiet(), signal: controller.signal });
    assert.equal(result.stopReason, 'interrupted');
    assert.ok(!existsSync(join(dir, langChapterKey('hi', 2))));
  });

  test('a live checkpoint blocks a second run of the same version unless --force', async () => {
    const { store } = freshStore();
    await store.put(checkpointKey(VERSION), JSON.stringify({ running: true, runner: 'pid 1', heartbeatAt: new Date().toISOString(), usage, costUsd: 0, completedVerses: 0 }));
    const { ask, calls } = stub();
    await assert.rejects(run({ store, getSource, ask, cfg: cfg(), log: quiet() }), /Another run looks active/);
    assert.equal(calls.length, 0);
    await run({ store, getSource, ask, cfg: cfg({ force: true }), log: quiet() });
    assert.equal(calls.length, 2);
  });

  test('logs carry ids, languages and tokens but never the model\'s text', async () => {
    const { store } = freshStore();
    const log = quiet();
    await run({ store, getSource, ask: stub().ask, cfg: cfg(), log });
    const text = JSON.stringify(log.events);
    assert.ok(log.events.some((e) => e.name === 'call' && e.verseId === '1.2.1' && e.outputTokens === 200));
    assert.ok(log.events.some((e) => e.name === 'saved' && e.lang === 'ta' && e.key === langChapterKey('ta', 2)));
    assert.deepEqual(log.events.find((e) => e.name === 'verse' && e.verseId === '1.2.1').correctness, { hi: 3, mr: 3, ta: 3 }, 'the verse event carries each language\'s score');
    assert.ok(!text.includes(NATIVE.hi), 'no translated text in the log');
  });
});

/* ---------- versions ---------- */

describe('versions', () => {
  test('every item carries the run\'s version, and each version has its own checkpoint and spend', async () => {
    const { store, dir } = freshStore();
    await run({ store, getSource, ask: stub().ask, cfg: cfg({ version: 'v1', limit: 1 }), log: quiet() });

    for (const lang of LANGS) {
      const v1 = verseOf(readLang(dir, lang), '1.2.1');
      assert.equal(v1.aiTranslation.version, 'v1');
      assert.ok(v1.commentaries.every((c) => c.version === 'v1'));
    }
    const cp1 = await store.getJson(checkpointKey('v1'));
    assert.equal(cp1.completedVerses, 1);
    assert.equal(cp1.costUsd, 0.5);
    assert.equal(await store.getJson(checkpointKey('v2')), null, 'another version has no checkpoint until it runs');
  });

  test('asking again for the version a language already has asks Claude nothing', async () => {
    const { store, dir } = freshStore();
    await run({ store, getSource, ask: stub().ask, cfg: cfg(), log: quiet() });
    const before = Object.fromEntries(LANGS.map((l) => [l, readFileSync(join(dir, langChapterKey(l, 2)), 'utf8')]));

    const again = stub();
    const log = quiet();
    const result = await run({ store, getSource, ask: again.ask, cfg: cfg(), log });
    assert.equal(again.calls.length, 0, 'nothing is sent to Claude');
    assert.equal(result.done, 0);
    assert.equal(result.skipped, 2);
    assert.equal(log.events.filter((e) => e.name === 'backup').length, 0, 'nothing is changed, so nothing is backed up');
    for (const l of LANGS) assert.equal(readFileSync(join(dir, langChapterKey(l, 2)), 'utf8'), before[l], `${l} is untouched`);

    const plan = await dryRun({ store, getSource, cfg: cfg() });
    assert.equal(plan.totals.todo, 0);
    assert.equal(plan.totals.outdated, 0);
    assert.equal(plan.totals.calls, 0);
    assert.deepEqual(plan.totals.byLang, { hi: 2, mr: 2, ta: 2 });
  });

  test('a new version translates again what an older one made, and keeps the older text in a backup first', async () => {
    const { store, dir } = freshStore();
    await run({ store, getSource, ask: stub().ask, cfg: cfg({ version: 'v1' }), log: quiet() });
    const v1 = Object.fromEntries(LANGS.map((l) => [l, readFileSync(join(dir, langChapterKey(l, 2)), 'utf8')]));

    const plan = await dryRun({ store, getSource, cfg: cfg({ version: 'v2' }) });
    assert.equal(plan.totals.todo, 2, 'both verses are to do under the new version');
    assert.equal(plan.totals.done, 0);
    assert.equal(plan.totals.outdated, 6, 'two verses in three languages were made under another version');
    assert.deepEqual(plan.totals.byLang, { hi: 0, mr: 0, ta: 0 }, 'none is up to date');
    assert.equal(plan.totals.calls, 2);

    const second = stub();
    const log = quiet();
    const result = await run({ store, getSource, ask: second.ask, cfg: cfg({ version: 'v2' }), log });
    assert.deepEqual(second.calls.map((c) => c.ref), ['2.1', '2.2']);
    assert.equal(result.done, 2);
    assert.equal(result.skipped, 0);

    for (const lang of LANGS) {
      for (const id of ['1.2.1', '1.2.2']) {
        const verse = verseOf(readLang(dir, lang), id);
        assert.equal(verse.aiTranslation.version, 'v2', `${lang} ${id}`);
        assert.ok(verse.commentaries.every((c) => c.version === 'v2'), `${lang} ${id} rows`);
        assert.equal(verse.commentaries.filter((c) => c.type === 'translation').length, 1, 'replaced, not added beside the old one');
      }
      assert.equal(readFileSync(join(dir, backupKey(langChapterKey(lang, 2))), 'utf8'), v1[lang], `${lang}: the backup holds the file as v1 left it`);
    }
    assert.equal(log.events.filter((e) => e.name === 'backup').length, 3, 'one backup per file, before its first change');

    const cp2 = await store.getJson(checkpointKey('v2'));
    assert.equal(cp2.completedVerses, 2);
    assert.equal(cp2.costUsd, 1);
    assert.equal((await store.getJson(checkpointKey('v1'))).completedVerses, 2, 'the older version\'s bookkeeping is left as it was');

    const s = await status({ store, getSource, cfg: cfg({ version: 'v2' }) });
    assert.deepEqual(s.versions, { v2: { hi: 2, mr: 2, ta: 2 } });
    const after = await dryRun({ store, getSource, cfg: cfg({ version: 'v2' }) });
    assert.equal(after.totals.todo, 0, 'and now v2 has nothing left');
  });

  test('a run for a new version that stops part-way carries on with what is still on the old one', async () => {
    const { store, dir } = freshStore();
    await run({ store, getSource, ask: stub().ask, cfg: cfg({ version: 'v1' }), log: quiet() });
    const first = await run({ store, getSource, ask: stub().ask, cfg: cfg({ version: 'v2', limit: 1 }), log: quiet() });
    assert.equal(first.stopReason, 'limit');
    assert.equal(verseOf(readLang(dir, 'hi'), '1.2.1').aiTranslation.version, 'v2');
    assert.equal(verseOf(readLang(dir, 'hi'), '1.2.2').aiTranslation.version, 'v1', 'the second verse is still on the old version');

    const plan = await dryRun({ store, getSource, cfg: cfg({ version: 'v2' }) });
    assert.equal(plan.totals.todo, 1);
    assert.equal(plan.totals.outdated, 3);
    assert.deepEqual(plan.totals.byLang, { hi: 1, mr: 1, ta: 1 });

    const rest = stub();
    const result = await run({ store, getSource, ask: rest.ask, cfg: cfg({ version: 'v2' }), log: quiet() });
    assert.deepEqual(rest.calls.map((c) => c.ref), ['2.2'], 'only the verse not yet on v2 is asked for');
    assert.equal(result.skipped, 1);
    for (const lang of LANGS) for (const id of ['1.2.1', '1.2.2']) assert.equal(verseOf(readLang(dir, lang), id).aiTranslation.version, 'v2');
  });

  test('a language that is only partly on the version is finished alone', async () => {
    const { store } = freshStore();
    await run({ store, getSource, ask: stub().ask, cfg: cfg({ version: 'v1', langs: ['hi', 'mr'] }), log: quiet() });
    await run({ store, getSource, ask: stub().ask, cfg: cfg({ version: 'v2', langs: ['hi'] }), log: quiet() });

    const next = stub();
    await run({ store, getSource, ask: next.ask, cfg: cfg({ version: 'v2', langs: ['hi', 'mr', 'ta'] }), log: quiet() });
    assert.deepEqual(next.calls.map((c) => [c.ref, c.langs]), [['2.1', ['mr', 'ta']], ['2.2', ['mr', 'ta']]], 'Hindi is already on v2; Marathi is outdated and Tamil is new');
  });

  test('a translator\'s own text is not replaced, whatever the version', async () => {
    const { store, dir } = freshStore();
    const own = { translatorSlug: 'prabhupada', type: 'translation', language: 'hi', displayOrder: 0, text: 'HUMAN-TRANSLATION' };
    const original = seed(dir, langChapterKey('hi', 2), mergeEntry(existingHindi(), { verseId: '1.2.1', globalVerseNumber: 41, commentaries: [own] }));

    const plan = await dryRun({ store, getSource, cfg: cfg({ langs: ['hi'], version: 'v7' }) });
    assert.equal(plan.totals.todo, 1, 'only the verse nobody translated');
    assert.equal(plan.totals.outdated, 0, 'a person\'s text is not "outdated"');

    const { ask, calls } = stub();
    await run({ store, getSource, ask, cfg: cfg({ langs: ['hi'], version: 'v7' }), log: quiet() });
    assert.deepEqual(calls.map((c) => c.ref), ['2.2']);
    const kept = verseOf(readLang(dir, 'hi'), '1.2.1');
    assert.equal(kept.commentaries.find((c) => c.translatorSlug === 'prabhupada').text, 'HUMAN-TRANSLATION');
    assert.equal(kept.aiTranslation, undefined);
    assert.equal(JSON.parse(readFileSync(join(dir, backupKey(langChapterKey('hi', 2))), 'utf8')).verses.length, JSON.parse(original).verses.length, 'the original was backed up before the new verse went in');
  });

  test('status lists what is saved whichever version made it, so the versions found can be compared', async () => {
    const { store } = freshStore();
    await run({ store, getSource, ask: stub().ask, cfg: cfg({ version: 'v1', limit: 1 }), log: quiet() });
    const s = await status({ store, getSource, cfg: cfg({ version: 'v2' }) });
    assert.deepEqual(s.versions, { v1: { hi: 1, mr: 1, ta: 1 } });
    assert.deepEqual(s.rows[0].byLang, { hi: 1, mr: 1, ta: 1 }, 'saved, though not by v2');
    assert.equal(s.rows[0].done, 1);
  });
});

/* ---------- merging ---------- */

describe('mergeEntry and hasTranslation', () => {
  test('merging does not change the file it is given', () => {
    const file = existingHindi();
    const before = JSON.stringify(file);
    const entry = { verseId: '1.2.1', globalVerseNumber: 41, transliteration: 'x', commentaries: [{ translatorSlug: 'prabhupada', type: 'translation', language: 'hi', displayOrder: 0, text: 't' }], aiTranslation: {} };
    const merged = mergeEntry(file, entry);
    assert.equal(JSON.stringify(file), before);
    assert.notEqual(JSON.stringify(merged), before);
  });

  test('re-merging replaces only Prabhupāda\'s rows in that language', () => {
    const row = (type, text) => ({ translatorSlug: 'prabhupada', type, language: 'hi', displayOrder: 0, text });
    const file = existingHindi();
    const once = mergeEntry(file, { verseId: '1.2.1', globalVerseNumber: 41, commentaries: [row('translation', 'first')] });
    const twice = mergeEntry(once, { verseId: '1.2.1', globalVerseNumber: 41, commentaries: [row('translation', 'second')] });
    const rows = verseOf(twice, '1.2.1').commentaries;
    assert.equal(rows.filter((c) => c.translatorSlug === 'prabhupada').length, 1);
    assert.equal(rows.find((c) => c.translatorSlug === 'prabhupada').text, 'second');
    assert.equal(rows.filter((c) => c.translatorSlug !== 'prabhupada').length, 3);
  });

  test('"done" means a Prabhupāda translation row in that language, whoever made it', () => {
    const file = existingHindi();
    assert.equal(hasTranslation(file, '1.2.1', 'hi'), false, 'other translators do not count');
    assert.equal(hasTranslation(null, '1.2.1', 'hi'), false);
    const merged = mergeEntry(file, { verseId: '1.2.1', globalVerseNumber: 41, commentaries: [{ translatorSlug: 'prabhupada', type: 'translation', language: 'hi', displayOrder: 0, text: 't' }] });
    assert.equal(hasTranslation(merged, '1.2.1', 'hi'), true);
    assert.equal(hasTranslation(merged, '1.2.1', 'mr'), false, 'a Hindi row is not a Marathi one');
    assert.equal(hasTranslation(merged, '1.2.3', 'hi'), false);
  });

  test('"current" is the same version, or text Claude did not make', () => {
    const row = { translatorSlug: 'prabhupada', type: 'translation', language: 'hi', displayOrder: 0, text: 't' };
    const madeBy = (version) => mergeEntry(existingHindi(), { verseId: '1.2.1', globalVerseNumber: 41, commentaries: [row], aiTranslation: { translatedBy: 'claude', version } });
    assert.equal(isCurrent(madeBy('v1'), '1.2.1', 'hi', 'v1'), true);
    assert.equal(isCurrent(madeBy('v1'), '1.2.1', 'hi', 'v2'), false, 'made under another version: outdated');
    assert.equal(isCurrent(mergeEntry(existingHindi(), { verseId: '1.2.1', globalVerseNumber: 41, commentaries: [row] }), '1.2.1', 'hi', 'v2'), true, 'a translator\'s own text is never outdated');
    assert.equal(isCurrent(madeBy('v1'), '1.2.1', 'mr', 'v1'), false, 'a Hindi row is not a Marathi one');
    assert.equal(isCurrent(madeBy('v1'), '1.2.3', 'hi', 'v1'), false, 'nothing saved for that verse');
    assert.equal(isCurrent(null, '1.2.1', 'hi', 'v1'), false);
  });
});

/* ---------- dry run and status ---------- */

describe('the saved file against the English one, and the importer', () => {
  test('a saved verse has every field the English verse has, and its rows are the importer\'s own shape', async () => {
    const { store, dir } = freshStore();
    const { ask } = stub();
    await run({ store, getSource, ask, cfg: cfg({ only: '1.2.1' }), log: quiet() });
    const english = chapterFile().verses[0];
    for (const lang of LANGS) {
      const file = readLang(dir, lang);
      assert.equal(file.meta.language, lang);
      assert.equal(file.meta.chapterNumber, 2);
      const v = verseOf(file, '1.2.1');
      for (const key of Object.keys(english)) assert.ok(key in v, `${lang}: the English verse has "${key}"`);
      assert.equal(typeof v.transliteration, 'string', 'one string, lines joined by a line break, as in the English file');
      for (const c of v.commentaries) {
        for (const key of Object.keys(english.commentaries[1])) assert.ok(key in c, `${lang} ${c.type}: the English row has "${key}"`);
        assert.equal(c.translatorSlug, 'prabhupada');
        assert.equal(c.language, lang);
      }
    }
  });

  test('the importer\'s buildTranslationRows turns the saved rows into one Prabhupāda row per language', async () => {
    const { store, dir } = freshStore();
    const { ask } = stub();
    await run({ store, getSource, ask, cfg: cfg({ only: '1.2.1' }), log: quiet() });
    const translatorBySlug = new Map([['prabhupada', { id: 'T-PRABHUPADA' }]]);
    for (const lang of LANGS) {
      const v = verseOf(readLang(dir, lang), '1.2.1');
      const skipped = new Map();
      const rows = buildTranslationRows(v.commentaries, translatorBySlug, skipped);
      assert.equal(skipped.size, 0);
      assert.equal(rows.length, 1);
      assert.deepEqual(rows[0], {
        translatorId: 'T-PRABHUPADA', languageCode: lang, type: 'TRANSLATION',
        meaning: v.commentaries[0].text, purport: v.commentaries[1].text,
      });
      assert.deepEqual(normalizeWordMeanings(v.wordMeanings), v.wordMeanings, 'word meanings are already the { word, meaning } list the importer expects');
    }
  });

  test('a verse with no purport saves one translation row and a null purport', async () => {
    const { store, dir } = freshStore();
    const { ask } = stub();
    await run({ store, getSource, ask, cfg: cfg({ only: '1.2.2', langs: ['mr'] }), log: quiet() });
    const v = verseOf(readLang(dir, 'mr'), '1.2.2');
    assert.deepEqual(v.commentaries.map((c) => c.type), ['translation']);
    const [row] = buildTranslationRows(v.commentaries, new Map([['prabhupada', { id: 'T' }]]), new Map());
    assert.equal(row.purport, null);
    assert.equal(v.aiTranslation.partScores.purport, undefined, 'a part the English lacks is not scored');
  });
});

describe('dry run and status', () => {
  test('dry run counts what is left per language and writes nothing', async () => {
    const { store, dir } = freshStore();
    const before = await dryRun({ store, getSource, cfg: cfg() });
    assert.equal(before.totals.verses, 2);
    assert.equal(before.totals.todo, 2);
    assert.deepEqual(before.totals.byLang, { hi: 0, mr: 0, ta: 0 });
    assert.ok(before.totals.calls >= 2);
    assert.ok(before.totals.outTokens > 0 && before.costFloor > 0);
    assert.ok(before.totals.systemTokens > 0, 'the instructions every call carries are counted apart from the verse');
    assert.deepEqual(readdirSync(dir), [], 'no checkpoint, no chapter file');

    await run({ store, getSource, ask: stub().ask, cfg: cfg({ limit: 1, langs: ['hi'] }), log: quiet() });
    const after = await dryRun({ store, getSource, cfg: cfg() });
    assert.equal(after.totals.todo, 2, 'a verse is still to do while mr and ta lack it');
    assert.deepEqual(after.totals.byLang, { hi: 1, mr: 0, ta: 0 });
    assert.ok(after.totals.outTokens < before.totals.outTokens + 1 && after.totals.outTokens > before.totals.outTokens * 0.5, 'Hindi is no longer counted for verse 1');

    const hiOnly = await dryRun({ store, getSource, cfg: cfg({ langs: ['hi'] }) });
    assert.equal(hiOnly.totals.todo, 1);
    assert.equal(hiOnly.totals.done, 1);
  });

  test('one language per call makes more calls and sends the English more often, for the same output', async () => {
    const { store } = freshStore();
    const together = await dryRun({ store, getSource, cfg: cfg() });
    const apart = await dryRun({ store, getSource, cfg: cfg({ groupBudget: 1 }) });
    assert.equal(together.totals.calls, 2, 'one call per verse');
    assert.equal(apart.totals.calls, 6, 'verses x languages');
    assert.equal(apart.totals.outTokens, together.totals.outTokens);
    assert.ok(apart.totals.inTokens > together.totals.inTokens);
    assert.ok(apart.costFloor > together.costFloor);
  });

  test('status reports progress per language and, with verify, finds a damaged verse', async () => {
    const { store, dir } = freshStore();
    await run({ store, getSource, ask: stub().ask, cfg: cfg(), log: quiet() });
    const ok = await status({ store, getSource, cfg: cfg(), verify: true });
    assert.equal(ok.rows[0].done, 2);
    assert.deepEqual(ok.rows[0].byLang, { hi: 2, mr: 2, ta: 2 });
    assert.deepEqual(ok.bad, []);
    assert.equal(ok.checkpoint.completedVerses, 2);
    assert.deepEqual(ok.versions, { [VERSION]: { hi: 2, mr: 2, ta: 2 } });
    assert.deepEqual(ok.scores.ta, { 1: 0, 2: 0, 3: 2, unscored: 0 });
    assert.deepEqual(ok.redo, []);

    const file = readLang(dir, 'ta');
    verseOf(file, '1.2.1').commentaries[0].text = TRANSLATION_1;
    seed(dir, langChapterKey('ta', 2), file);
    const bad = await status({ store, getSource, cfg: cfg(), verify: true });
    assert.equal(bad.bad.length, 1);
    assert.deepEqual([bad.bad[0].verseId, bad.bad[0].lang], ['1.2.1', 'ta']);
  });

  test('status tallies the scores and lists the verses that need a second round', async () => {
    const { store } = freshStore();
    const ask = stub({
      tweak: (lang, a, ctx) => {
        if (lang === 'ta' && ctx.ref === '2.1') a.purport.pop(); // incomplete → 1
        if (lang === 'mr' && ctx.ref === '2.2') a.correctness.translation = 2; // Claude's own doubt → 2
      },
    }).ask;
    await run({ store, getSource, ask, cfg: cfg(), log: quiet() });
    const s = await status({ store, getSource, cfg: cfg() });
    assert.deepEqual(s.scores.ta, { 1: 1, 2: 0, 3: 1, unscored: 0 });
    assert.deepEqual(s.scores.mr, { 1: 0, 2: 1, 3: 1, unscored: 0 });
    assert.deepEqual(s.scores.hi, { 1: 0, 2: 0, 3: 2, unscored: 0 });
    assert.deepEqual(s.redo, [{ verseId: '1.2.1', lang: 'ta' }]);
  });

  test('a verse saved without a score is counted as unscored, and verify says so', async () => {
    const { store, dir } = freshStore();
    await run({ store, getSource, ask: stub().ask, cfg: cfg({ langs: ['hi'], only: '1.2.1' }), log: quiet() });
    const file = readLang(dir, 'hi');
    delete verseOf(file, '1.2.1').aiTranslation.correctness;
    seed(dir, langChapterKey('hi', 2), file);
    const s = await status({ store, getSource, cfg: cfg({ langs: ['hi'] }), verify: true });
    assert.equal(s.scores.hi.unscored, 1);
    assert.match(s.bad[0].problems.join(), /no correctness score/);
  });

  test('verify notices a row whose score no longer matches the verse', async () => {
    const { store, dir } = freshStore();
    await run({ store, getSource, ask: stub().ask, cfg: cfg({ langs: ['hi'], only: '1.2.1' }), log: quiet() });
    const file = readLang(dir, 'hi');
    verseOf(file, '1.2.1').commentaries[0].correctness = 1;
    seed(dir, langChapterKey('hi', 2), file);
    const s = await status({ store, getSource, cfg: cfg({ langs: ['hi'] }), verify: true });
    assert.match(s.bad[0].problems.join(), /translation row's correctness does not match the verse's/);
  });

  test('verify notices when the English has changed since a verse was translated', async () => {
    const { store, dir } = freshStore();
    await run({ store, getSource, ask: stub().ask, cfg: cfg({ langs: ['hi'], only: '1.2.1' }), log: quiet() });
    const file = readLang(dir, 'hi');
    verseOf(file, '1.2.1').aiTranslation.sourceHash = 'old';
    seed(dir, langChapterKey('hi', 2), file);
    const s = await status({ store, getSource, cfg: cfg({ langs: ['hi'] }), verify: true });
    assert.match(s.bad[0].problems.join(), /English source has changed/);
  });
});


describe('who a saved row says made it', () => {
  test('every provider has a label, and a stamp with no provider is Claude\'s', () => {
    for (const id of PROVIDER_IDS) assert.ok(MADE_BY_LABELS.includes(translatedByOf(id)), `${id} has a label`);
    assert.equal(new Set(MADE_BY_LABELS).size, PROVIDER_IDS.length, 'no two providers share one');
    assert.deepEqual(['anthropic', 'openai', 'gemini', undefined].map(translatedByOf), ['claude', 'gpt', 'gemini', 'claude']);
    assert.equal(translatedByOf('somebody-new'), 'somebody-new', 'an unknown provider is never passed off as Claude');
  });

  test('the stamp that speaks for a verse is the translation\'s, or else the newest', () => {
    const t = { provider: 'openai', generatedAt: '2026-10-01' };
    const p = { provider: 'anthropic', generatedAt: '2026-10-09' };
    assert.equal(mainStampOf({ translation: t, purport: p }), t);
    assert.equal(mainStampOf({ purport: p, transliteration: { provider: 'gemini', generatedAt: '2026-10-02' } }), p);
    assert.equal(mainStampOf({}), null);
  });

  test('a run by GPT saves rows and a verse that say gpt, and verifyEntry checks them against the stamp', async () => {
    const { store, dir } = freshStore();
    const { ask } = stub();
    await run({ store, getSource, ask, cfg: cfg({ provider: 'openai', model: 'gpt-6-luna', only: '1.2.1' }), log: quiet() });
    for (const lang of LANGS) {
      const v = verseOf(readLang(dir, lang), '1.2.1');
      const own = v.commentaries.filter((c) => c.translatorSlug === 'prabhupada' && c.language === lang);
      assert.deepEqual(own.map((c) => c.translatedBy), ['gpt', 'gpt']);
      assert.equal(v.aiTranslation.translatedBy, 'gpt');
      assert.equal(v.aiTranslation.parts.translation.provider, 'openai');
      assert.deepEqual(verifyEntry(v, unitsFromChapter(chapterFile(), saFile()).units.find((u) => u.ref === '2.1'), lang), []);
      const old = { ...v, commentaries: v.commentaries.map((c) => (c.translatedBy ? { ...c, translatedBy: 'claude' } : c)) };
      assert.ok(verifyEntry(old, unitsFromChapter(chapterFile(), saFile()).units.find((u) => u.ref === '2.1'), lang).some((p) => /not stamped gpt/.test(p)), 'Claude\'s label on GPT\'s text is a problem');
    }
  });
});

describe('a plan: different models for different parts', () => {
  const PLAN = {
    translation: { provider: 'anthropic', model: 'claude-sonnet-5-5', effort: 'off' },
    purport: { provider: 'anthropic', model: 'claude-sonnet-5-5', effort: 'off' },
    transliteration: { provider: 'gemini', model: 'gemini-3.5-flash-lite', effort: 'off' },
    wordMeanings: { provider: 'gemini', model: 'gemini-3.5-flash-lite', effort: 'off' },
  };

  /** One stub per lane: answers only the keys its schema asks for, and remembers what it was sent. */
  function lanes({ failLane } = {}) {
    const sent = { anthropic: [], gemini: [] };
    const askFor = (lane) => async ({ system, user, schema }) => {
      const ref = user.match(/Bhagavad-gītā (\S+)/)[1];
      sent[lane.provider].push({ system, user, schema, ref });
      if (failLane === lane.provider) throw new Error('boom');
      await new Promise((r) => setTimeout(r, lane.provider === 'gemini' ? 15 : 1));
      const data = {};
      for (const [l, shape] of Object.entries(schema.properties)) {
        const full = answerFor(unitOf(ref), l);
        data[l] = Object.fromEntries(Object.keys(shape.properties).map((key) => [key, full[key]]));
        data[l].correctness = Object.fromEntries(Object.keys(shape.properties.correctness.properties).map((p) => [p, 3]));
      }
      return { data, usage, costUsd: 0.5, stopReason: 'end_turn' };
    };
    return { askFor, sent };
  }
  const unitOf = (ref) => unitsFromChapter(chapterFile(), saFile()).units.find((u) => u.ref === ref);

  test('parts with the same provider, model and effort share one lane', () => {
    const l = lanesOf(normalizePlan(PLAN, {}));
    assert.deepEqual(l.map((x) => [x.provider, x.parts]), [['anthropic', ['translation', 'purport']], ['gemini', ['transliteration', 'wordMeanings']]]);
    assert.throws(() => normalizePlan({ nonsense: {} }, {}), /Unknown part/);
    assert.throws(() => normalizePlan({}, {}), /no parts/);
  });

  test('each lane is one request per verse and carries only its parts: instructions, source, answer shape', async () => {
    const { store, dir } = freshStore();
    const { askFor, sent } = lanes();
    await run({ store, getSource, askFor, cfg: cfg({ plan: PLAN, only: '1.2.1' }), log: quiet() });
    assert.equal(sent.anthropic.length, 1);
    assert.equal(sent.gemini.length, 1, 'two parts, one request');
    const [a] = sent.anthropic, [g] = sent.gemini;
    assert.deepEqual(Object.keys(a.schema.properties.hi.properties), ['translation', 'purport', 'correctness', 'note']);
    assert.deepEqual(Object.keys(g.schema.properties.hi.properties), ['transliteration', 'wordMeanings', 'correctness', 'note']);
    assert.doesNotMatch(a.user, /Word-by-word|Transliteration \(/i, 'the translation lane is not sent the transliteration or the word list');
    assert.doesNotMatch(g.user, /Purport/i, 'the transliteration lane is not sent the purport');
    assert.ok(g.system.length < a.system.length || g.system !== a.system, 'each lane has its own instructions');
    for (const lang of LANGS) {
      const v = verseOf(readLang(dir, lang), '1.2.1');
      assert.deepEqual(Object.keys(v.aiTranslation.parts).sort(), ['purport', 'translation', 'transliteration', 'wordMeanings']);
      assert.equal(v.aiTranslation.parts.transliteration.provider, 'gemini');
      assert.equal(v.aiTranslation.parts.translation.provider, 'anthropic');
      assert.deepEqual(v.commentaries.filter((c) => c.language === lang).map((c) => c.translatedBy), ['claude', 'claude'], 'rows made by Claude say claude');
      assert.deepEqual(verifyEntry(v, unitOf('2.1'), lang), []);
    }
  });

  test('a lane saves only its parts: the other lane\'s text in the same file is kept', async () => {
    const { store, dir } = freshStore();
    const first = lanes();
    await run({ store, getSource, askFor: first.askFor, cfg: cfg({ plan: { translation: PLAN.translation }, only: '1.2.1', langs: ['hi'] }), log: quiet() });
    const before = verseOf(readLang(dir, 'hi'), '1.2.1');
    assert.equal(before.transliteration, undefined);
    const second = lanes();
    await run({ store, getSource, askFor: second.askFor, cfg: cfg({ plan: { transliteration: PLAN.transliteration }, only: '1.2.1', langs: ['hi'] }), log: quiet() });
    assert.equal(first.sent.anthropic.length + second.sent.anthropic.length, 1, 'the translation was not asked for again');
    const after = verseOf(readLang(dir, 'hi'), '1.2.1');
    assert.equal(after.transliteration, answerFor(unitOf('2.1'), 'hi').transliteration.join('\n'));
    assert.deepEqual(after.commentaries.map((c) => c.type), ['translation']);
    assert.deepEqual(Object.keys(after.aiTranslation.parts), ['translation', 'transliteration']);
    assert.equal(after.aiTranslation.parts.translation.generatedAt, before.aiTranslation.parts.translation.generatedAt, 'the translation\'s stamp is untouched');
  });

  test('lanes run side by side and both write the same chapter files without losing each other', async () => {
    const { store, dir } = freshStore();
    const { askFor, sent } = lanes();
    const result = await run({ store, getSource, askFor, cfg: cfg({ plan: PLAN }), log: quiet() });
    assert.equal(result.stopReason, 'finished');
    assert.equal(sent.anthropic.length, 2);
    assert.equal(sent.gemini.length, 2);
    for (const lang of LANGS) {
      for (const id of ['1.2.1', '1.2.2']) {
        const v = verseOf(readLang(dir, lang), id);
        assert.ok(v.transliteration && v.wordMeanings.length && v.commentaries.some((c) => c.type === 'translation'), `${lang} ${id} has every part`);
      }
    }
    const s = await status({ store, getSource, cfg: cfg({ plan: PLAN }), verify: true });
    assert.deepEqual(s.bad, []);
    const again = await run({ store, getSource, askFor: lanes().askFor, cfg: cfg({ plan: PLAN }), log: quiet() });
    assert.equal(again.done, 0, 'everything is current: nothing is asked');
  });

  test('when one lane fails, the other\'s saved work stays, and the next run asks only for what is missing', async () => {
    const { store, dir } = freshStore();
    await assert.rejects(() => run({ store, getSource, askFor: lanes({ failLane: 'gemini' }).askFor, cfg: cfg({ plan: PLAN, only: '1.2.1' }), log: quiet() }), /boom/);
    const v = verseOf(readLang(dir, 'hi'), '1.2.1');
    assert.ok(v.commentaries.some((c) => c.type === 'translation'), 'the Claude lane\'s translation was saved');
    assert.equal(v.transliteration, undefined);
    const retry = lanes();
    await run({ store, getSource, askFor: retry.askFor, cfg: cfg({ plan: PLAN, only: '1.2.1' }), log: quiet() });
    assert.equal(retry.sent.anthropic.length, 0, 'the finished lane is not asked again');
    assert.equal(retry.sent.gemini.length, 1);
  });

  test('a dry run prices each lane on its own', async () => {
    const { store } = freshStore();
    const r = await dryRun({ store, getSource, cfg: cfg({ plan: PLAN, priceFor: (lane) => (lane.provider === 'gemini' ? { input: 0.3, output: 2.5 } : { input: 3, output: 15 }) }) });
    assert.deepEqual(r.lanes.map((l) => l.provider), ['anthropic', 'gemini']);
    assert.ok(r.lanes.every((l) => l.calls > 0 && l.costFloor > 0));
    assert.ok(r.lanes[0].inTokens !== r.lanes[1].inTokens, 'each lane counts only its parts\' source');
    assert.equal(r.totals.calls, r.lanes[0].calls + r.lanes[1].calls);
  });
});
