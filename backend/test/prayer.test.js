// Prayers, the pure parts: which script a reader gets a verse in and how it is made (`howText`), the scripts offered for a
// prayer, a prayer in a reader's language, what a translation run still has to do (`needsOf`, the one place that decides),
// the prompts and the checks on a model's answers, and how a run reads on the admin page. No database.
//
//   node --test test/prayer.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CATEGORY_IDS, ORIGINAL_LANGUAGES, RULE_TARGETS, SCRIPT_OF, categories, howText, languages, prayer as cfg } from '../config/prayer.js';
import {
  HEADER_SCHEMA,
  ROMAN_STYLE,
  TAMIL_CONVENTION,
  VERSES_SCHEMA,
  categoryName,
  checkAnswer,
  checkHeader,
  editorOf,
  isCategory,
  isOriginalLanguage,
  isStale,
  languageInfo,
  languageSummaries,
  needsOf,
  present,
  presentItem,
  presentList,
  presentRun,
  presentVerse,
  scriptShare,
  scriptsOf,
  stateOf,
  userPrompt,
  wording,
} from '../utils/prayer.js';
import { fromDevanagari } from '../utils/script.js';

/* ---------- fixtures ---------- */

const T0 = new Date('2026-10-01T00:00:00Z');
const T1 = new Date('2026-10-02T00:00:00Z');
const T2 = new Date('2026-10-03T00:00:00Z');

const verse = (id, position, over = {}) => ({
  id,
  position,
  text: 'ॐ नमो भगवते\nवासुदेवाय',
  meaning: 'Om, I bow to Lord Vasudeva.',
  textChangedAt: T0,
  translations: [],
  ...over,
});

const prayer = (over = {}) => ({
  id: 'p1',
  slug: 'dvadasa-nama',
  category: 'morning',
  status: 'PUBLISHED',
  originalLanguage: 'sa',
  title: 'Twelve names',
  summary: 'A short prayer.',
  about: 'Said at dawn.',
  translations: [],
  verses: [verse('v1', 1), verse('v2', 2)],
  ...over,
});

const row = (languageCode, over = {}) => ({ languageCode, text: null, renderedAt: null, meaning: null, isEdited: false, runId: null, ...over });
const head = (languageCode, over = {}) => ({ languageCode, title: 'x', summary: null, about: null, isEdited: false, runId: null, ...over });

const TAMIL_TEXT = 'ஓம் நமோ பகவதே\nவாஸுதேவாய';

/* ---------- howText ---------- */

test('howText: a reader whose script is the original’s needs nothing made', () => {
  for (const [from, to] of [['sa', 'hi'], ['sa', 'mr'], ['sa', 'sa'], ['hi', 'sa'], ['mr', 'hi'], ['bn', 'as'], ['as', 'bn'], ['ta', 'ta'], ['en', 'en']]) {
    assert.equal(howText(from, to), 'same', `${from} → ${to}`);
  }
});

test('howText: a Devanagari original is converted by rule into every rule target', () => {
  for (const from of ['sa', 'hi', 'mr']) {
    for (const to of RULE_TARGETS) assert.equal(howText(from, to), 'rule', `${from} → ${to}`);
  }
});

test('howText: the rule targets are exactly the scripts fromDevanagari writes well', () => {
  assert.deepEqual([...RULE_TARGETS].sort(), ['as', 'bn', 'gu', 'kn', 'ml', 'or', 'pa', 'te']);
  for (const code of RULE_TARGETS) {
    const made = fromDevanagari('नमः', code);
    assert.notEqual(made, 'नमः', `${code} is converted`);
    assert.ok(made.length > 0);
  }
});

test('howText: Tamil and Roman are never made by the rule, whatever the original', () => {
  assert.ok(!RULE_TARGETS.includes('ta'));
  assert.ok(!RULE_TARGETS.includes('en'));
  for (const from of ['sa', 'hi', 'mr']) {
    assert.equal(howText(from, 'ta'), 'model');
    assert.equal(howText(from, 'en'), 'model');
  }
});

test('howText: an original that is not Devanagari is never converted by rule', () => {
  for (const from of ORIGINAL_LANGUAGES.filter((code) => SCRIPT_OF[code] !== 'deva')) {
    for (const l of languages) {
      const how = howText(from, l.code);
      assert.notEqual(how, 'rule', `${from} → ${l.code}`);
      assert.equal(how, SCRIPT_OF[from] === SCRIPT_OF[l.code] ? 'same' : 'model', `${from} → ${l.code}`);
    }
  }
});

test('howText: a Roman original, or a language it does not know, is a model’s job', () => {
  assert.equal(howText('en', 'hi'), 'model');
  assert.equal(howText('en', 'bn'), 'model');
  assert.equal(howText('xx', 'hi'), 'model');
  assert.equal(howText('sa', 'xx'), 'model');
  assert.equal(howText(undefined, 'hi'), 'model');
});

