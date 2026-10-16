// Putting right the English words a Malayalam or Tamil Gita translation left in its text: how the words are found, how
// the model's answer is checked, how the gaps are filled (and that nothing else can change), and the command line's
// apply step against a temporary folder — no network, no S3, no API key. The model itself is not called here.

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, describe, test } from 'node:test';
import { promisify } from 'node:util';

import { TRANSLATOR } from '../scripts/lib/claude-translate-source.js';
import { backupKey, checkpointKey, langChapterKey } from '../scripts/lib/claude-translate-store.js';
import {
  GAPS_SCHEMA, GLOSSARY, MAX_WORDING, englishOf, fillGaps, gapsFrom, marked, proseFields, reusesStub, romanSpans, sortSpans, touchUpPrompt, wordingProblems,
} from '../scripts/lib/translation-redo.js';

const run = promisify(execFile);
const dirs = [];
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

/* ---------- texts the audit found ---------- */

const ML_BEHALF = 'എന്നാൽ പരമപുരുഷന്റെ behalf-ൽ പ്രവർത്തിക്കുന്നത് ഫലത്തിൽ ആസക്തിയില്ലാതെ പ്രവർത്തിക്കലാണ്.';
const ML_MIGRATE = 'ഒരു ശരീരത്തിൽനിന്ന് മറ്റൊന്നിലേക്ക് transmigrate ചെയ്യുന്നു; അടുത്ത ജന്മത്തിൽ മറ്റൊരു ശരീരം ലഭിക്കും. അവൻ transmigrate ചെയ്യുന്നത് തുടരണം.';
const ML_STUB = 'വ്യക്തിഗത ആത്മാവിൽ നിന്ന് വേ apart, കൃഷ്ണൻ ഓരോ ശരീരത്തിലും ഉണ്ട്.';
const TA_CHAIN = 'ஒரு த transcendentalist இந்த உலகிலோ அழிவைச் சந்திப்பதில்லை.';
const TA_COPULA = 'அந்த வடிவம் transcendental ஆனதாக இருந்தாலும், அண்டத் தோற்றத்திற்காக.';
const TA_SEED = 'எல்லா உயிர்வாழிகளின் ஆதிச் seed-ஆகவும், அறிவாளிகளின் அறிவாகவும்.';
const TA_BODY = 'ஆன்மா இருப்பதால் இந்தப் பொர body வளர்ச்சியடைகிறது.';

