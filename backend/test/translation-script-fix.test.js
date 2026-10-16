// The rule-based repair of the Malayalam and Tamil Gita translations: what counts as a script flaw, what is converted,
// what is left for a translation, and how a repaired verse is scored and stamped again. Pure functions plus the command
// line against a temporary folder — no network, no S3, no API key.

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, describe, test } from 'node:test';
import { promisify } from 'node:util';

import { verifyEntry } from '../scripts/lib/claude-translate-run.js';
import { TRANSLATOR, chapterKey, saChapterKey, sourceHash } from '../scripts/lib/claude-translate-source.js';
import { backupKey, checkpointKey, langChapterKey } from '../scripts/lib/claude-translate-store.js';
import {
  WRONG_LANGUAGE_LETTERS, foreignRuns, fixProse, fixVerse, partOfMessage, rescoreVerse, sanskritFlaw, selfRatings, verseScore,
} from '../scripts/lib/translation-script-fix.js';
import { iastTo, sanskritLine } from '../scripts/lib/translation-script.js';

const run = promisify(execFile);
const dirs = [];
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

/* ---------- fixtures ---------- */

const VERSION = '1.0-test';
const LINES = ['dhṛtarāṣṭra uvāca .', 'dharmakṣetre kurukṣetre samavetā yuyutsavaḥ .', 'māmakāḥ pāṇḍavāścaiva kimakurvata sañjaya ||1-2||'];
const WORDS = [
  { word: 'dhṛtarāṣṭraḥ uvāca', meaning: 'King Dhṛtarāṣṭra said' },
  { word: 'dharma-kṣetre', meaning: 'in the place of pilgrimage' },
  { word: 'kuru-kṣetre', meaning: 'in the place named Kurukṣetra' },
];
/** The English of verse 1.2.1: what the validator compares a saved verse with. No purport, to keep the fixtures short. */
const UNIT = {
  verseId: '1.2.1', chapterNumber: 2, verseNumber: 1, verseNumberEnd: null, cantoNumber: null, bookNumber: 1, globalVerseNumber: 41, ref: '2.1',
  translation: 'Dhṛtarāṣṭra said: O Sañjaya, what did my sons and the sons of Pāṇḍu do on the sacred field of Kurukṣetra?',
  purport: [], transliteration: LINES, wordMeanings: WORDS,
};

/** What a faithful translator wrote in each language. */
const TEXT = {
  ml: {
    translation: 'ധൃതരാഷ്ട്രൻ പറഞ്ഞു: ഹേ സഞ്ജയാ, എന്റെ പുത്രന്മാരും പാണ്ഡുവിന്റെ പുത്രന്മാരും പുണ്യഭൂമിയായ കുരുക്ഷേത്രത്തിൽ എന്തു ചെയ്തു?',
    meanings: ['ധൃതരാഷ്ട്ര രാജാവ് പറഞ്ഞു', 'തീർത്ഥസ്ഥലത്ത്', 'കുരുക്ഷേത്രം എന്ന സ്ഥലത്ത്'],
  },
  ta: {
    translation: 'திருதராஷ்டிரர் கூறினார்: ஹே சஞ்சயா, என் புதல்வர்களும் பாண்டுவின் புதல்வர்களும் புனிதமான குருக்ஷேத்திரத்தில் என்ன செய்தார்கள்?',
    meanings: ['திருதராஷ்டிர மன்னர் கூறினார்', 'புனிதத் தலத்தில்', 'குருக்ஷேத்திரம் என்ற இடத்தில்'],
  },
};

const row = (lang, type, text, extra = {}) => ({ translatorSlug: TRANSLATOR, type, language: lang, displayOrder: 1, text, translatedBy: 'claude', version: VERSION, correctness: 3, ...extra });
const stampBase = { provider: 'openai', model: 'gpt-6-luna', effort: 'off', promptVersion: '6', generatedAt: '2026-10-15T10:00:00.000Z' };