test('config: every original language and every run language has a script', () => {
  for (const code of ORIGINAL_LANGUAGES) assert.ok(SCRIPT_OF[code], code);
  for (const l of languages) assert.ok(SCRIPT_OF[l.code], l.code);
  assert.equal(languages[0].code, 'en', 'Roman letters come first');
  assert.equal(new Set(languages.map((l) => l.code)).size, languages.length);
});

test('categories: ids are unique and known', () => {
  assert.equal(new Set(CATEGORY_IDS).size, categories.length);
  assert.ok(isCategory('morning'));
  assert.ok(!isCategory('mantra'));
  assert.equal(categoryName('aarti'), 'Aartis');
  assert.equal(categoryName('nope'), 'nope');
  assert.ok(isOriginalLanguage('sa'));
  assert.ok(!isOriginalLanguage('en'));
  assert.equal(languageInfo('ta').code, 'ta');
  assert.equal(languageInfo('xx'), null);
});

/* ---------- the scripts a reader is offered ---------- */

test('scriptsOf: the original comes first, then a rule entry for each target in config order', () => {
  const scripts = scriptsOf(prayer());
  assert.deepEqual(scripts[0], { code: 'original', kind: 'original', languages: ['sa', 'hi', 'mr'] });
  assert.deepEqual(
    scripts.slice(1),
    languages.filter((l) => howText('sa', l.code) === 'rule').map((l) => ({ code: l.code, kind: 'rule' }))
  );
});

test('scriptsOf: a stored script is offered only when every verse has it', () => {
  const some = prayer({ verses: [verse('v1', 1, { translations: [row('ta', { text: TAMIL_TEXT })] }), verse('v2', 2)] });
  assert.ok(!scriptsOf(some).some((s) => s.code === 'ta'));

  const all = prayer({
    verses: [verse('v1', 1, { translations: [row('ta', { text: TAMIL_TEXT })] }), verse('v2', 2, { translations: [row('ta', { text: TAMIL_TEXT })] })],
  });
  const scripts = scriptsOf(all);
  assert.deepEqual(scripts.find((s) => s.code === 'ta'), { code: 'ta', kind: 'stored' });
  const codes = scripts.map((s) => s.code);
  assert.ok(codes.indexOf('bn') < codes.indexOf('ta') && codes.indexOf('ta') < codes.indexOf('te'), 'in config order');
});

test('scriptsOf: a blank rendering does not count, and a prayer with no verse offers nothing stored', () => {
  const blank = prayer({ verses: [verse('v1', 1, { translations: [row('ta', { text: '  \n ' })] })] });
  assert.ok(!scriptsOf(blank).some((s) => s.code === 'ta'));
  assert.ok(!scriptsOf(prayer({ verses: [] })).some((s) => s.kind === 'stored'));
});

test('scriptsOf: Roman letters are offered once every verse has them', () => {
  const roman = prayer({ verses: [verse('v1', 1, { translations: [row('en', { text: 'oṃ namo bhagavate' })] })] });
  assert.deepEqual(scriptsOf(roman)[1], { code: 'en', kind: 'stored' });
});

test('scriptsOf: a language that reads the original as it is is never listed again', () => {
  const stored = prayer({ verses: [verse('v1', 1, { translations: [row('hi', { text: 'नमो' })] })] });
  assert.ok(!scriptsOf(stored).some((s) => s.code === 'hi' || s.code === 'mr'));
});

test('scriptsOf: a Tamil original has no rule entries; what is not Tamil has to be stored', () => {
  const tamil = prayer({ originalLanguage: 'ta', verses: [verse('v1', 1, { text: TAMIL_TEXT, translations: [row('hi', { text: 'ॐ नमो' })] })] });
  const scripts = scriptsOf(tamil);
  assert.deepEqual(scripts[0], { code: 'original', kind: 'original', languages: ['ta'] });
  assert.deepEqual(scripts.slice(1), [{ code: 'hi', kind: 'stored' }]);
});

test('scriptsOf: a Bengali original reads as Assamese too', () => {
  assert.deepEqual(scriptsOf(prayer({ originalLanguage: 'bn' }))[0].languages, ['bn', 'as']);
});

/* ---------- a prayer in a reader's language ---------- */

test('wording: the first language in the chain with something written wins', () => {
  const r = { title: 'English', translations: [{ languageCode: 'hi', title: 'हिन्दी' }, { languageCode: 'mr', title: 'मराठी' }] };
  assert.equal(wording(r, ['mr', 'hi', 'en']), 'मराठी');
  assert.equal(wording(r, ['hi', 'en']), 'हिन्दी');
});

test('wording: an empty or blank translation falls through to the next language', () => {
  const r = { title: 'English', translations: [{ languageCode: 'mr', title: '' }, { languageCode: 'hi', title: 'हिन्दी' }, { languageCode: 'ta', title: '   ' }] };
  assert.equal(wording(r, ['mr', 'hi', 'en']), 'हिन्दी');
  assert.equal(wording(r, ['ta', 'en']), 'English');
});