describe('romanSpans — finding the English words', () => {
  test('a Roman word with an ending joined by a hyphen is one span, ending included', () => {
    const [span, ...more] = romanSpans('ml', ML_BEHALF);
    assert.equal(more.length, 0);
    assert.deepEqual({ id: span.id, text: span.text, roman: span.roman, suffix: span.suffix, stub: span.stub }, { id: 1, text: 'behalf-ൽ', roman: 'behalf', suffix: '-ൽ', stub: '' });
    assert.equal(ML_BEHALF.slice(span.start, span.end), span.text, 'start and end point at the same text');
  });

  test('a Sanskrit word with a diacritic is not English — the script repair converts it', () => {
    assert.equal(romanSpans('ta', 'இது kṣetra என்று').length, 0);
    assert.equal(romanSpans('ta', 'இது dharma-kṣetre என்று').length, 0, 'a compound with a diacritic anywhere in it is Sanskrit');
    assert.equal(romanSpans('ta', 'இது kshetra என்று').length, 1, 'the same word without its diacritic cannot be told from English');
  });

  test('a light verb right after the English word goes with it, so the wording can be one phrase', () => {
    const spans = romanSpans('ml', ML_MIGRATE);
    assert.deepEqual(spans.map((s) => s.text), ['transmigrate ചെയ്യുന്നു', 'transmigrate ചെയ്യുന്നത്']);
    assert.deepEqual(spans.map((s) => s.id), [1, 2]);
    const [span] = romanSpans('ta', TA_COPULA);
    assert.equal(span.text, 'transcendental ஆனதாக');
    assert.equal(romanSpans('ta', 'நிலை transcendental என்பதில் ஐயமில்லை').pop().text, 'transcendental', 'an ordinary next word stays out');
    assert.equal(romanSpans('ta', 'இது transcendental ஆகியவை').pop().text, 'transcendental', '"and so on" is not a copula');
    assert.equal(romanSpans('ta', 'அது transcendental ஆனது.')[0].text, 'transcendental ஆனது');
    assert.equal(romanSpans('ta', 'அது worship செய்கிறார்.')[0].text, 'worship செய்கிறார்');
  });

  test('a lone consonant before the word is the stub of a word that was dropped, and goes with it', () => {
    const [span] = romanSpans('ta', TA_CHAIN);
    assert.equal(span.text, 'த transcendentalist');
    assert.equal(span.stub, 'த');
    assert.equal(TA_CHAIN.slice(span.start, span.end), span.text);
  });

  test('a listed fragment is the stub too, one word or several, but only on a word boundary', () => {
    assert.equal(romanSpans('ml', ML_STUB, { fragments: ['വേ'] })[0].text, 'വേ apart');
    assert.equal(romanSpans('ta', TA_SEED, { fragments: ['ஆதிச்'] })[0].text, 'ஆதிச் seed-ஆகவும்');
    const body = romanSpans('ta', TA_BODY, { fragments: ['இந்தப் பொர'] })[0];
    assert.equal(body.text, 'இந்தப் பொர body');
    assert.equal(body.stub, 'இந்தப் பொர');
    assert.equal(romanSpans('ta', TA_BODY)[0].text, 'body', 'unlisted, the half-word stays and the span is only the English');
    assert.equal(romanSpans('ta', 'ஆஆதிச் seed', { fragments: ['ஆதிச்'] })[0].text, 'seed', 'a fragment inside another word is not a stub');
  });

  test('every span is numbered in reading order and fills cleanly', () => {
    const text = `${TA_CHAIN} ${TA_SEED}`;
    const spans = romanSpans('ta', text, { fragments: ['ஆதிச்'] });
    assert.deepEqual(spans.map((s) => s.id), [1, 2]);
    assert.ok(spans[0].end <= spans[1].start);
    for (const s of spans) assert.equal(text.slice(s.start, s.end), s.text);
  });
});

describe('sortSpans — who fills which gap', () => {
  const text = 'bhajanti இது; Worship என்பது worship என்றால் sacrifice-ஆக bhajate-ஆல்';
  const spans = romanSpans('ta', text);

  test('English words with only punctuation between them are one phrase, so one gap', () => {
    assert.deepEqual(romanSpans('ta', 'ஒன்று worship; sacrifice இரண்டு').map((s) => s.text), ['worship; sacrifice']);
  });

  test('words to keep stay (any case), Sanskrit is converted by rule with its ending, the rest go to the model', () => {
    const { ask, kept, converted } = sortSpans('ta', spans, { sanskrit: ['bhajanti', 'bhajate'], keep: ['worship'] });
    assert.deepEqual(kept.map((s) => s.roman), ['Worship', 'worship']);
    assert.deepEqual(ask.map((s) => s.roman), ['sacrifice']);
    assert.equal(converted.size, 2);
    const byRoman = Object.fromEntries([...converted].map(([id, v]) => [spans.find((s) => s.id === id).roman, v]));
    assert.equal(byRoman.bhajanti, 'பஜந்தி');
    assert.equal(byRoman.bhajate, 'பஜதே-ஆல்', 'the ending joined by a hyphen is carried');
  });

  test('with nothing listed everything is asked', () => {
    assert.equal(sortSpans('ta', spans).ask.length, spans.length);
  });
});