/** A saved verse the way the pipeline writes it. `shape` is 'legacy' (one stamp for the verse) or 'parts' (one stamp per part). */
function saved(lang, { shape = 'legacy', ratings = {}, transliteration, wordMeanings } = {}) {
  const t = TEXT[lang];
  const rate = (part) => ratings[part] ?? 3;
  const warn = (part) => (ratings[part] && ratings[part] < 3 ? [`${part}: rated ${ratings[part]} by Claude`] : []);
  const partNames = ['translation', 'transliteration', 'wordMeanings'];
  const aiTranslation = shape === 'legacy'
    ? {
      translatedBy: 'claude', version: VERSION, ...stampBase, sourceHash: sourceHash(UNIT), correctness: Math.min(...partNames.map(rate)),
      partScores: Object.fromEntries(partNames.map((p) => [p, rate(p)])), note: '', warnings: partNames.flatMap(warn),
    }
    : {
      translatedBy: 'claude', version: VERSION, sourceHash: sourceHash(UNIT), correctness: Math.min(...partNames.map(rate)),
      partScores: Object.fromEntries(partNames.map((p) => [p, rate(p)])), warnings: partNames.flatMap(warn),
      parts: Object.fromEntries(partNames.map((p) => [p, { ...stampBase, version: VERSION, correctness: rate(p), warnings: warn(p), note: '' }])),
    };
  return {
    verseId: UNIT.verseId, chapterNumber: 2, verseNumber: 1,
    transliteration: transliteration ?? LINES.map((l) => sanskritLine(l, lang)).join('\n'),
    wordMeanings: wordMeanings ?? WORDS.map((w, i) => ({ word: iastTo(lang, w.word), meaning: t.meanings[i] })),
    commentaries: [
      row(lang, 'translation', t.translation, { correctness: rate('translation') }),
      // Rows that are not Prabhupāda's in this language must never be touched.
      { translatorSlug: 'sivananda', type: 'translation', language: lang, displayOrder: 1, text: 'धर्मक्षेत्रे कुरुक्षेत्रे' },
      row(lang === 'ml' ? 'ta' : 'ml', 'translation', 'धर्मक्षेत्रे कुरुक्षेत्रे'),
    ],
    aiTranslation,
  };
}

const DEVANAGARI_LINE = 'धर्मक्षेत्रे कुरुक्षेत्रे समवेता युयुत्सवः ।';

/* ---------- finding the flaws ---------- */

describe('foreignRuns', () => {
  test('finds a run of another script with its offsets, letters and script name', () => {
    const text = 'ഭഗവാൻ धर्मक्षेत्रे പറഞ്ഞു';
    const [r, ...rest] = foreignRuns('ml', text);
    assert.equal(rest.length, 0);
    assert.equal(r.kind, 'indic');
    assert.equal(r.scripts, 'Devanagari');
    assert.equal(r.text, 'धर्मक्षेत्रे');
    assert.equal(text.slice(r.start, r.end), r.text);
    assert.equal(r.letters, 12);
  });

  test('the language\'s own script, digits, punctuation and the danda are not foreign', () => {
    assert.deepEqual(foreignRuns('ml', 'ഭഗവാൻ ഉവാച ॥ 2.47 (ഹേ)।'), []);
    assert.deepEqual(foreignRuns('ta', 'பகவான் கூறினார் ॥ 2.47 (ஹே)।'), []);
  });

  test('spaces and digits inside a run do not end it, a different kind of letters does', () => {
    const runs = foreignRuns('ml', 'धर्म 2 क्षेत्र the Lord');
    assert.deepEqual(runs.map((r) => [r.kind, r.text]), [['indic', 'धर्म 2 क्षेत्र'], ['latin', 'the Lord']]);
  });

  test('another language\'s block is foreign: Malayalam inside Tamil text', () => {
    assert.equal(foreignRuns('ta', 'பகவான் ഭഗവാൻ கூறினார்')[0].scripts, 'Malayalam');
  });
});