test('wording: reaching English stops the walk, because the plain column is English', () => {
  const r = { title: 'English', translations: [{ languageCode: 'hi', title: 'हिन्दी' }] };
  assert.equal(wording(r, ['en', 'hi']), 'English');
  assert.equal(wording(r, ['en']), 'English');
});

test('wording: each field is worded on its own', () => {
  const r = {
    title: 'English title',
    summary: 'English summary',
    about: null,
    translations: [{ languageCode: 'hi', title: 'शीर्षक', summary: '', about: null }],
  };
  assert.equal(wording(r, ['hi', 'en'], 'title'), 'शीर्षक');
  assert.equal(wording(r, ['hi', 'en'], 'summary'), 'English summary', 'no translated summary: the English one');
  assert.equal(wording(r, ['hi', 'en'], 'about'), null);
});

test('wording: with no chain or no translations the English column is what is read', () => {
  assert.equal(wording({ title: 'English' }), 'English');
  assert.equal(wording({ title: 'English', translations: [] }, ['ta', 'en']), 'English');
  assert.equal(wording({ meaning: 'English meaning', translations: [{ languageCode: 'hi', meaning: 'अर्थ' }] }, ['hi', 'en'], 'meaning'), 'अर्थ');
});

test('present: verses in reading order, each with its meaning in the reader’s language and its stored renderings', () => {
  const r = prayer({
    translations: [head('hi', { title: 'बारह नाम', summary: 'एक छोटी प्रार्थना' })],
    verses: [
      verse('v2', 2, { text: 'second' }),
      verse('v1', 1, {
        translations: [
          row('hi', { meaning: 'हे वासुदेव, प्रणाम', text: 'दूसरी लिपि' }),
          row('ta', { text: TAMIL_TEXT }),
          row('en', { text: '   ' }),
          row('xx', { text: 'unknown language' }),
        ],
      }),
    ],
  });
  const p = present(r, ['hi', 'en']);
  assert.equal(p.title, 'बारह नाम');
  assert.equal(p.about, 'Said at dawn.');
  assert.equal(p.sourceLanguage, 'sa');
  assert.deepEqual(p.verses.map((v) => v.id), ['v1', 'v2']);
  assert.equal(p.verses[0].meaning, 'हे वासुदेव, प्रणाम');
  assert.equal(p.verses[1].meaning, 'Om, I bow to Lord Vasudeva.');
  assert.deepEqual(p.verses[0].renderings, { ta: TAMIL_TEXT }, 'not the same script as the original, not blank, not an unknown language');
  assert.deepEqual(p.scripts, scriptsOf(r));
});

test('presentList: the card shows the reader’s title and the verse count', () => {
  const [card] = presentList([{ ...prayer({ translations: [head('hi', { title: 'बारह नाम' })] }), _count: { verses: 12 } }], ['hi', 'en']);
  assert.equal(card.title, 'बारह नाम');
  assert.equal(card.summary, 'A short prayer.');
  assert.equal(card.verseCount, 12);
  assert.equal(presentList([prayer()], ['en'])[0].verseCount, 0);
});

test('presentItem and presentVerse: nothing undefined reaches the admin page', () => {
  const item = presentItem(prayer({ summary: undefined, about: undefined }));
  assert.equal(item.summary, null);
  assert.equal(item.about, null);
  assert.equal(item.author, null);
  assert.equal(item.sourceUrl, null);
  assert.deepEqual(presentVerse({ id: 'v', position: 1, text: 't', meaning: undefined }), { id: 'v', position: 1, text: 't', meaning: null });
});

/* ---------- when a rendering is out of date ---------- */

test('isStale: a rendering older than the verse’s text is out of date', () => {
  const v = verse('v1', 1, { textChangedAt: T1 });
  assert.equal(isStale(v, row('ta', { text: 'x', renderedAt: T0 })), true);
  assert.equal(isStale(v, row('ta', { text: 'x', renderedAt: T2 })), false);
  assert.equal(isStale(v, row('ta', { text: 'x', renderedAt: T1 })), false, 'the same moment is not older');
});

test('isStale: a rendering with no time is out of date; nothing written is never stale', () => {
  const v = verse('v1', 1);
  assert.equal(isStale(v, row('ta', { text: 'x', renderedAt: null })), true);
  assert.equal(isStale(v, row('ta', { text: '', renderedAt: null })), false);
  assert.equal(isStale(v, row('ta', { text: null })), false);
  assert.equal(isStale(v, undefined), false);
});

/* ---------- what a run still has to do ---------- */

test('needsOf: a draft prayer, or one with no verse, needs nothing', () => {
  for (const r of [prayer({ status: 'DRAFT' }), prayer({ verses: [] })]) {
    const needs = needsOf(r, 'ta');
    assert.equal(needs.any, false);
    assert.equal(needs.header, null);
    assert.deepEqual(needs.verses, []);
    assert.deepEqual(needs.counts, { headers: 0, renderings: 0, meanings: 0, stale: 0 });
  }
});