describe('wordingProblems and reusesStub — checking a piece of wording', () => {
  test('clean wording in the language has no problem', () => {
    assert.deepEqual(wordingProblems('ml', 'മാറുന്നു'), []);
    assert.deepEqual(wordingProblems('ta', 'அதீத நிலையில்'), []);
  });

  test('each way wording goes wrong is named', () => {
    assert.match(wordingProblems('ml', '')[0], /empty/);
    assert.match(wordingProblems('ml', undefined)[0], /empty/);
    assert.ok(wordingProblems('ml', ' മാറുന്നു').some((p) => /space at either end/.test(p)));
    assert.ok(wordingProblems('ml', 'മ'.repeat(MAX_WORDING + 1)).some((p) => /over 80/.test(p)));
    assert.ok(wordingProblems('ml', 'മാറുന്നു\nഎന്ന്').some((p) => /line break/.test(p)));
    assert.ok(wordingProblems('ml', 'മാറുന്നു move').some((p) => /Roman letters: "move"/.test(p)));
    assert.ok(wordingProblems('ml', 'मारुन्नु').some((p) => /other-script/.test(p)), 'Devanagari in a Malayalam passage');
  });

  test('a short stub counts only as a whole word; a long one also when the wording begins with it', () => {
    assert.equal(reusesStub('ஆழ்நிலைவாதி', 'த'), false, 'த is inside the word without being it');
    assert.equal(reusesStub('த ஆழ்நிலை', 'த'), true);
    assert.equal(reusesStub('வேறிட்ட்', 'வே'), false);
    assert.equal(reusesStub('ஆதிச் விதை', 'ஆதிச்'), true);
    assert.equal(reusesStub('ஆதி விதை', 'ஆதிச்'), false);
    assert.equal(reusesStub('இந்தப் பொருள் உடல்', 'இந்தப் பொர'), true, 'the same half-word carried on');
    assert.equal(reusesStub('இந்த ஜட உடல்', 'இந்தப் பொர'), false);
    assert.equal(reusesStub('எனக்கு அதீத', 'எனக்குத் த'), false);
  });
});

describe('gapsFrom — checking the model\'s answer', () => {
  const spans = romanSpans('ta', `${TA_CHAIN} ${TA_SEED}`, { fragments: ['ஆதிச்'] });

  test('a full, clean answer becomes Map(id → wording)', () => {
    const wording = gapsFrom('ta', { gaps: [{ id: 2, text: 'ஆதி விதையாகவும்' }, { id: 1, text: 'ஆழ்நிலைவாதி' }] }, spans);
    assert.deepEqual([...wording], [[2, 'ஆதி விதையாகவும்'], [1, 'ஆழ்நிலைவாதி']]);
  });

  test('a missing gap, an unknown gap, a repeat, a bad wording and a reused stub are all reported at once', () => {
    const err = (answer) => { try { gapsFrom('ta', answer, spans); } catch (e) { return e; } return assert.fail('it should have thrown'); };
    assert.deepEqual(err({ gaps: [{ id: 1, text: 'ஆழ்நிலைவாதி' }] }).problems, ['gap 2: no wording given']);
    assert.deepEqual(err({}).problems, ['gap 1: no wording given', 'gap 2: no wording given']);
    assert.deepEqual(err({ gaps: [{ id: 1, text: 'transcendentalist' }, { id: 2, text: 'ஆதி' }] }).problems.length, 1, 'a refused wording is not also reported as missing');
    assert.ok(err({ gaps: [{ id: 3, text: 'அ' }, { id: 1, text: 'அ' }, { id: 1, text: 'அ' }, { id: 2, text: 'அ' }] }).problems.some((p) => /gap 3: there is no such gap/.test(p)));
    assert.ok(err({ gaps: [{ id: 1, text: 'அ' }, { id: 1, text: 'அ' }, { id: 2, text: 'ஆ' }] }).problems.some((p) => /gap 1: given twice/.test(p)));
    const bad = err({ gaps: [{ id: 1, text: 'transcendentalist' }, { id: 2, text: 'ஆதிச் விதையாகவும்' }] });
    assert.equal(bad.problems.length, 2, 'one line for each refused gap');
    assert.match(bad.problems[0], /gap 1: .*Roman letters/);
    assert.match(bad.problems[1], /gap 2: it keeps the broken start "ஆதிச்"/);
    assert.equal(bad.message, bad.problems.join(' | '));
  });
});