describe('sanskritFlaw', () => {
  test('clean text has none', () => {
    assert.deepEqual(sanskritFlaw('ml', 'ധർമ്മക്ഷേത്രേ കുരുക്ഷേത്രേ ।'), []);
    assert.deepEqual(sanskritFlaw('ta', 'தர்மக்ஷேத்ரே குருக்ஷேத்ரே ॥1-2॥'), []);
  });

  test('another Indic script', () => assert.deepEqual(sanskritFlaw('ml', 'धर्म'), ['other-script']));
  test('Roman letters', () => assert.deepEqual(sanskritFlaw('ml', 'dharma'), ['latin']));
  test('a colon standing for a visarga', () => assert.deepEqual(sanskritFlaw('ml', 'യുയുത്സവ:'), ['colon-as-visarga']));
  test('superscript digits', () => assert.deepEqual(sanskritFlaw('ml', 'ധർമ²'), ['superscript']));
  test('the Tamil anusvara sign, which Tamil text does not use', () => assert.deepEqual(sanskritFlaw('ta', 'தர்மஂ'), ['tamil-anusvara']));
  test('a modifier apostrophe (U+02BC), which is a letter to the validator', () => assert.deepEqual(sanskritFlaw('ta', 'பகவாʼன்'), ['modifier-apostrophe']));
  test('a digit after a letter, marking a voiced or aspirated stop', () => assert.deepEqual(sanskritFlaw('ta', 'க3'), ['digits']));
  test('but the verse number after a danda is not one', () => assert.deepEqual(sanskritFlaw('ta', 'ஸஞ்ஜய ॥1-2॥'), []));
});

/* ---------- prose ---------- */