test('needsOf: Tamil from Sanskrit needs the heading, every rendering and every meaning', () => {
  const needs = needsOf(prayer(), 'ta');
  assert.equal(needs.any, true);
  assert.deepEqual(needs.header, { summary: true, about: true });
  assert.deepEqual(needs.counts, { headers: 1, renderings: 2, meanings: 2, stale: 0 });
  assert.deepEqual(needs.verses.map((n) => [n.verse.id, n.rendering, n.meaning]), [['v1', true, true], ['v2', true, true]]);
});

test('needsOf: the same script needs no rendering, only the heading and the meanings', () => {
  const needs = needsOf(prayer(), 'hi');
  assert.deepEqual(needs.counts, { headers: 1, renderings: 0, meanings: 2, stale: 0 });
  assert.ok(needs.verses.every((n) => !n.rendering && n.meaning));
});

test('needsOf: a rule target needs no rendering either, because the phone converts it', () => {
  for (const code of RULE_TARGETS) assert.equal(needsOf(prayer(), code).counts.renderings, 0, code);
});

test('needsOf: Roman letters need only the renderings, since the title and meanings are already English', () => {
  const needs = needsOf(prayer(), 'en');
  assert.equal(needs.header, null);
  assert.deepEqual(needs.counts, { headers: 0, renderings: 2, meanings: 0, stale: 0 });
});

test('needsOf: a Roman or Tamil original is written for a Devanagari reader by the model, not by rule', () => {
  const tamil = prayer({ originalLanguage: 'ta', verses: [verse('v1', 1, { text: TAMIL_TEXT })] });
  assert.equal(needsOf(tamil, 'hi').counts.renderings, 1);
  assert.equal(needsOf(tamil, 'bn').counts.renderings, 1);
  assert.equal(needsOf(tamil, 'ta').counts.renderings, 0);
});

test('needsOf: the heading asks only for the pieces the English has', () => {
  assert.deepEqual(needsOf(prayer({ summary: null, about: '   ' }), 'ta').header, { summary: false, about: false });
  assert.deepEqual(needsOf(prayer({ summary: 'S', about: null }), 'ta').header, { summary: true, about: false });
});

test('needsOf: a verse with no English meaning is not asked for one', () => {
  const needs = needsOf(prayer({ verses: [verse('v1', 1, { meaning: null }), verse('v2', 2, { meaning: '  ' })] }), 'hi');
  assert.equal(needs.counts.meanings, 0);
  assert.deepEqual(needs.verses, []);
  assert.equal(needs.any, true, 'the heading is still due');
});

test('needsOf: what is written and fresh is not needed again', () => {
  const r = prayer({
    translations: [head('ta', { title: 'தலைப்பு' })],
    verses: [
      verse('v1', 1, { textChangedAt: T0, translations: [row('ta', { text: TAMIL_TEXT, renderedAt: T1, meaning: 'பொருள்' })] }),
      verse('v2', 2, { textChangedAt: T0, translations: [row('ta', { text: TAMIL_TEXT, renderedAt: T1, meaning: 'பொருள்' })] }),
    ],
  });
  const needs = needsOf(r, 'ta');
  assert.equal(needs.any, false);
  assert.deepEqual(needs.counts, { headers: 0, renderings: 0, meanings: 0, stale: 0 });
});

test('needsOf: a rendering made before the text changed is stale and due again', () => {
  const r = prayer({
    translations: [head('ta')],
    verses: [
      verse('v1', 1, { textChangedAt: T2, translations: [row('ta', { text: TAMIL_TEXT, renderedAt: T1, meaning: 'பொருள்' })] }),
      verse('v2', 2, { textChangedAt: T0, translations: [row('ta', { text: TAMIL_TEXT, renderedAt: T1, meaning: 'பொருள்' })] }),
    ],
  });
  const needs = needsOf(r, 'ta');
  assert.deepEqual(needs.counts, { headers: 0, renderings: 1, meanings: 0, stale: 1 });
  assert.deepEqual(needs.verses.map((n) => [n.verse.id, n.rendering, n.meaning, n.stale]), [['v1', true, false, true]]);
});

test('needsOf: a stale rendering is not asked for in a language where the script is not stored', () => {
  const r = prayer({ verses: [verse('v1', 1, { textChangedAt: T2, translations: [row('bn', { text: 'old', renderedAt: T0, meaning: 'অর্থ' })] })], translations: [head('bn')] });
  assert.equal(needsOf(r, 'bn').counts.stale, 0);
  assert.equal(needsOf(r, 'bn').any, false);
});

test('needsOf: a piece a person wrote is protected — stale, forced or not', () => {
  const edited = prayer({
    translations: [head('ta', { isEdited: true })],
    verses: [
      verse('v1', 1, { textChangedAt: T2, translations: [row('ta', { text: TAMIL_TEXT, renderedAt: T0, meaning: 'பொருள்', isEdited: true })] }),
    ],
  });
  for (const force of [false, true]) {
    const needs = needsOf(edited, 'ta', force);
    assert.equal(needs.any, false, `force ${force}`);
    assert.deepEqual(needs.counts, { headers: 0, renderings: 0, meanings: 0, stale: 0 }, `force ${force}`);
  }
});

