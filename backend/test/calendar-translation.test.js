// The Hindu calendar's words in a reader's language, the pure parts: what a translation is keyed by, the words a response is made
// of, swapping them for a reader's language, the checks on a translation answer, the prompt, and how a run reads on the admin page.
// No database, no queue.
//
//   node --test test/calendar-translation.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import { KINDS, TERM_FIELDS, languages } from '../config/calendar.js';
import {
  PROMPT_VERSION,
  TRANSLATE_SCHEMA,
  checkAnswer,
  itemKey,
  languageInfo,
  makeWords,
  plainWords,
  presentRun,
  sourceKeyOf,
  userPrompt,
  wordsOf,
} from '../utils/calendar-translation.js';
import { message } from '../utils/festival-message.js';

/* ---------- what a translation is keyed by ---------- */

test('sourceKeyOf: the same English gives the same key, ignoring the edges; reworded English gives another', () => {
  assert.equal(sourceKeyOf('Papmochani Ekadashi'), sourceKeyOf('  Papmochani Ekadashi\n'));
  assert.notEqual(sourceKeyOf('Papmochani Ekadashi'), sourceKeyOf('Papmochani Ekadashi '.repeat(2)));
  assert.match(sourceKeyOf('Purnima'), /^[0-9a-f]{40}$/);
});

test('itemKey: the kind is part of the key, so the festival and the tithi called Purnima are two translations', () => {
  assert.notEqual(itemKey('NAME', 'Purnima'), itemKey('TERM', 'Purnima'));
  assert.ok(itemKey('NAME', 'Purnima').startsWith('NAME:'));
  for (const kind of KINDS) assert.ok(itemKey(kind, 'x').startsWith(`${kind}:`));
});

test('the languages are the 11 other than English, each with a script block', () => {
  assert.equal(languages.length, 11);
  assert.ok(!languages.some((l) => l.code === 'en'));
  assert.equal(languageInfo('mr').name, 'Marathi');
  assert.equal(languageInfo('xx'), null);
  assert.equal(typeof PROMPT_VERSION, 'string');
});

/* ---------- the words of a response ---------- */

const festival = (overrides = {}) => ({ kind: 'EKADASHI', name: 'Papankusha Ekadashi', description: 'A fast for Viṣṇu.', ...overrides });

test('wordsOf: each festival gives its name and description; each day gives its terms', () => {
  const days = [{ tithiName: 'Ekadashi', nakshatra: 'Rohini', yoga: null, karana: 'Bava', monthAmanta: 'Ashwin', monthPurnimanta: 'Kartika', sunSign: 'Kanya', moonSign: 'Vrishabha' }];
  const out = wordsOf(days, [festival()]);
  assert.deepEqual(out.slice(0, 2), [
    { kind: 'NAME', text: 'Papankusha Ekadashi' },
    { kind: 'DESCRIPTION', text: 'A fast for Viṣṇu.' },
  ]);
  const terms = out.filter((w) => w.kind === 'TERM').map((w) => w.text);
  assert.deepEqual(terms.sort(), ['Ashwin', 'Bava', 'Ekadashi', 'Kanya', 'Kartika', 'Rohini', 'Vrishabha'].sort());
});

test('wordsOf: a parana row gives the Ekadashi it follows but not its description, which is built for the date', () => {
  const parana = festival({ kind: 'PARANA', name: 'Papankusha Ekadashi parana', description: 'Break the fast between 6:26 AM and 8:42 AM.', details: { ekadashi: 'Papankusha Ekadashi' } });
  const out = wordsOf([], [parana]);
  assert.deepEqual(out, [
    { kind: 'NAME', text: 'Papankusha Ekadashi parana' },
    { kind: 'NAME', text: 'Papankusha Ekadashi' },
  ]);
});

test('wordsOf: nothing in, nothing out; a festival without a description gives only its name', () => {
  assert.deepEqual(wordsOf(), []);
  assert.deepEqual(wordsOf([], [festival({ description: null })]), [{ kind: 'NAME', text: 'Papankusha Ekadashi' }]);
  assert.deepEqual(Object.keys(TERM_FIELDS).length, 8);
});

/* ---------- a reader's language ---------- */

const row = (languageCode, kind, text, translated) => ({ languageCode, kind, sourceKey: sourceKeyOf(text), text: translated });

test('makeWords: a reader with a translation gets it; a word without one stays English', () => {
  const words = makeWords([row('hi', 'NAME', 'Ekadashi', 'एकादशी')], ['hi', 'en']);
  assert.equal(words('NAME', 'Ekadashi'), 'एकादशी');
  assert.equal(words('NAME', 'Purnima'), 'Purnima');
  // The kind is part of the match.
  assert.equal(words('TERM', 'Ekadashi'), 'Ekadashi');
});