describe('fixProse', () => {
  test('a Sanskrit quote in Devanagari inside a purport is converted', () => {
    const r = fixProse('ml', 'ഭഗവാൻ धर्मक्षेत्रे कुरुक्षेत्रे പറഞ്ഞു', 'purport');
    assert.equal(r.text, 'ഭഗവാൻ ധർമക്ഷേത്രേ കുരുക്ഷേത്രേ പറഞ്ഞു');
    assert.deepEqual(r.changes.map((c) => c.how), ['deva-quote']);
    assert.deepEqual(r.leftovers, []);
  });

  test('the same run in a translation or a word meaning is a text in the wrong language, so it is left alone', () => {
    for (const field of ['translation', 'meaning']) {
      const text = 'ഭഗവാൻ धर्मक्षेत्रे പറഞ്ഞു';
      const r = fixProse('ml', text, field);
      assert.equal(r.text, text, field);
      assert.deepEqual(r.changes, [], field);
      assert.equal(r.leftovers[0].kind, 'wrong-language', field);
      assert.equal(r.leftovers[0].script, 'Devanagari', field);
    }
  });

  test(`fewer than ${WRONG_LANGUAGE_LETTERS} stray letters of another script are converted even in a translation`, () => {
    const r = fixProse('ml', 'ഭഗവാൻ धर् പറഞ്ഞു', 'translation');
    assert.equal(r.text, 'ഭഗവാൻ ധർ പറഞ്ഞു');
    assert.deepEqual(r.changes.map((c) => c.how), ['stray-letters']);
  });

  test('Hindi in a purport is not Sanskrit and is left for a translation', () => {
    const text = 'ഭഗവാൻ यह धर्म है और अच्छा पाठ പറഞ്ഞു';
    const r = fixProse('ml', text, 'purport');
    assert.equal(r.text, text);
    assert.equal(r.leftovers[0].kind, 'wrong-language');
  });

  test('IAST quoted in prose is converted, capital letters and all', () => {
    assert.equal(fixProse('ml', 'ഭഗവാൻ Kṛṣṇa പറഞ്ഞു', 'translation').text, 'ഭഗവാൻ കൃഷ്ണ പറഞ്ഞു');
    assert.equal(fixProse('ta', 'பகவான் ṛṣi கூறினார்', 'purport').text, `பகவான் ${iastTo('ta', 'ṛṣi')} கூறினார்`);
    assert.equal(fixProse('ml', 'ഭഗവാൻ dharmaḥ പറഞ്ഞു', 'translation').text, 'ഭഗവാൻ ധർമഃ പറഞ്ഞു');
  });

  test('an English word left in Roman letters is reported, not converted', () => {
    const r = fixProse('ml', 'ഭഗവാൻ the Lord പറഞ്ഞു', 'translation');
    assert.equal(r.text, 'ഭഗവാൻ the Lord പറഞ്ഞു');
    assert.equal(r.leftovers[0].kind, 'english-word');
    assert.equal(fixProse('ta', 'ஆசிரியர் ok கூறினார்', 'purport').leftovers[0].kind, 'latin-short');
  });

  test('Tamil: two Sanskrit names written with a vowel sign of another script are spelled the way the corpus spells them', () => {
    const krishna = fixProse('ta', 'கൃഷ്ണ கூறினார்', 'purport');
    assert.equal(krishna.text, 'கிருஷ்ண கூறினார்');
    assert.deepEqual(krishna.changes.map((c) => c.how), ['known-name']);
    assert.equal(fixProse('ta', 'நृஸிம்ஹ தேவர்', 'translation').text, 'நரசிம்ம தேவர்');
  });

  test('Tamil: any other vowel sign of another script on a Tamil letter cannot be converted by rule and is reported', () => {
    const text = 'தர்மம் தൃஷ்ணா கூறினார்';
    const r = fixProse('ta', text, 'purport');
    assert.equal(r.text, text);
    assert.equal(r.leftovers[0].kind, 'orphan-sign');
  });

  test('Tamil: a visarga sign of another script after a Tamil letter is not an orphan; it becomes ஃ', () => {
    assert.equal(fixProse('ta', 'நமः கூறினார்', 'meaning').text, 'நமஃ கூறினார்');
  });

  test('Tamil: superscript digits after a Tamil letter are the older style and are dropped', () => {
    const r = fixProse('ta', 'பகவான் அ² கூறினார்', 'purport');
    assert.equal(r.text, 'பகவான் அ கூறினார்');
    assert.deepEqual(r.changes.map((c) => c.how), ['superscript']);
  });

  test('clean text comes back unchanged with nothing reported', () => {
    const r = fixProse('ml', TEXT.ml.translation, 'translation');
    assert.deepEqual(r, { text: TEXT.ml.translation, changes: [], leftovers: [] });
  });
});

/* ---------- a saved verse ---------- */