test('needsOf: a gap in a row a person edited is still filled, and only the gap', () => {
  const r = prayer({
    translations: [head('ta')],
    verses: [verse('v1', 1, { translations: [row('ta', { text: TAMIL_TEXT, renderedAt: T1, meaning: null, isEdited: true })] })],
  });
  const needs = needsOf(r, 'ta');
  assert.deepEqual(needs.verses.map((n) => [n.rendering, n.meaning]), [[false, true]], 'the meaning is missing; the hand-written rendering stays');

  const noText = prayer({
    translations: [head('ta')],
    verses: [verse('v1', 1, { translations: [row('ta', { text: '', meaning: 'பொருள்', isEdited: true })] })],
  });
  assert.deepEqual(needsOf(noText, 'ta').verses.map((n) => [n.rendering, n.meaning]), [[true, false]]);
});

test('needsOf: a hand-written heading is kept, but an empty title is a gap even then', () => {
  assert.equal(needsOf(prayer({ translations: [head('ta', { title: 'தலைப்பு', isEdited: true })] }), 'ta', true).header, null);
  assert.notEqual(needsOf(prayer({ translations: [head('ta', { title: '', isEdited: true })] }), 'ta').header, null);
});

test('needsOf: force redoes what a run wrote, and only what was not written by this very run', () => {
  const done = (runId) =>
    prayer({
      translations: [head('ta', { title: 'தலைப்பு', runId })],
      verses: [verse('v1', 1, { translations: [row('ta', { text: TAMIL_TEXT, renderedAt: T1, meaning: 'பொருள்', runId })] })],
    });

  assert.equal(needsOf(done('r1'), 'ta', false).any, false);

  const forced = needsOf(done('r1'), 'ta', true);
  assert.deepEqual(forced.counts, { headers: 1, renderings: 1, meanings: 1, stale: 0 });

  const again = needsOf(done('r1'), 'ta', true, 'r1');
  assert.equal(again.any, false, 'what run r1 wrote is not forced a second time');

  const other = needsOf(done('r1'), 'ta', true, 'r2');
  assert.deepEqual(other.counts, { headers: 1, renderings: 1, meanings: 1, stale: 0 }, 'another run redoes it');
});

test('needsOf: rows of other languages are ignored', () => {
  const r = prayer({
    translations: [head('te')],
    verses: [verse('v1', 1, { translations: [row('te', { text: 'x', renderedAt: T1, meaning: 'అర్థం' })] })],
  });
  assert.deepEqual(needsOf(r, 'ta').counts, { headers: 1, renderings: 1, meanings: 1, stale: 0 });
});

test('needsOf: the verses come back in reading order and only those with something to do', () => {
  const r = prayer({
    translations: [head('hi')],
    verses: [
      verse('c', 3),
      verse('a', 1),
      verse('b', 2, { translations: [row('hi', { meaning: 'अर्थ' })] }),
    ],
  });
  assert.deepEqual(needsOf(r, 'hi').verses.map((n) => n.verse.id), ['a', 'c']);
});

test('needsOf: verses at one position are ordered by id, so the order never wobbles', () => {
  const r = prayer({ translations: [head('hi')], verses: [verse('b', 1), verse('a', 1)] });
  assert.deepEqual(needsOf(r, 'hi').verses.map((n) => n.verse.id), ['a', 'b']);
});

test('stateOf: translated, missing, stale or partial', () => {
  assert.equal(stateOf({ headers: 0, renderings: 0, meanings: 0, stale: 0 }, true), 'translated');
  assert.equal(stateOf({ headers: 0, renderings: 0, meanings: 0, stale: 0 }, false), 'translated');
  assert.equal(stateOf({ headers: 1, renderings: 2, meanings: 2, stale: 0 }, false), 'missing');
  assert.equal(stateOf({ headers: 0, renderings: 2, meanings: 0, stale: 2 }, true), 'stale');
  assert.equal(stateOf({ headers: 0, renderings: 2, meanings: 0, stale: 1 }, true), 'partial');
  assert.equal(stateOf({ headers: 1, renderings: 0, meanings: 0, stale: 0 }, true), 'partial');
});

/* ---------- the editor ---------- */

test('languageSummaries: what each language holds, with how it is made', () => {
  const r = prayer({
    translations: [head('ta', { isEdited: true })],
    verses: [
      verse('v1', 1, { textChangedAt: T2, translations: [row('ta', { text: TAMIL_TEXT, renderedAt: T1, meaning: 'பொருள்' })] }),
      verse('v2', 2, { translations: [row('ta', { text: TAMIL_TEXT, renderedAt: T1, isEdited: true })] }),
    ],
  });
  const ta = languageSummaries(r).find((l) => l.code === 'ta');
  assert.deepEqual(ta, { code: 'ta', how: 'model', header: true, headerEdited: true, meanings: 1, texts: 2, edited: 2, stale: 1 });
  assert.equal(languageSummaries(r).find((l) => l.code === 'bn').how, 'rule');
  assert.equal(languageSummaries(r).find((l) => l.code === 'hi').how, 'same');
  assert.equal(languageSummaries(r).length, languages.length);
});