test('makeWords: the chain is walked in order and stops at English', () => {
  const rows = [row('hi', 'NAME', 'Holi', 'होली'), row('mr', 'NAME', 'Holi', 'होळी'), row('mr', 'NAME', 'Diwali', 'दिवाळी')];
  assert.equal(makeWords(rows, ['mr', 'hi', 'en'])('NAME', 'Holi'), 'होळी');
  assert.equal(makeWords(rows, ['hi', 'mr', 'en'])('NAME', 'Diwali'), 'दिवाळी'); // hi has none, falls to mr
  // English first: the reader reads English, whatever else the chain lists.
  assert.equal(makeWords(rows, ['en', 'hi'])('NAME', 'Holi'), 'Holi');
});

test('makeWords: no rows, or only English, is the plain function', () => {
  assert.equal(makeWords([], ['hi', 'en']), plainWords);
  assert.equal(makeWords([row('hi', 'NAME', 'x', 'y')], ['en']), plainWords);
  assert.equal(makeWords([row('hi', 'NAME', 'x', 'y')]), plainWords);
});

test('makeWords: an empty or blank word is returned as it is, and a blank translation is not used', () => {
  const words = makeWords([row('hi', 'NAME', 'Holi', '   ')], ['hi', 'en']);
  assert.equal(words('NAME', ''), '');
  assert.equal(words('NAME', null), null);
  assert.equal(words('NAME', 'Holi'), 'Holi');
});

test('the festival push words its name and description in the reader’s language', () => {
  const f = { kind: 'EKADASHI', name: 'Papankusha Ekadashi', description: 'A fast for Viṣṇu.', paksha: 'SHUKLA', date: new Date('2026-10-23T00:00:00.000Z'), details: null };
  const words = makeWords([row('hi', 'NAME', f.name, 'पापांकुशा एकादशी'), row('hi', 'DESCRIPTION', f.description, 'विष्णु के लिए व्रत।')], ['hi', 'en']);
  const hindi = message(f, 0, ['hi', 'en'], words);
  assert.match(hindi.title, /पापांकुशा एकादशी/);
  assert.match(hindi.body, /विष्णु के लिए व्रत/);
  // Not translated: the same call without the words is the English the push always was.
  const english = message(f, 0, ['en']);
  assert.match(english.title, /Papankusha Ekadashi/);
  assert.match(english.body, /A fast for Viṣṇu\./);
});

test('a parana push names the Ekadashi in the reader’s language', () => {
  const parana = {
    kind: 'PARANA',
    name: 'Papankusha Ekadashi parana',
    description: 'English times',
    paksha: 'SHUKLA',
    date: new Date('2026-10-23T00:00:00.000Z'),
    details: { ekadashi: 'Papankusha Ekadashi', startsAt: '2026-10-23T00:56:00.000Z', endsAt: '2026-10-23T03:12:00.000Z', place: 'New Delhi', timezone: 'Asia/Kolkata', twoDates: false, alsoFastToday: false },
  };
  const words = makeWords([row('hi', 'NAME', 'Papankusha Ekadashi', 'पापांकुशा एकादशी')], ['hi', 'en']);
  assert.match(message(parana, 0, ['hi', 'en'], words).body, /पापांकुशा एकादशी/);
});

/* ---------- the prompt and the checks on an answer ---------- */

test('userPrompt: one JSON line a word, with its group only when it has one', () => {
  const prompt = userPrompt({
    languageName: 'Hindi',
    endonym: 'हिन्दी',
    items: [
      { ref: '1', kind: 'TERM', group: 'tithi', source: 'Ekadashi' },
      { ref: '2', kind: 'NAME', source: 'Holi' },
    ],
  });
  assert.match(prompt, /^Translate into Hindi/);
  const lines = prompt.split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l));
  assert.deepEqual(lines, [
    { ref: '1', kind: 'TERM', group: 'tithi', text: 'Ekadashi' },
    { ref: '2', kind: 'NAME', text: 'Holi' },
  ]);
});

test('TRANSLATE_SCHEMA asks for items of ref and text', () => {
  assert.deepEqual(TRANSLATE_SCHEMA.required, ['items']);
  assert.deepEqual(TRANSLATE_SCHEMA.properties.items.items.required, ['ref', 'text']);
});

const asked = [
  { ref: '1', kind: 'NAME', source: 'Papankusha Ekadashi' },
  { ref: '2', kind: 'TERM', source: 'Rohini' },
  { ref: '3', kind: 'DESCRIPTION', source: 'A fast for Viṣṇu.' },
];

test('checkAnswer: a complete answer in the right script passes', () => {
  const out = checkAnswer({ items: [{ ref: '1', text: 'पापांकुशा एकादशी' }, { ref: '2', text: 'रोहिणी' }, { ref: '3', text: 'विष्णु के लिए व्रत।' }] }, asked, 'hi');
  assert.equal(out.ok, true);
  assert.deepEqual(out.problems, []);
  assert.equal(out.items.length, 3);
});