for (const lang of ['ml', 'ta']) {
  describe(`fixVerse (${lang})`, () => {
    test('a clean verse is left exactly as it was', () => {
      const verse = saved(lang);
      const r = fixVerse(lang, verse, UNIT);
      assert.deepEqual(r.verse, verse);
      assert.deepEqual(r.changes, []);
      assert.deepEqual(r.leftovers, []);
      assert.deepEqual(r.parts, []);
    });

    test('a transliteration line in the wrong script is rebuilt from the English, and only that line', () => {
      const lines = saved(lang).transliteration.split('\n');
      lines[1] = DEVANAGARI_LINE;
      const verse = saved(lang, { transliteration: lines.join('\n') });
      const r = fixVerse(lang, verse, UNIT);
      assert.equal(r.verse.transliteration, saved(lang).transliteration);
      assert.deepEqual(r.changes, [{ part: 'transliteration', how: 'line-regenerated', flaws: ['other-script'], line: 1 }]);
      assert.deepEqual(r.parts, ['transliteration']);
    });

    test('the Sanskrit word of a word meaning is rebuilt the same way; its meaning is kept', () => {
      const wordMeanings = saved(lang).wordMeanings.map((w) => ({ ...w }));
      wordMeanings[1].word = 'धर्म-क्षेत्रे';
      const r = fixVerse(lang, saved(lang, { wordMeanings }), UNIT);
      assert.equal(r.verse.wordMeanings[1].word, iastTo(lang, 'dharma-kṣetre'));
      assert.equal(r.verse.wordMeanings[1].meaning, TEXT[lang].meanings[1]);
      assert.deepEqual(r.changes.map((c) => [c.part, c.how, c.i]), [['wordMeanings', 'word-regenerated', 1]]);
    });

    test('the flaws a line can have are each enough to rebuild it', () => {
      const bad = { 'colon-as-visarga': (l) => l.replace(/ഃ|ஃ/g, ':'), superscript: (l) => `${l}²`, 'modifier-apostrophe': (l) => `${l}ʼ`, digits: (l) => l.replace(/(?<=[ഀ-ൿ஀-௿])(?=\s|$)/, '3') };
      for (const [flaw, damage] of Object.entries(bad)) {
        const lines = saved(lang).transliteration.split('\n');
        lines[1] = damage(lines[1]);
        const r = fixVerse(lang, saved(lang, { transliteration: lines.join('\n') }), UNIT);
        assert.equal(r.verse.transliteration, saved(lang).transliteration, flaw);
        assert.ok(r.changes.some((c) => c.how === 'line-regenerated' && c.flaws.includes(flaw)), flaw);
      }
    });

    test('a line with no script flaw that is far from the English is reported and kept', () => {
      const lines = saved(lang).transliteration.split('\n');
      lines[1] = lang === 'ml' ? 'ധൃതരാഷ്ട്രൻ പറഞ്ഞു' : 'திருதராஷ்டிரர் கூறினார்';
      const r = fixVerse(lang, saved(lang, { transliteration: lines.join('\n') }), UNIT);
      assert.equal(r.verse.transliteration.split('\n')[1], lines[1]);
      assert.deepEqual(r.changes, []);
      assert.equal(r.leftovers[0].kind, 'line-differs-from-english');
      assert.equal(r.leftovers[0].line, 1);
      assert.equal(r.leftovers[0].english, LINES[1]);
    });

    test('a different number of lines is reported and nothing is rebuilt', () => {
      const verse = saved(lang, { transliteration: DEVANAGARI_LINE });
      const r = fixVerse(lang, verse, UNIT);
      assert.equal(r.verse.transliteration, DEVANAGARI_LINE);
      assert.deepEqual(r.leftovers.map((l) => l.kind), ['line-count']);
    });

    test('a different number of word entries is reported and nothing is rebuilt', () => {
      const verse = saved(lang);
      verse.wordMeanings = verse.wordMeanings.slice(0, 2);
      verse.wordMeanings[0].word = 'धर्म';
      const r = fixVerse(lang, verse, UNIT);
      assert.equal(r.verse.wordMeanings[0].word, 'धर्म');
      assert.deepEqual(r.leftovers.map((l) => l.kind), ['entry-count']);
    });

    test('prose is repaired in Prabhupāda\'s rows of this language only', () => {
      const verse = saved(lang);
      verse.commentaries[0].text += ' dharmaḥ';
      const r = fixVerse(lang, verse, UNIT);
      assert.equal(r.verse.commentaries[0].text, `${TEXT[lang].translation} ${iastTo(lang, 'dharmaḥ')}`);
      assert.deepEqual(r.verse.commentaries.slice(1), verse.commentaries.slice(1)); // another translator, another language
      assert.deepEqual(r.parts, ['translation']);
    });

    test('text in the wrong language in a translation is reported with the part it belongs to', () => {
      const verse = saved(lang);
      verse.commentaries[0].text = 'धृतराष्ट्र ने कहा';
      const r = fixVerse(lang, verse, UNIT);
      assert.equal(r.verse.commentaries[0].text, 'धृतराष्ट्र ने कहा');
      assert.deepEqual(r.leftovers.map((l) => [l.part, l.kind]), [['translation', 'wrong-language']]);
      assert.deepEqual(r.parts, []);
    });

    test('the verse that was passed in is not changed', () => {
      const lines = saved(lang).transliteration.split('\n');
      lines[1] = DEVANAGARI_LINE;
      const verse = saved(lang, { transliteration: lines.join('\n') });
      const copy = JSON.parse(JSON.stringify(verse));
      fixVerse(lang, verse, UNIT);
      assert.deepEqual(verse, copy);
    });

    test('running it again on its own result changes nothing', () => {
      const lines = saved(lang).transliteration.split('\n');
      lines[1] = DEVANAGARI_LINE;
      const wordMeanings = saved(lang).wordMeanings.map((w) => ({ ...w }));
      wordMeanings[2].word = 'कुरु-क्षेत्रे';
      const once = fixVerse(lang, saved(lang, { transliteration: lines.join('\n'), wordMeanings }), UNIT);
      const twice = fixVerse(lang, once.verse, UNIT);
      assert.deepEqual(twice.verse, once.verse);
      assert.deepEqual(twice.changes, []);
    });
  });
}