test('editorOf: a rule language shows what the rule makes; a model language does not', () => {
  const r = prayer({ verses: [verse('v1', 1, { translations: [row('ta', { text: TAMIL_TEXT, renderedAt: T1, meaning: 'பொருள்', isEdited: true })] })] });
  const bn = editorOf(r, 'bn');
  assert.equal(bn.how, 'rule');
  assert.equal(bn.verses[0].automatic, fromDevanagari(r.verses[0].text, 'bn'));
  assert.notEqual(bn.verses[0].automatic, r.verses[0].text);

  const ta = editorOf(r, 'ta');
  assert.equal(ta.how, 'model');
  assert.equal(ta.verses[0].automatic, null);
  assert.equal(ta.verses[0].text, TAMIL_TEXT);
  assert.equal(ta.verses[0].isEdited, true);
  assert.equal(ta.verses[0].stale, false);
  assert.equal(ta.header, null, 'no heading written yet');

  assert.equal(editorOf(r, 'hi').verses[0].automatic, null);
});

test('editorOf: English has no heading of its own, whatever is stored', () => {
  assert.equal(editorOf(prayer({ translations: [head('en')] }), 'en').header, null);
  assert.deepEqual(editorOf(prayer({ translations: [head('ta', { title: 'T', summary: 'S', about: 'A', isEdited: true })] }), 'ta').header, {
    title: 'T',
    summary: 'S',
    about: 'A',
    isEdited: true,
    translatedBy: null,
  });
});

/* ---------- the prompt ---------- */

const ASK = { n: 1, text: 'ॐ नमो', ask: ['rendering'] };

test('userPrompt: a header request carries the prayer as one JSON object', () => {
  const prompt = userPrompt({ kind: 'header', code: 'ta', languageName: 'Tamil', endonym: 'தமிழ்', originalLanguage: 'sa', items: { title: 'Twelve names', summary: '', about: '', ask: ['title'] } });
  assert.match(prompt, /^kind: header/);
  assert.match(prompt, /Write in Tamil \(தமிழ்\)/);
  assert.ok(prompt.includes('{"title":"Twelve names","summary":"","about":"","ask":["title"]}'));
});

test('userPrompt: a verses request names the original’s script and one JSON object per line', () => {
  const prompt = userPrompt({ kind: 'verses', code: 'te', languageName: 'Telugu', endonym: 'తెలుగు', originalLanguage: 'sa', items: [ASK, { ...ASK, n: 2 }] });
  assert.match(prompt, /^kind: verses/);
  assert.match(prompt, /written in Devanagari script/);
  assert.ok(prompt.includes(JSON.stringify(ASK)));
  assert.equal(prompt.split('\n').filter((l) => l.startsWith('{"n":')).length, 2);
  assert.ok(!prompt.includes(ROMAN_STYLE) && !prompt.includes(TAMIL_CONVENTION), 'a rule target gets no style paragraph');
  assert.match(userPrompt({ kind: 'verses', code: 'hi', languageName: 'Hindi', endonym: 'हिन्दी', originalLanguage: 'ta', items: [ASK] }), /written in Tamil script/);
});

test('userPrompt: Roman and Tamil carry their owner-decided styles', () => {
  assert.ok(userPrompt({ kind: 'verses', code: 'en', languageName: 'English', endonym: 'English', originalLanguage: 'sa', items: [ASK] }).includes(ROMAN_STYLE));
  assert.ok(userPrompt({ kind: 'verses', code: 'ta', languageName: 'Tamil', endonym: 'தமிழ்', originalLanguage: 'sa', items: [ASK] }).includes(TAMIL_CONVENTION));
  assert.match(ROMAN_STYLE, /IAST/);
  assert.match(TAMIL_CONVENTION, /Grantha/);
});

/* ---------- the checks on a model's answer ---------- */

const asked = (n, over = {}) => ({ n, verse: { text: 'ॐ नमो भगवते\nवासुदेवाय' }, rendering: true, meaning: false, ...over });
const answer = (...verses) => ({ verses });

test('scriptShare: letters in the script over all letters; digits and punctuation do not count', () => {
  assert.equal(scriptShare('', [[0x0b80, 0x0bff]]), 0);
  assert.equal(scriptShare('12 ।। 34', [[0x0900, 0x097f]]), 0);
  assert.equal(scriptShare('ॐ नमो', [[0x0900, 0x097f]]), 1);
  assert.ok(scriptShare('ॐ abc', [[0x0900, 0x097f]]) < 0.5);
});