describe('fillGaps — the only way the text changes', () => {
  test('the spans are replaced and every other character is exactly as it was', () => {
    const text = `${TA_CHAIN} ${TA_SEED}`;
    const spans = romanSpans('ta', text, { fragments: ['ஆதிச்'] });
    const out = fillGaps(text, spans, new Map([[1, 'ஆழ்நிலைவாதி'], [2, 'ஆதி விதையாகவும்']]));
    assert.equal(out, 'ஒரு ஆழ்நிலைவாதி இந்த உலகிலோ அழிவைச் சந்திப்பதில்லை. எல்லா உயிர்வாழிகளின் ஆதி விதையாகவும், அறிவாளிகளின் அறிவாகவும்.');
    assert.equal(out.length, text.length - spans.reduce((n, s) => n + s.text.length, 0) + 'ஆழ்நிலைவாதி'.length + 'ஆதி விதையாகவும்'.length);
  });

  test('a span with no wording stays as it is', () => {
    const spans = romanSpans('ml', ML_MIGRATE);
    assert.equal(fillGaps(ML_MIGRATE, spans, new Map([[2, 'മാറുന്നത്']])), ML_MIGRATE.replace('transmigrate ചെയ്യുന്നത്', 'മാറുന്നത്'));
    assert.equal(fillGaps(ML_MIGRATE, spans, new Map()), ML_MIGRATE);
  });

  test('a text that is not the one the spans were read from is refused, not patched', () => {
    const spans = romanSpans('ml', ML_BEHALF);
    assert.throws(() => fillGaps(`${ML_BEHALF} `.replace('പരമപുരുഷന്റെ', 'പരമ പുരുഷന്റെ'), spans, new Map([[1, 'പേരിൽ']])), /the text is not what was read/);
  });
});

/* ---------- the saved verse ---------- */

const verseOf = (lang) => ({
  verseId: '1.9.4',
  wordMeanings: [{ word: 'ma', meaning: 'one' }, { word: 'tat', meaning: 'two' }],
  commentaries: [
    { translatorSlug: TRANSLATOR, language: lang, type: 'translation', text: 'T' },
    { translatorSlug: TRANSLATOR, language: lang, type: 'purport', text: 'P' },
    { translatorSlug: 'someone-else', language: lang, type: 'translation', text: 'NOT OURS' },
    { translatorSlug: TRANSLATOR, language: 'en', type: 'translation', text: 'EN' },
  ],
});

describe('proseFields and englishOf — reaching the text', () => {
  test('a translation or purport is the one row of this translator in this language', () => {
    const verse = verseOf('ta');
    const [field] = proseFields('ta', verse, 'translation');
    assert.equal(field.text, 'T');
    field.set(verse, 'T2');
    assert.equal(verse.commentaries[0].text, 'T2');
    assert.equal(verse.commentaries[2].text, 'NOT OURS');
    assert.equal(verse.commentaries[3].text, 'EN');
    assert.equal(proseFields('ta', verse, 'purport')[0].text, 'P');
  });

  test('word meanings are one field each, labelled from 1', () => {
    const verse = verseOf('ml');
    const fields = proseFields('ml', verse, 'wordMeanings');
    assert.deepEqual(fields.map((f) => [f.label, f.text]), [['word 1', 'one'], ['word 2', 'two']]);
    fields[1].set(verse, 'TWO');
    assert.deepEqual(verse.wordMeanings, [{ word: 'ma', meaning: 'one' }, { word: 'tat', meaning: 'TWO' }]);
  });

  test('a part with no prose in it is refused', () => {
    assert.throws(() => proseFields('ml', verseOf('ml'), 'transliteration'), /not a part with prose/);
  });

  test('englishOf gives the English the field was made from', () => {
    const unit = { translation: 'Tr', purport: ['a', 'b'], wordMeanings: [{ word: 'dharma', meaning: 'religion' }] };
    assert.equal(englishOf(unit, 'translation', 'translation'), 'Tr');
    assert.equal(englishOf(unit, 'purport', 'purport'), 'a\n\nb');
    assert.equal(englishOf(unit, 'wordMeanings', 'word 1'), 'dharma — religion');
    assert.equal(englishOf(unit, 'wordMeanings', 'word 9'), '');
  });
});