test('checkAnswer: a half-good answer keeps the good items and says what was wrong with the rest', () => {
  const out = checkAnswer({ items: [{ ref: '1', text: 'पापांकुशा एकादशी' }, { ref: '2', text: '' }] }, asked, 'hi');
  assert.equal(out.ok, false);
  assert.deepEqual(out.items, [{ ref: '1', text: 'पापांकुशा एकादशी' }]);
  assert.deepEqual(out.problems, ['"2" is empty', '"3" is missing']);
});

test('checkAnswer: English left in, the wrong script and a runaway answer are refused', () => {
  const english = checkAnswer({ items: [{ ref: '1', text: 'Papankusha Ekadashi' }] }, [asked[0]], 'hi');
  assert.deepEqual(english.problems, ['"1" is not written in Hindi']);
  const tamilForHindi = checkAnswer({ items: [{ ref: '2', text: 'ரோகிணி' }] }, [asked[1]], 'hi');
  assert.deepEqual(tamilForHindi.problems, ['"2" is not written in Hindi']);
  const long = checkAnswer({ items: [{ ref: '2', text: 'रोहिणी'.repeat(40) }] }, [asked[1]], 'hi');
  assert.deepEqual(long.problems, ['"2" is far longer than the English']);
  assert.deepEqual(long.items, []);
});

test('checkAnswer: a malformed answer is every item missing, and a numeric ref still matches', () => {
  for (const data of [null, {}, { items: 'x' }, { items: [null, 5, {}] }]) {
    const out = checkAnswer(data, asked, 'hi');
    assert.equal(out.ok, false);
    assert.equal(out.problems.length, 3);
  }
  const numeric = checkAnswer({ items: [{ ref: 1, text: 'पापांकुशा एकादशी' }] }, [asked[0]], 'hi');
  assert.equal(numeric.ok, true);
});

/* ---------- a run, as the page receives it ---------- */

const now = new Date('2026-10-23T10:00:00.000Z');
const run = (overrides = {}) => ({
  id: 'r1',
  language: 'mr',
  provider: 'openai',
  model: 'gpt-6-luna',
  force: false,
  status: 'RUNNING',
  pauseReason: null,
  statusMessage: null,
  stopReason: null,
  resumeAt: null,
  cancelRequested: false,
  totalItems: 200,
  doneItems: 50,
  currentItem: 'Holi',
  activeSeconds: 100,
  inputTokens: 1000,
  outputTokens: 500,
  calls: 3,
  attempts: 1,
  requestedById: 'u1',
  requestedByName: 'Admin',
  createdAt: new Date('2026-10-23T09:00:00.000Z'),
  startedAt: new Date('2026-10-23T09:00:05.000Z'),
  finishedAt: null,
  heartbeatAt: new Date('2026-10-23T09:59:50.000Z'),
  ...overrides,
});

test('presentRun: names the language, the engine and the person; counts progress and estimates the time left', () => {
  const out = presentRun(run(), now);
  assert.equal(out.languageName, 'Marathi');
  assert.equal(out.endonym, 'मराठी');
  assert.equal(out.provider, 'openai');
  assert.equal(out.model, 'gpt-6-luna');
  assert.deepEqual(out.progress, { total: 200, done: 50, percent: 25, currentItem: 'Holi', etaSeconds: 300 });
  assert.deepEqual(out.usage, { inputTokens: 1000, outputTokens: 500, calls: 3 });
  assert.deepEqual(out.requestedBy, { id: 'u1', name: 'Admin' });
  assert.equal(out.stalled, false);
});

test('presentRun: no estimate before anything is done or once it is not running; an empty run is 0%', () => {
  assert.equal(presentRun(run({ doneItems: 0, activeSeconds: 0 }), now).progress.etaSeconds, null);
  assert.equal(presentRun(run({ status: 'PAUSED' }), now).progress.etaSeconds, null);
  assert.equal(presentRun(run({ totalItems: 0, doneItems: 0 }), now).progress.percent, 0);
  assert.equal(presentRun(run({ doneItems: 999 }), now).progress.percent, 100);
  assert.equal(presentRun(run({ requestedById: null }), now).requestedBy, null);
});

test('presentRun: a running run whose worker has gone quiet is stalled; a paused one never is', () => {
  assert.equal(presentRun(run({ heartbeatAt: new Date('2026-10-23T09:50:00.000Z') }), now).stalled, true);
  assert.equal(presentRun(run({ status: 'PAUSED', heartbeatAt: new Date('2026-10-23T09:50:00.000Z') }), now).stalled, false);
  assert.equal(presentRun(run({ heartbeatAt: null }), now).stalled, false);
});