test('checkAnswer: a good Tamil rendering and meaning pass and are returned by n', () => {
  const out = checkAnswer(answer({ n: 1, rendering: TAMIL_TEXT, meaning: 'ஓம், வாசுதேவருக்கு வணக்கம்.' }), [asked(1, { meaning: true })], 'ta');
  assert.equal(out.ok, true);
  assert.deepEqual(out.problems, []);
  assert.deepEqual(out.items, [{ n: 1, rendering: TAMIL_TEXT, meaning: 'ஓம், வாசுதேவருக்கு வணக்கம்.' }]);
});

test('checkAnswer: a verse that is missing, or came back twice, is a problem', () => {
  const missing = checkAnswer(answer({ n: 1, rendering: TAMIL_TEXT, meaning: '' }), [asked(1), asked(2)], 'ta');
  assert.equal(missing.ok, false);
  assert.match(missing.problems.join(' '), /verse 2 is missing/);
  assert.deepEqual(missing.items.map((i) => i.n), [1], 'the good one is kept');

  const twice = checkAnswer(answer({ n: 1, rendering: TAMIL_TEXT }, { n: 1, rendering: TAMIL_TEXT }), [asked(1)], 'ta');
  assert.equal(twice.ok, false);
  assert.match(twice.problems[0], /more than once/);
  assert.deepEqual(twice.items, []);
});

test('checkAnswer: n may come back as a numeric string; rows without a usable n are ignored', () => {
  const out = checkAnswer(answer({ n: '1', rendering: TAMIL_TEXT }, { rendering: 'no n' }, null, { n: {}, rendering: 'bad n' }), [asked(1)], 'ta');
  assert.equal(out.ok, true);
});

test('checkAnswer: an answer that is not a list leaves every verse missing', () => {
  for (const data of [null, undefined, {}, { verses: 'no' }]) {
    const out = checkAnswer(data, [asked(1), asked(2)], 'ta');
    assert.equal(out.ok, false);
    assert.equal(out.problems.length, 2);
    assert.deepEqual(out.items, []);
  }
});

test('checkAnswer: a rendering with another number of lines is refused; blank lines do not count', () => {
  const lost = checkAnswer(answer({ n: 1, rendering: 'ஓம் நமோ பகவதே வாஸுதேவாய' }), [asked(1)], 'ta');
  assert.equal(lost.ok, false);
  assert.match(lost.problems[0], /1 lines, the verse has 2/);

  const blankLine = checkAnswer(answer({ n: 1, rendering: 'ஓம் நமோ பகவதே\n\nவாஸுதேவாய' }), [asked(1)], 'ta');
  assert.equal(blankLine.ok, true);
});

test('checkAnswer: a rendering in the wrong script, or empty, is refused', () => {
  const wrong = checkAnswer(answer({ n: 1, rendering: 'ॐ नमो भगवते\nवासुदेवाय' }), [asked(1)], 'ta');
  assert.equal(wrong.ok, false);
  assert.match(wrong.problems[0], /not written in Tamil/);

  const empty = checkAnswer(answer({ n: 1, rendering: '  ' }), [asked(1)], 'ta');
  assert.match(empty.problems[0], /rendering is empty/);
});

test('checkAnswer: a meaning left in English for a Tamil reader is refused, and the good rendering beside it is kept', () => {
  const out = checkAnswer(answer({ n: 1, rendering: TAMIL_TEXT, meaning: 'Om, I bow to Lord Vasudeva.' }), [asked(1, { meaning: true })], 'ta');
  assert.equal(out.ok, false);
  assert.match(out.problems[0], /meaning is not written in Tamil/);
  assert.deepEqual(out.items, [{ n: 1, rendering: TAMIL_TEXT }]);
});

test('checkAnswer: only what was asked for is checked', () => {
  const out = checkAnswer(answer({ n: 1, rendering: 'English here', meaning: 'அர்த்தம்' }), [asked(1, { rendering: false, meaning: true })], 'ta');
  assert.equal(out.ok, true);
  assert.deepEqual(out.items, [{ n: 1, meaning: 'அர்த்தம்' }]);
});

test('checkAnswer: Roman letters take IAST and refuse an Indic script', () => {
  const iast = checkAnswer(answer({ n: 1, rendering: 'oṃ namo bhagavate\nvāsudevāya' }), [asked(1)], 'en');
  assert.equal(iast.ok, true);

  const indic = checkAnswer(answer({ n: 1, rendering: 'ॐ नमो भगवते\nवासुदेवाय' }), [asked(1)], 'en');
  assert.equal(indic.ok, false);
  assert.match(indic.problems[0], /not written in English/);
});

test('checkAnswer: Roman letters are put in one composed form, and line ends are tidied', () => {
  const out = checkAnswer(answer({ n: 1, rendering: 'oṃ namo bhagavate  \r\nvāsudevāya' }), [asked(1)], 'en');
  assert.equal(out.ok, true);
  assert.equal(out.items[0].rendering, 'oṃ namo bhagavate\nvāsudevāya'.normalize('NFC'));
  assert.ok(!out.items[0].rendering.includes('\r'));
});