/* ---------- scores ---------- */

describe('messages and ratings', () => {
  test('partOfMessage reads the part a validator message is about', () => {
    assert.equal(partOfMessage('word 3 meaning: x'), 'wordMeanings');
    assert.equal(partOfMessage('word 12 word: x'), 'wordMeanings');
    assert.equal(partOfMessage('transliteration line 2: x'), 'transliteration');
    assert.equal(partOfMessage('purport ¶1: x'), 'purport');
    assert.equal(partOfMessage('translation: x'), 'translation');
    assert.equal(partOfMessage('something else'), null);
  });

  test('selfRatings reads only "<part>: rated N by …"', () => {
    assert.deepEqual(selfRatings(['translation: rated 2 by Claude', 'purport: rated 1 by Claude', 'wordMeanings: oops', 'word 3 meaning: x']), { translation: 2, purport: 1 });
    assert.deepEqual(selfRatings(), {});
  });

  test('verseScore is the lowest part, whichever way the verse is stamped', () => {
    assert.equal(verseScore(saved('ml', { ratings: { wordMeanings: 2 } })), 2);
    assert.equal(verseScore(saved('ml', { shape: 'parts', ratings: { transliteration: 1 } })), 1);
    assert.equal(verseScore(saved('ml')), 3);
  });
});