describe('touchUpPrompt — the question', () => {
  const text = `${TA_CHAIN}`;
  const spans = romanSpans('ta', text);
  const ask = (extra = {}) => touchUpPrompt({ lang: 'ta', part: 'translation', label: 'translation', english: 'A transcendentalist …', text, spans, ...extra });

  test('the gaps are marked in place and listed, with the English original beside them', () => {
    const { user, schema } = ask();
    assert.equal(schema, GAPS_SCHEMA);
    assert.ok(user.includes('ஒரு 【1: த transcendentalist】 இந்த'));
    assert.ok(user.includes('1: த transcendentalist'));
    assert.ok(user.includes('A transcendentalist …'));
    assert.equal(marked(text, spans), 'ஒரு 【1: த transcendentalist】 இந்த உலகிலோ அழிவைச் சந்திப்பதில்லை.');
  });

  test('the system prompt says the text round a gap cannot change, and what a broken start is', () => {
    const { system } = ask();
    assert.match(system, /Tamil/);
    assert.match(system, /you cannot change it/);
    assert.match(system, /broken start of a word/);
    assert.match(system, /No Roman letters/);
  });

  test('the fixed renderings are the saved corpus\'s own, per language, and only for that language', () => {
    assert.match(ask().system, /அதீத/);
    assert.match(ask().system, /ஆழ்நிலைவாதி/);
    assert.doesNotMatch(ask().system, /അതീന്ദ്രിയ/);
    const ml = touchUpPrompt({ lang: 'ml', part: 'purport', label: 'purport', english: 'x', text: ML_BEHALF, spans: romanSpans('ml', ML_BEHALF) });
    assert.match(ml.system, /അതീന്ദ്രിയ/);
    assert.match(ml.system, /ഭൗതിക/);
    assert.doesNotMatch(ml.system, /அதீத/);
    assert.deepEqual(Object.keys(GLOSSARY).sort(), ['ml', 'ta']);
    assert.doesNotMatch(ask({ glossary: [] }).system, /FIXED RENDERINGS/);
  });

  test('a hint and the reasons the last answer was refused are shown when there are any', () => {
    assert.doesNotMatch(ask().user, /Note on this passage|refused/);
    assert.match(ask({ hint: 'use the verb மாறு' }).user, /Note on this passage: use the verb மாறு/);
    const again = ask({ problems: ['gap 1: no wording given'] }).user;
    assert.match(again, /Your last answer was refused:\n- gap 1: no wording given\nAnswer again\./);
  });
});

/* ---------- the command line ---------- */