test('checkHeader: a good heading passes, with only the pieces asked for', () => {
  const out = checkHeader({ title: 'பன்னிரண்டு நாமங்கள்', summary: 'ஒரு சிறிய பிரார்த்தனை', about: 'காலையில் சொல்லப்படும்' }, { summary: true, about: true }, 'ta');
  assert.equal(out.ok, true);
  assert.deepEqual(Object.keys(out.header), ['title', 'summary', 'about']);

  const titleOnly = checkHeader({ title: 'பன்னிரண்டு நாமங்கள்', summary: 'English, but not asked for', about: '' }, { summary: false, about: false }, 'ta');
  assert.equal(titleOnly.ok, true);
  assert.deepEqual(Object.keys(titleOnly.header), ['title']);
});

test('checkHeader: an empty, over-long or wrong-script piece is refused and the rest kept', () => {
  const english = checkHeader({ title: 'பன்னிரண்டு நாமங்கள்', summary: 'A short prayer', about: 'காலையில்' }, { summary: true, about: true }, 'ta');
  assert.equal(english.ok, false);
  assert.match(english.problems[0], /summary is not written in Tamil/);
  assert.deepEqual(Object.keys(english.header), ['title', 'about']);

  assert.match(checkHeader({ title: '' }, { summary: false, about: false }, 'ta').problems[0], /title is empty/);
  assert.match(checkHeader({ title: 'அ'.repeat(401) }, { summary: false, about: false }, 'ta').problems[0], /title is too long/);
  assert.match(checkHeader({ title: 'அ', summary: 'அ'.repeat(801) }, { summary: true, about: false }, 'ta').problems[0], /summary is too long/);
  assert.match(checkHeader({ title: 'அ', summary: 'அ', about: '' }, { summary: true, about: true }, 'ta').problems[0], /about text is empty/);
  assert.match(checkHeader({ title: 'Twelve names' }, { summary: false, about: false }, 'ta').problems[0], /title is not written in Tamil/);
});

test('the answer schemas ask for everything and nothing else', () => {
  assert.deepEqual(HEADER_SCHEMA.required, ['title', 'summary', 'about']);
  assert.deepEqual(VERSES_SCHEMA.properties.verses.items.required, ['n', 'rendering', 'meaning']);
  assert.equal(HEADER_SCHEMA.additionalProperties, false);
  assert.equal(VERSES_SCHEMA.properties.verses.items.additionalProperties, false);
});

/* ---------- a run, as the page receives it ---------- */

const run = (over = {}) => ({
  id: 'r1',
  language: 'ta',
  provider: 'openai',
  model: 'gpt-6-luna',
  force: false,
  status: 'RUNNING',
  pauseReason: null,
  statusMessage: null,
  stopReason: null,
  resumeAt: null,
  cancelRequested: false,
  currentSlug: 'dvadasa-nama',
  totalItems: 10,
  doneItems: 4,
  inputTokens: 100,
  outputTokens: 50,
  calls: 3,
  activeSeconds: 40,
  attempts: 1,
  requestedById: null,
  requestedByName: null,
  createdAt: T0,
  startedAt: T0,
  finishedAt: null,
  heartbeatAt: T0,
  ...over,
});

test('presentRun: progress, an estimate of what is left, and the language by name', () => {
  const p = presentRun(run(), new Date(T0.getTime() + 1000));
  assert.equal(p.languageName, 'Tamil');
  assert.deepEqual(p.progress, { total: 10, done: 4, percent: 40, currentSlug: 'dvadasa-nama', etaSeconds: 60 });
  assert.deepEqual(p.usage, { inputTokens: 100, outputTokens: 50, calls: 3 });
  assert.equal(p.stalled, false);
  assert.equal(p.requestedBy, null);
});

test('presentRun: no estimate before the first prayer, or when the run is not running; percent never passes 100', () => {
  assert.equal(presentRun(run({ doneItems: 0 }), T0).progress.etaSeconds, null);
  assert.equal(presentRun(run({ status: 'PAUSED' }), T0).progress.etaSeconds, null);
  assert.equal(presentRun(run({ totalItems: 0, doneItems: 0 }), T0).progress.percent, 0);
  assert.equal(presentRun(run({ totalItems: 4, doneItems: 9 }), T0).progress.percent, 100);
});

test('presentRun: a running run whose heartbeat has stopped is stalled', () => {
  const late = new Date(T0.getTime() + (cfg.staleHeartbeatSeconds + 5) * 1000);
  assert.equal(presentRun(run(), late).stalled, true);
  assert.equal(presentRun(run({ status: 'PAUSED' }), late).stalled, false);
  assert.equal(presentRun(run({ heartbeatAt: null }), late).stalled, false);
});

test('presentRun: who started it', () => {
  assert.deepEqual(presentRun(run({ requestedById: 'u1', requestedByName: 'Asha' }), T0).requestedBy, { id: 'u1', name: 'Asha' });
});