describe('rescoreVerse', () => {
  /** A verse whose transliteration has a Devanagari line, repaired. */
  function repaired(lang, options = {}, rescore = {}) {
    const lines = saved(lang).transliteration.split('\n');
    lines[1] = DEVANAGARI_LINE;
    const before = saved(lang, { transliteration: lines.join('\n'), ...options });
    const fixed = fixVerse(lang, before, UNIT);
    return { before, fixed, after: rescoreVerse(lang, before, fixed.verse, UNIT, fixed.parts, { fixedAt: 'T', ...rescore }) };
  }

  for (const lang of ['ml', 'ta']) {
    test(`${lang}: nothing repaired, nothing re-scored`, () => {
      const verse = saved(lang);
      assert.equal(rescoreVerse(lang, verse, verse, UNIT, []), verse);
    });

    test(`${lang}: a verse stamped as a whole gets the repaired part's new score, a mark, and keeps the other parts' ratings`, () => {
      const { after } = repaired(lang, { ratings: { transliteration: 1, wordMeanings: 2 } });
      const ai = after.aiTranslation;
      assert.equal(ai.partScores.transliteration, 3, 'the rating of text that is gone is dropped, so the validator decides');
      assert.equal(ai.partScores.wordMeanings, 2, 'a part nobody touched keeps the model\'s own rating');
      assert.equal(ai.correctness, 2);
      assert.deepEqual(ai.scriptFix, { at: 'T', parts: ['transliteration'] });
      assert.ok(!ai.warnings.includes('transliteration: rated 1 by Claude'));
      assert.ok(ai.warnings.includes('wordMeanings: rated 2 by Claude'));
    });

    test(`${lang}: --keep-rating keeps the model's own rating of the rebuilt transliteration`, () => {
      const { after } = repaired(lang, { ratings: { transliteration: 1 } }, { keepTransliterationRating: true });
      assert.equal(after.aiTranslation.partScores.transliteration, 1);
    });

    test(`${lang}: a verse stamped per part changes only the repaired part's stamp`, () => {
      const { before, after } = repaired(lang, { shape: 'parts', ratings: { transliteration: 1, wordMeanings: 2 } });
      const ai = after.aiTranslation;
      assert.equal(ai.parts.transliteration.correctness, 3);
      assert.equal(ai.parts.transliteration.scriptFix, 'T');
      assert.deepEqual(ai.parts.translation, before.aiTranslation.parts.translation);
      assert.deepEqual(ai.parts.wordMeanings, before.aiTranslation.parts.wordMeanings);
      assert.deepEqual(ai.partScores, { translation: 3, transliteration: 3, wordMeanings: 2 });
      assert.equal(ai.correctness, 2);
      assert.deepEqual(ai.warnings, ['wordMeanings: rated 2 by Claude']);
    });

    test(`${lang}: the translation row's correctness follows its part when the translation was repaired`, () => {
      const before = saved(lang, { ratings: { translation: 2 } });
      before.commentaries[0].text += ' dharmaḥ';
      const fixed = fixVerse(lang, before, UNIT);
      assert.deepEqual(fixed.parts, ['translation']);
      const after = rescoreVerse(lang, before, fixed.verse, UNIT, fixed.parts, { fixedAt: 'T' });
      assert.equal(after.commentaries[0].correctness, after.aiTranslation.partScores.translation);
      assert.equal(after.commentaries[0].correctness, 2, 'the model\'s own doubt of 2 caps the score');
    });

    test(`${lang}: the stamps, rows and score still agree after the repair`, () => {
      for (const shape of ['legacy', 'parts']) {
        const { before, after } = repaired(lang, { shape, ratings: { wordMeanings: 2 } });
        assert.deepEqual(verifyEntry(before, UNIT, lang).filter((p) => /stamp|correctness|source has changed/.test(p)), [], `${shape} before`);
        assert.deepEqual(verifyEntry(after, UNIT, lang).filter((p) => /stamp|correctness|source has changed/.test(p)), [], `${shape} after`);
      }
    });

    test(`${lang}: the repair raises a flawed transliteration from 1 and never lowers a score`, () => {
      const { before, after } = repaired(lang);
      assert.ok(verseScore(after) >= verseScore(before));
      assert.equal(after.aiTranslation.partScores.transliteration, 3);
    });

    test(`${lang}: the version is left alone, so a later run still treats the verse as current`, () => {
      const { after } = repaired(lang);
      assert.equal(after.aiTranslation.version, VERSION);
      assert.ok(after.commentaries.filter((c) => c.translatorSlug === TRANSLATOR && c.language === lang).every((c) => c.version === VERSION));
    });
  }
});

/* ---------- the command line ---------- */