describe('redo-translation-parts.js apply', () => {
  const script = resolve(import.meta.dirname, '../scripts/redo-translation-parts.js');
  const VERSION = '1.0-test';
  const sha = (verse) => createHash('sha1').update(JSON.stringify(verse)).digest('hex');
  const verseA = (text) => ({ verseId: '1.2.1', aiTranslation: { version: VERSION }, commentaries: [{ translatorSlug: TRANSLATOR, language: 'ml', type: 'translation', text }] });
  const verseB = () => ({ verseId: '1.2.2', aiTranslation: { version: VERSION }, commentaries: [{ translatorSlug: TRANSLATOR, language: 'ml', type: 'translation', text: 'B stays' }] });

  /** A local bucket holding chapters 2 and 3 of the Malayalam Gita, and a proposal that replaces verse 1.2.1 and 1.3.1. */
  function bucket() {
    const dir = mkdtempSync(join(tmpdir(), 'redo-translation-parts-'));
    dirs.push(dir);
    const put = (key, body) => {
      mkdirSync(dirname(join(dir, key)), { recursive: true });
      writeFileSync(join(dir, key), JSON.stringify(body, null, 2));
    };
    const ch2 = { meta: { language: 'ml' }, verses: [verseA('old A'), verseB()] };
    const ch3 = { meta: { language: 'ml' }, verses: [{ ...verseA('old C'), verseId: '1.3.1' }] };
    put(langChapterKey('ml', 2), ch2);
    put(langChapterKey('ml', 3), ch3);
    const proposal = {
      at: 'now', store: dir, version: VERSION, spent: 0, stopped: null,
      items: [
        { lang: 'ml', chapter: 2, verseId: '1.2.1', before: sha(ch2.verses[0]), verse: verseA('NEW A') },
        { lang: 'ml', chapter: 3, verseId: '1.3.1', before: sha(ch3.verses[0]), verse: { ...verseA('NEW C'), verseId: '1.3.1' } },
      ],
    };
    const file = join(dir, 'proposal.json');
    writeFileSync(file, JSON.stringify(proposal));
    return { dir, file, proposal, ch2, ch3 };
  }

  const exec = (dir, file, ...args) => run(process.execPath, [script, 'apply', '--proposal', file, '--local-store', dir, ...args], { env: { ...process.env, TRANSLATION_VERSION: VERSION } });
  const read = (dir, key) => JSON.parse(readFileSync(join(dir, key), 'utf8'));
  const failing = async (promise) => promise.then(() => assert.fail('it should have stopped'), (err) => err);
  const textOf = (file, id) => file.verses.find((v) => v.verseId === id).commentaries[0].text;

  test('it backs each chapter file up, replaces only the proposed verses, and reads the file back', async () => {
    const { dir, file, ch2, ch3 } = bucket();
    const { stdout } = await exec(dir, file);
    assert.match(stdout, /2 verse\(s\) in 2 chapter file\(s\)/);
    assert.match(stdout, /Now run scripts\/fix-translation-script\.js/);
    const after2 = read(dir, langChapterKey('ml', 2));
    assert.equal(textOf(after2, '1.2.1'), 'NEW A');
    assert.deepEqual(after2.verses[1], ch2.verses[1], 'the verse that was not proposed is untouched');
    assert.deepEqual(after2.meta, ch2.meta);
    assert.equal(textOf(read(dir, langChapterKey('ml', 3)), '1.3.1'), 'NEW C');
    assert.deepEqual(read(dir, backupKey(langChapterKey('ml', 2))), ch2, 'the backup is the file as it was');
    assert.deepEqual(read(dir, backupKey(langChapterKey('ml', 3))), ch3);
  });

  test('a verse that changed since the proposal stops everything — no file is written, none is backed up', async () => {
    const { dir, file, ch2 } = bucket();
    const key3 = langChapterKey('ml', 3);
    const changed = read(dir, key3);
    changed.verses[0].commentaries[0].text = 'someone edited this';
    writeFileSync(join(dir, key3), JSON.stringify(changed, null, 2));
    const err = await failing(exec(dir, file));
    assert.match(err.stderr, /ml 1\.3\.1 in .*ch-3\.json has changed since it was proposed/);
    assert.deepEqual(read(dir, langChapterKey('ml', 2)), ch2, 'chapter 2 was fine, but it is not written either');
    assert.equal(existsSync(join(dir, backupKey(langChapterKey('ml', 2)))), false);
    assert.deepEqual(read(dir, key3), changed);
  });

  test('a verse that is no longer in the file, and a file that is not there, are refused', async () => {
    const { dir, file, proposal } = bucket();
    writeFileSync(file, JSON.stringify({ ...proposal, items: [{ ...proposal.items[0], verseId: '1.2.9' }] }));
    assert.match((await failing(exec(dir, file))).stderr, /ml 1\.2\.9 is not in .*ch-2\.json any more/);
    writeFileSync(file, JSON.stringify({ ...proposal, items: [{ ...proposal.items[0], chapter: 9 }] }));
    assert.match((await failing(exec(dir, file))).stderr, /ch-9\.json does not exist/);
  });

  test('a proposal that stopped early is not applied', async () => {
    const { dir, file, proposal, ch2 } = bucket();
    writeFileSync(file, JSON.stringify({ ...proposal, stopped: 'the spending limit' }));
    const err = await failing(exec(dir, file));
    assert.match(err.stderr, /stopped early \(the spending limit\)/);
    assert.deepEqual(read(dir, langChapterKey('ml', 2)), ch2);
  });

  test('it stops while the checkpoint says a run is active, unless --force', async () => {
    const { dir, file, ch2 } = bucket();
    mkdirSync(dirname(join(dir, checkpointKey(VERSION))), { recursive: true });
    writeFileSync(join(dir, checkpointKey(VERSION)), JSON.stringify({ running: true }));
    assert.match((await failing(exec(dir, file))).stderr, /a run is active/);
    assert.deepEqual(read(dir, langChapterKey('ml', 2)), ch2);
    await exec(dir, file, '--force');
    assert.equal(textOf(read(dir, langChapterKey('ml', 2)), '1.2.1'), 'NEW A');
  });

  test('applying the same proposal again is refused: the verses are no longer what it started from', async () => {
    const { dir, file } = bucket();
    await exec(dir, file);
    assert.match((await failing(exec(dir, file))).stderr, /has changed since it was proposed/);
  });

  test('without a command it prints how to use it and stops', async () => {
    const err = await failing(run(process.execPath, [script], { env: process.env }));
    assert.equal(err.code, 1);
    assert.match(err.stdout, /Usage:\n\s+node scripts\/redo-translation-parts\.js propose/);
  });
});