describe('fix-translation-script.js', () => {
  const script = resolve(import.meta.dirname, '../scripts/fix-translation-script.js');

  /** A local bucket with chapter 2 in English and Sanskrit, and the Malayalam translation of verse 1.2.1 with one bad line. */
  function bucket() {
    const dir = mkdtempSync(join(tmpdir(), 'fix-translation-script-'));
    dirs.push(dir);
    const put = (key, body) => {
      mkdirSync(dirname(join(dir, key)), { recursive: true });
      writeFileSync(join(dir, key), JSON.stringify(body, null, 2));
    };
    put(chapterKey(2), {
      meta: { bookNumber: 1, bookSlug: 'bhagavat-gita', language: 'en', chapterNumber: 2, cantoNumber: null, chapterName: 'सांख्ययोग', totalVerses: 1, globalVerseStart: 41, globalVerseEnd: 41, chapterTitleEn: 'Contents of the Gītā Summarized' },
      verses: [{
        verseId: UNIT.verseId, chapterNumber: 2, verseNumber: 1, verseNumberEnd: null, cantoNumber: null, bookNumber: 1, globalVerseNumber: 41, transliteration: LINES.join('\n'),
        commentaries: [{ translatorSlug: TRANSLATOR, type: 'translation', language: 'en', displayOrder: 1, text: UNIT.translation }],
      }],
    });
    put(saChapterKey(2), { meta: {}, verses: [{ verseId: UNIT.verseId, sanskrit: 'x', transliteration: LINES.join('\n'), wordMeanings: WORDS }] });
    const lines = saved('ml').transliteration.split('\n');
    lines[1] = DEVANAGARI_LINE;
    const file = { meta: { language: 'ml' }, verses: [saved('ml', { transliteration: lines.join('\n') })] };
    put(langChapterKey('ml', 2), file);
    return { dir, key: langChapterKey('ml', 2), file };
  }

  const exec = (dir, ...args) => run(process.execPath, [script, '--local-store', dir, '--langs', 'ml', '--chapters', '2', ...args], { env: { ...process.env, TRANSLATION_VERSION: VERSION } });
  const read = (dir, key) => JSON.parse(readFileSync(join(dir, key), 'utf8'));
  const failing = async (promise) => promise.then(() => assert.fail('it should have stopped'), (err) => err);

  test('a dry run says what it would change and writes nothing', async () => {
    const { dir, key, file } = bucket();
    const { stdout } = await exec(dir);
    assert.match(stdout, /1 would change \(nothing written\)/);
    assert.match(stdout, /transliteration: line-regenerated/);
    assert.match(stdout, /Nothing was written/);
    assert.deepEqual(read(dir, key), file);
    assert.equal(existsSync(join(dir, backupKey(key))), false);
  });

  test('--apply backs the file up, writes the repair, and a second run has nothing left to do', async () => {
    const { dir, key, file } = bucket();
    const { stdout } = await exec(dir, '--apply');
    assert.match(stdout, /wrote .*ch-2\.json/);
    assert.deepEqual(read(dir, backupKey(key)), file, 'the backup is the file as it was');
    const after = read(dir, key);
    assert.equal(after.verses[0].transliteration, saved('ml').transliteration);
    assert.deepEqual(after.verses[0].aiTranslation.scriptFix, { at: after.verses[0].aiTranslation.scriptFix.at, parts: ['transliteration'] });
    assert.equal(sanskritFlaw('ml', after.verses[0].transliteration).length, 0);
    const again = await exec(dir, '--apply');
    assert.match(again.stdout, /0 would change/);
    assert.deepEqual(read(dir, key), after);
  });

  test('--apply stops while the checkpoint says a run is active, unless --force', async () => {
    const { dir, key, file } = bucket();
    mkdirSync(dirname(join(dir, checkpointKey(VERSION))), { recursive: true });
    writeFileSync(join(dir, checkpointKey(VERSION)), JSON.stringify({ running: true }));
    const err = await failing(exec(dir, '--apply'));
    assert.match(err.stderr, /a run is active/);
    assert.deepEqual(read(dir, key), file);
    await exec(dir, '--apply', '--force');
    assert.notDeepEqual(read(dir, key), file);
  });

  test('a language it does not handle is refused', async () => {
    const { dir } = bucket();
    const err = await failing(run(process.execPath, [script, '--local-store', dir, '--langs', 'hi'], { env: process.env }));
    assert.match(err.stderr, /"hi" is not handled here/);
  });

  test('--report writes every change, verse by verse', async () => {
    const { dir } = bucket();
    const report = join(dir, 'report.json');
    await exec(dir, '--report', report);
    const json = JSON.parse(readFileSync(report, 'utf8'));
    assert.equal(json.apply, false);
    assert.equal(json.details.ml['1.2.1'].changes[0].how, 'line-regenerated');
    assert.deepEqual(json.details.ml['1.2.1'].parts, ['transliteration']);
  });
});
