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

import { translatedByOf } from '../scripts/lib/claude-translate-parts.js';
import { verifyEntry } from '../scripts/lib/claude-translate-run.js';
import { TRANSLATOR, chapterKey, saChapterKey, sourceHash } from '../scripts/lib/claude-translate-source.js';
import { backupKey, checkpointKey, langChapterKey } from '../scripts/lib/claude-translate-store.js';
import {
  WRONG_LANGUAGE_LETTERS, applyPatches, checkPatches, fixTail, foreignRuns, fixProse, fixVerse, partOfMessage, relabelStored, rescoreStored, rescoreVerse, sanskritFlaw, selfRatings, verseScore,
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

const stampBase = { provider: 'openai', model: 'gpt-6-luna', effort: 'off', promptVersion: '6', generatedAt: '2026-10-15T10:00:00.000Z' };
const MADE_BY = translatedByOf(stampBase.provider); // "gpt": what a correctly stamped verse of this fixture says
const row = (lang, type, text, extra = {}) => ({ translatorSlug: TRANSLATOR, type, language: lang, displayOrder: 1, text, translatedBy: MADE_BY, version: VERSION, correctness: 3, ...extra });

/** A saved verse the way the pipeline writes it. `shape` is 'legacy' (one stamp for the verse) or 'parts' (one stamp per part). */
function saved(lang, { shape = 'legacy', ratings = {}, transliteration, wordMeanings } = {}) {
  const t = TEXT[lang];
  const rate = (part) => ratings[part] ?? 3;
  const warn = (part) => (ratings[part] && ratings[part] < 3 ? [`${part}: rated ${ratings[part]} by Claude`] : []);
  const partNames = ['translation', 'transliteration', 'wordMeanings'];
  const aiTranslation = shape === 'legacy'
    ? {
      translatedBy: MADE_BY, version: VERSION, ...stampBase, sourceHash: sourceHash(UNIT), correctness: Math.min(...partNames.map(rate)),
      partScores: Object.fromEntries(partNames.map((p) => [p, rate(p)])), note: '', warnings: partNames.flatMap(warn),
    }
    : {
      translatedBy: MADE_BY, version: VERSION, sourceHash: sourceHash(UNIT), correctness: Math.min(...partNames.map(rate)),
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
  test('the source\'s ".a" avagraha left as a full stop between two letters', () => {
    assert.deepEqual(sanskritFlaw('hi', 'ते.द्य'), ['dot-avagraha']);
    assert.deepEqual(sanskritFlaw('hi', 'तेऽद्य योगः ।'), []);
  });
  test('a hindi line with one Roman ā is mended word by word, keeping the rest', () => {
    const unit = { verseId: '1.4.3', transliteration: ['sa evāyaṃ mayā te.adya yogaḥ proktaḥ purātanaḥ .'] };
    const verse = { verseId: '1.4.3', transliteration: 'स एवायं मयā ते.द्य योगः प्रोक्तः पुरातनः ।', wordMeanings: [], commentaries: [] };
    const { verse: fixed } = fixVerse('hi', verse, unit);
    assert.equal(fixed.transliteration, 'स एवायं मया तेऽद्य योगः प्रोक्तः पुरातनः ।');
  });
  test('a modifier apostrophe (U+02BC), which is a letter to the validator', () => assert.deepEqual(sanskritFlaw('ta', 'பகவாʼன்'), ['modifier-apostrophe']));
  test('a digit after a letter, marking a voiced or aspirated stop', () => assert.deepEqual(sanskritFlaw('ta', 'க3'), ['digits']));
  test('but the verse number after a danda is not one', () => assert.deepEqual(sanskritFlaw('ta', 'ஸஞ்ஜய ॥1-2॥'), []));
  test('a digit of the language\'s own or another script standing for an avagraha', () => {
    assert.deepEqual(sanskritFlaw('bn', 'নিমিত্তানি২ চ'), ['digits']);
    assert.deepEqual(sanskritFlaw('te', 'ఏకో౭పి'), ['digits']);
    assert.deepEqual(sanskritFlaw('bn', 'অহম্ ॥১-২৩॥'), []);
  });
  test('Assamese ra and va in a Bengali text', () => {
    assert.deepEqual(sanskritFlaw('bn', 'ৰাজা'), ['assamese-letters']);
    assert.deepEqual(sanskritFlaw('bn', 'রাজা বন'), []);
  });
  test('a vowel sign with nothing to stand on, or two on one consonant', () => {
    assert.deepEqual(sanskritFlaw('hi', 'इमाॉल्लोकान्न'), ['broken-marks']);
    assert.deepEqual(sanskritFlaw('bn', 'পিতৃৃনথ'), ['broken-marks']);
    assert.deepEqual(sanskritFlaw('hi', 'ा क'), ['broken-marks']);
    assert.deepEqual(sanskritFlaw('hi', 'इमाँल्लोकान्न कृष्णो नुक्ता क़ा'), []);
    assert.deepEqual(sanskritFlaw('bn', 'কোন কৌ সূত্রে'), []);
    assert.deepEqual(sanskritFlaw('kn', 'ಕೊಂಡು ಕೈ ಕೃಷ್ಣ'), []);
    assert.deepEqual(sanskritFlaw('te', 'కొండ కృష్ణ ఐ'), []);
  });
});

describe('an unassigned code point', () => {
  // The models write an avagraha with a code point Unicode has not assigned: U+0BC3 in Telugu, U+09B3 and U+09B4 in Bengali, U+0CFD, U+0BA2 for a Tamil ḍ.
  const TE = 'శాశ్వతో\u0bc3యం';
  const TE_FIXED = 'శాశ్వతోఽయం';

  test('is a flaw in a Sanskrit text, whichever block it sits in', () => {
    assert.deepEqual(sanskritFlaw('te', TE), ['unassigned']); // a Tamil-block code point in Telugu
    assert.deepEqual(sanskritFlaw('bn', 'মোক্ষ্যসে\u09b3ঽশুভাৎ'), ['unassigned']); // inside Bengali's own block
    assert.deepEqual(sanskritFlaw('ta', 'த்ரு\u0ba2ம்'), ['unassigned']);
    assert.deepEqual(sanskritFlaw('te', TE_FIXED), []);
  });

  describe('in prose', () => {
    test('between an e or o sign and a letter it becomes the language\'s avagraha', () => {
      const r = fixProse('te', `ఇది ${TE} అని`, 'purport');
      assert.equal(r.text, `ఇది ${TE_FIXED} అని`);
      assert.deepEqual(r.changes.map((c) => c.how), ['unassigned-avagraha']);
      assert.deepEqual(r.leftovers, []);
      assert.equal(fixProse('kn', 'ಏಕೋ\u0cfdಪಿ', 'purport').text, 'ಏಕೋಽಪಿ');
      assert.equal(fixProse('bn', 'শ্রদ্ধাময়ো\u09b4য়ং', 'purport').text, 'শ্রদ্ধাময়োঽয়ং');
    });

    test('before an avagraha that is already there it is only dropped, not doubled', () => {
      const r = fixProse('bn', 'মোক্ষ্যসে\u09b3ঽশুভাৎ', 'purport');
      assert.equal(r.text, 'মোক্ষ্যসেঽশুভাৎ');
      assert.deepEqual(r.changes.map((c) => c.how), ['unassigned-dropped']);
    });

    test('anywhere else it is not guessed at: the text is kept and the code point reported', () => {
      const text = 'த்ரு\u0ba2வ்ரதாஃ';
      const r = fixProse('ta', text, 'purport');
      assert.equal(r.text, text);
      assert.deepEqual(r.changes, []);
      assert.deepEqual(r.leftovers.map((l) => [l.kind, l.text]), [['unassigned', 'U+0BA2']]);
      assert.deepEqual(fixProse('te', 'కృష్ణ\u0bc3 అని', 'purport').leftovers.map((l) => l.kind), ['unassigned']);
    });
  });

  describe('in a verse', () => {
    test('a transliteration line is mended in place, so the model\'s own spelling and rating stay', () => {
      const unit = { verseId: '1.2.20', transliteration: ['ajo nityaḥ śāśvato.ayaṃ purāṇo na hanyate'] };
      const verse = { verseId: '1.2.20', transliteration: `అజో నిత్యః ${TE} పురాణో న హన్యతే`, wordMeanings: [], commentaries: [] };
      const r = fixVerse('te', verse, unit);
      assert.equal(r.verse.transliteration, `అజో నిత్యః ${TE_FIXED} పురాణో న హన్యతే`);
      assert.deepEqual(r.changes.map((c) => [c.part, c.how, c.line]), [['transliteration', 'unassigned-avagraha', 0]]);
      assert.deepEqual(r.parts, ['transliteration']);
      assert.deepEqual(r.rebuilt, []); // a rebuild drops the model's rating of the line; this is not one
    });

    test('the Sanskrit word of a word meaning is mended the same way, and a null word stays null', () => {
      const unit = { verseId: '1.7.30', transliteration: [], wordMeanings: [{ word: 'prayāṇa-kāle.api', meaning: 'at the time of death' }, { word: null, meaning: 'and' }] };
      const verse = { verseId: '1.7.30', transliteration: '', wordMeanings: [{ word: 'ప్రయాణ-కాలే೽పి', meaning: 'మరణ సమయంలో' }, { word: null, meaning: 'మరియు' }], commentaries: [] };
      const r = fixVerse('te', verse, unit);
      assert.deepEqual(r.verse.wordMeanings.map((w) => w.word), ['ప్రయాణ-కాలేఽపి', null]);
      assert.deepEqual(r.changes.map((c) => [c.part, c.how, c.i]), [['wordMeanings', 'unassigned-avagraha', 0]]);
    });

    test('a line the rule cannot mend is rebuilt from the English, keeping the words that were right', () => {
      const unit = { verseId: '1.6.34', transliteration: ['cañcalaṃ hi manaḥ kṛṣṇa pramāthi balavad dṛḍham .'], wordMeanings: [{ word: 'dṛḍham', meaning: 'obstinate' }] };
      const verse = { verseId: '1.6.34', transliteration: 'சஞ்சலம் ஹி மனஃ க்ருஷ்ண ப்ரமாதி பலவத் த்ரு\u0ba2ம் ।', wordMeanings: [{ word: 'த்ரு\u0ba2ம்', meaning: 'பிடிவாதம்' }], commentaries: [] };
      const r = fixVerse('ta', verse, unit);
      assert.equal(r.verse.transliteration, 'சஞ்சலம் ஹி மனஃ க்ருஷ்ண ப்ரமாதி பலவத் த்ருடம் ।');
      assert.equal(r.verse.wordMeanings[0].word, 'த்ருடம்');
      assert.deepEqual(r.changes.map((c) => [c.part, c.how]), [['transliteration', 'line-regenerated'], ['wordMeanings', 'word-regenerated']]);
      assert.deepEqual(sanskritFlaw('ta', r.verse.transliteration), []);
    });

    test('a hand patch can mend what the rule leaves (a Tamil ḍ in a purport)', () => {
      const verse = { verseId: '1.6.45', transliteration: '', wordMeanings: [], commentaries: [{ translatorSlug: TRANSLATOR, type: 'purport', language: 'ta', text: 'மாம் த்ரு\u0ba2வ்ரதாஃ “பல”' }] };
      const patch = { lang: 'ta', verseId: '1.6.45', part: 'purport', find: 'த்ரு\u0ba2வ்ரதாஃ', replace: 'த்ருடவ்ரதாஃ' };
      const r = fixVerse('ta', verse, { verseId: '1.6.45', transliteration: [] }, [patch]);
      assert.equal(r.verse.commentaries[0].text, 'மாம் த்ருடவ்ரதாஃ “பல”');
      assert.deepEqual(r.patchResults.map((p) => p.status), ['applied']);
    });
  });
});

describe('fixTail', () => {
  const english = 'māmakāḥ pāṇḍavāścaiva kimakurvata sañjaya ||2-1||';
  test('the verse number is written ॥N-M॥ with ASCII digits and one space before it', () => {
    assert.equal(fixTail('x ||2-1||', english), 'x ॥2-1॥');
    assert.equal(fixTail('x ॥२-१॥', english), 'x ॥2-1॥');
    assert.equal(fixTail('x ॥ ২-১॥', english), 'x ॥2-1॥');
    assert.equal(fixTail('x॥2-1॥', english), 'x॥2-1॥');
  });
  test('the numbers come from the English: ॥14॥ and ॥16.20॥ become ॥14-6॥ and ॥16-20॥', () => {
    assert.equal(fixTail('x ॥14॥', 'y ||14-6||'), 'x ॥14-6॥');
    assert.equal(fixTail('x ॥16.20॥', 'y ||16-20||'), 'x ॥16-20॥');
  });
  test('a tail already right, a line with no tail, or an English line with none is returned as it is', () => {
    assert.equal(fixTail('x ॥2-1॥', english), 'x ॥2-1॥');
    assert.equal(fixTail('x ।', 'y .'), 'x ।');
    assert.equal(fixTail('x ।', english), 'x ।');
    assert.equal(fixTail('x ॥2-1॥', 'y .'), 'x ॥2-1॥');
  });
});

/* ---------- prose ---------- */

describe('fixProse', () => {
  test('a full stop written for an avagraha inside a quoted Sanskrit word is mended (hi ते.हं, mr एको.अपि, kn ಪಕ್ವೋ.ಥ, bn একো.ঽপি)', () => {
    const cases = [['hi', 'शिष्यस्ते.हं', 'शिष्यस्तेऽहं'], ['mr', 'एको.अपि', 'एकोऽपि'], ['kn', 'ಭಜನ್ನಪಕ್ವೋ.ಥ', 'ಭಜನ್ನಪಕ್ವೋಽಥ'], ['bn', 'একো.ঽপি', 'একোঽপি'], ['te', 'భజన్నపక్వో.ఽథ', 'భజన్నపక్వోఽథ']];
    for (const [lang, from, to] of cases) {
      const r = fixProse(lang, `« ${from} »`);
      assert.equal(r.text, `« ${to} »`);
      assert.deepEqual(r.changes.map((c) => c.how), ['dot-avagraha']);
    }
  });

  test('...also when the avagraha is a Devanagari ऽ inside a Telugu text, converted in the same pass', () => {
    const r = fixProse('te', 'భజన్నపక్వో.ऽథ', 'purport');
    assert.equal(r.text, 'భజన్నపక్వోఽథ');
    assert.deepEqual(fixProse('te', r.text, 'purport').changes, []);
  });

  test('a full stop that ends a sentence or an abbreviation is not an avagraha', () => {
    assert.equal(fixProse('hi', 'देखें भ.गी. 2.7 । वह गया.', 'purport').text, 'देखें भ.गी. 2.7 । वह गया.');
    assert.equal(fixProse('hi', 'वह आया. फिर गया', 'purport').changes.length, 0);
    assert.equal(fixProse('ml', 'ഏകോ.അപി', 'purport').changes.length, 0); // not a language this rule covers
  });

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

describe('a verse-number tail set right', () => {
  const asciiTail = (lang) => saved(lang).transliteration.replace(/॥1-2॥$/, '||1-2||');

  test('is a change of the transliteration but not a rebuild of it', () => {
    const before = saved('ml', { transliteration: asciiTail('ml') });
    assert.notEqual(before.transliteration, saved('ml').transliteration);
    const fixed = fixVerse('ml', before, UNIT);
    assert.deepEqual(fixed.changes.map((c) => c.how), ['tail-normalised']);
    assert.deepEqual(fixed.parts, ['transliteration']);
    assert.deepEqual(fixed.rebuilt, []);
    assert.equal(fixed.verse.transliteration, saved('ml').transliteration);
  });

  test('is set right even where the line count differs from the English (the line is a leftover, the tail is not)', () => {
    const lines = saved('ml').transliteration.split('\n');
    const before = saved('ml', { transliteration: [lines[0], lines[1], 'ധർമ ।', lines[2].replace('॥1-2॥', '||1-2||')].join('\n') });
    const fixed = fixVerse('ml', before, UNIT);
    assert.deepEqual(fixed.leftovers.map((l) => l.kind), ['line-count']);
    assert.match(fixed.verse.transliteration, /॥1-2॥$/);
  });

  test('keeps the model\'s own rating of the transliteration, which a rebuilt line drops', () => {
    const before = saved('ml', { transliteration: asciiTail('ml'), ratings: { transliteration: 2 } });
    const fixed = fixVerse('ml', before, UNIT);
    const kept = rescoreVerse('ml', before, fixed.verse, UNIT, fixed.parts, { fixedAt: 'T', rebuilt: fixed.rebuilt });
    const dropped = rescoreVerse('ml', before, fixed.verse, UNIT, fixed.parts, { fixedAt: 'T' });
    assert.equal(kept.aiTranslation.partScores.transliteration, 2);
    assert.equal(dropped.aiTranslation.partScores.transliteration, 3);
  });
});

describe('hand patches', () => {
  const verse = () => {
    const v = saved('ml');
    v.wordMeanings[1].meaning = 'even — അപി';
    v.commentaries.push(row('ml', 'purport', 'ഭഗവാൻ Personality of Godhead പറഞ്ഞു'));
    return v;
  };
  const patch = (extra) => ({ lang: 'ml', verseId: '1.2.1', part: 'wordMeanings', i: 1, find: 'even — ', replace: '', ...extra });

  test('a word meaning and a purport are patched in the right place, and only there', () => {
    const wordPatch = patch({ find: 'even — അപി', replace: 'അപി' });
    const purportPatch = { lang: 'ml', verseId: '1.2.1', part: 'purport', find: ' Personality of Godhead', replace: '' };
    assert.throws(() => checkPatches([purportPatch]), /replace should be a non-empty string/);
    const longer = { ...purportPatch, find: 'ഭഗവാൻ Personality of Godhead', replace: 'ഭഗവാൻ' };
    const { verse: out, changes, results } = applyPatches('ml', verse(), [wordPatch, longer]);
    assert.equal(out.wordMeanings[1].meaning, 'അപി');
    assert.equal(out.commentaries.find((c) => c.type === 'purport' && c.language === 'ml').text, 'ഭഗവാൻ പറഞ്ഞു');
    assert.deepEqual(results.map((r) => r.status), ['applied', 'applied']);
    assert.deepEqual(changes.map((c) => [c.part, c.how]), [['wordMeanings', 'patch'], ['purport', 'patch']]);
    assert.equal(out.wordMeanings[0].meaning, verse().wordMeanings[0].meaning);
    assert.equal(out.commentaries.find((c) => c.translatorSlug === 'sivananda').text, 'धर्मक्षेत्रे कुरुक्षेत्रे');
  });

  test('a patch whose text is gone and whose replacement is there was applied before and is skipped', () => {
    const p = patch({ find: 'even — അപി', replace: 'അപി' });
    const first = applyPatches('ml', verse(), [p]).verse;
    const again = applyPatches('ml', first, [p]);
    assert.deepEqual(again.results.map((r) => r.status), ['already']);
    assert.deepEqual(again.changes, []);
  });

  test('text that is not there, that is there twice, or an entry that does not exist is reported, not guessed', () => {
    const v = verse();
    v.wordMeanings[0].meaning = 'even even';
    const out = applyPatches('ml', v, [patch({ i: 0, find: 'even', replace: 'അപി' }), patch({ find: 'nothing', replace: 'x' }), patch({ i: 9, find: 'a', replace: 'b' })]);
    assert.deepEqual(out.results.map((r) => r.status), ['ambiguous', 'not-found', 'missing']);
    assert.deepEqual(out.changes, []);
    assert.deepEqual(out.verse.wordMeanings, v.wordMeanings);
  });

  test('fixVerse applies them after the rules and names the part', () => {
    const fixed = fixVerse('ml', verse(), UNIT, [patch({ find: 'even — അപി', replace: 'അപി' })]);
    assert.deepEqual(fixed.parts, ['wordMeanings']);
    assert.equal(fixed.verse.wordMeanings[1].meaning, 'അപി');
    assert.deepEqual(fixed.patchResults.map((r) => r.status), ['applied']);
  });

  test('a malformed patch list is refused with the patch named', () => {
    assert.throws(() => checkPatches({}), /expected a list/);
    assert.throws(() => checkPatches([{ lang: 'gu', verseId: '1.2.1', part: 'purport', find: 'a', replace: 'b' }]), /"gu" is not a language/);
    assert.throws(() => checkPatches([{ lang: 'ml', verseId: '1.2.1', part: 'wordMeanings', find: 'a', replace: 'b' }]), /needs i/);
    assert.throws(() => checkPatches([{ lang: 'ml', verseId: '2', part: 'purport', find: 'a', replace: 'b' }]), /verseId should look like/);
    assert.throws(() => checkPatches([{ lang: 'ml', verseId: '1.2.1', part: 'purport', find: 'a', replace: 'a' }]), /the same/);
    assert.equal(checkPatches([patch({ find: 'a', replace: 'b' })]).length, 1);
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

describe('rescoreStored', () => {
  /** The English of 1.2.1 with a ten-word gloss for the second word: too short for a count of words to mean anything. */
  const GLOSS = 'the one who is not disturbed by happiness or distress';
  const unit = { ...UNIT, wordMeanings: WORDS.map((w, i) => (i === 1 ? { ...w, meaning: GLOSS } : w)) };
  const TOO_SHORT = 'word 2 meaning: too short (0.20× the English words) — something was dropped';

  /** A verse stamped by the validator as it was: the gloss flagged, the model's own 2 for the word list. */
  function stamped(lang, shape) {
    const verse = saved(lang, { shape, ratings: { wordMeanings: 2 } });
    const ai = verse.aiTranslation;
    ai.partScores.wordMeanings = 1;
    ai.correctness = 1;
    const warnings = ['wordMeanings: rated 2 by Claude', TOO_SHORT];
    if (ai.parts) {
      ai.parts.wordMeanings.correctness = 1;
      ai.parts.wordMeanings.warnings = warnings;
      ai.warnings = warnings;
    } else {
      ai.warnings = warnings;
    }
    return verse;
  }

  for (const lang of ['ml', 'ta']) {
    for (const shape of ['legacy', 'parts']) {
      test(`${lang}, stamped ${shape === 'parts' ? 'per part' : 'as a whole'}: a flag from the old length rule goes; the model's own rating, the text and the other stamps stay`, () => {
        const verse = stamped(lang, shape);
        const before = JSON.parse(JSON.stringify(verse));
        const re = rescoreStored(lang, verse, unit);
        assert.deepEqual(re.parts, ['wordMeanings']);
        assert.deepEqual(re.changes, [{ part: 'wordMeanings', from: 1, to: 2, dropped: [TOO_SHORT], added: [] }]);
        const ai = re.verse.aiTranslation;
        assert.equal(ai.partScores.wordMeanings, 2, 'the model\'s own 2 now decides');
        assert.equal(ai.correctness, 2);
        assert.deepEqual(ai.warnings, ['wordMeanings: rated 2 by Claude']);
        assert.equal(ai.scriptFix, undefined, 'a re-score is no repair');
        if (shape === 'parts') {
          assert.equal(ai.parts.wordMeanings.scriptFix, undefined);
          assert.deepEqual(ai.parts.translation, before.aiTranslation.parts.translation);
        }
        assert.deepEqual(re.verse.wordMeanings, before.wordMeanings, 'the text is not touched');
        assert.deepEqual(verse, before, 'the argument is not changed');
      });
    }

    test(`${lang}: a verse whose stamps already agree comes back as it is`, () => {
      const verse = saved(lang);
      const re = rescoreStored(lang, verse, UNIT);
      assert.equal(re.verse, verse);
      assert.deepEqual(re.parts, []);
    });

    test(`${lang}: a real truncation keeps its 1`, () => {
      const long = { ...UNIT, purport: [Array(160).fill('lord').join(' ')] };
      const verse = saved(lang);
      verse.commentaries.push(row(lang, 'purport', Array(10).fill(lang === 'ml' ? 'ഭഗവാൻ' : 'பகவான்').join(' ')));
      verse.aiTranslation.partScores.purport = 1;
      verse.aiTranslation.correctness = 1;
      verse.aiTranslation.warnings = ['purport ¶1: too short (0.06× the English words) — something was dropped'];
      const re = rescoreStored(lang, verse, long);
      assert.deepEqual(re.parts, []);
      assert.equal(re.verse, verse);
    });
  }
});

/* ---------- the command line ---------- */

describe('relabelStored', () => {
  /** The verse as the pipeline once saved GPT's text: every label said "claude". */
  function mislabelled(lang, shape) {
    const verse = saved(lang, { shape });
    for (const c of verse.commentaries) if (c.translatorSlug === TRANSLATOR && c.language === lang) c.translatedBy = 'claude';
    verse.aiTranslation.translatedBy = 'claude';
    return verse;
  }

  for (const lang of ['ml', 'ta']) {
    for (const shape of ['legacy', 'parts']) {
      test(`${lang}, stamped ${shape === 'parts' ? 'per part' : 'as a whole'}: GPT's rows and verse say gpt; the text and every stamp stay`, () => {
        const verse = mislabelled(lang, shape);
        const before = JSON.parse(JSON.stringify(verse));
        const re = relabelStored(lang, verse);
        assert.deepEqual(re.changes, [
          { what: 'translation row', from: 'claude', to: 'gpt' },
          { what: 'verse', from: 'claude', to: 'gpt' },
        ]);
        assert.equal(re.verse.aiTranslation.translatedBy, 'gpt');
        const own = re.verse.commentaries.filter((c) => c.translatorSlug === TRANSLATOR && c.language === lang);
        assert.deepEqual(own.map((c) => c.translatedBy), ['gpt']);
        assert.deepEqual({ ...re.verse, commentaries: 0, aiTranslation: 0 }, { ...before, commentaries: 0, aiTranslation: 0 }, 'nothing else on the verse changes');
        assert.deepEqual({ ...re.verse.aiTranslation, translatedBy: 'claude' }, before.aiTranslation, 'nor anything else in the stamps');
        assert.deepEqual(re.verse.commentaries.map((c) => ({ ...c, translatedBy: 0 })), before.commentaries.map((c) => ({ ...c, translatedBy: 0 })), 'nor the text of any row');
        assert.deepEqual(verse, before, 'the argument is not changed');
        assert.deepEqual(verifyEntry(re.verse, UNIT, lang).filter((p) => /stamp/.test(p)), []);
        assert.ok(verifyEntry(verse, UNIT, lang).some((p) => /not stamped gpt/.test(p)), 'the old labels are what verifyEntry complains about');
      });
    }

    test(`${lang}: a verse already labelled right comes back as it is`, () => {
      const verse = saved(lang, { shape: 'parts' });
      const re = relabelStored(lang, verse);
      assert.equal(re.verse, verse);
      assert.deepEqual(re.changes, []);
    });

    test(`${lang}: other translators' rows and other languages' rows keep their label`, () => {
      const re = relabelStored(lang, mislabelled(lang, 'parts'));
      const others = re.verse.commentaries.filter((c) => !(c.translatorSlug === TRANSLATOR && c.language === lang));
      assert.ok(others.length >= 2);
      assert.deepEqual(others.map((c) => c.translatedBy), mislabelled(lang, 'parts').commentaries.filter((c) => !(c.translatorSlug === TRANSLATOR && c.language === lang)).map((c) => c.translatedBy));
    });
  }

  test('a verse written by two providers: each row follows its own part, the verse follows the translation', () => {
    const verse = saved('ml', { shape: 'parts' });
    verse.commentaries.push(row('ml', 'purport', 'purport text', { translatedBy: 'claude' }));
    verse.commentaries[0].translatedBy = 'claude';
    verse.aiTranslation.translatedBy = 'claude';
    verse.aiTranslation.parts.purport = { ...stampBase, provider: 'anthropic', model: 'claude-sonnet-5-5', version: VERSION, correctness: 3, warnings: [] };
    const re = relabelStored('ml', verse);
    const own = re.verse.commentaries.filter((c) => c.translatorSlug === TRANSLATOR && c.language === 'ml');
    assert.deepEqual(own.map((c) => [c.type, c.translatedBy]), [['translation', 'gpt'], ['purport', 'claude']]);
    assert.equal(re.verse.aiTranslation.translatedBy, 'gpt');
    assert.deepEqual(re.changes.map((c) => c.what), ['translation row', 'verse']);
  });

  test('a stamp from before there were providers is Claude\'s', () => {
    const verse = saved('ml', { shape: 'legacy' });
    delete verse.aiTranslation.provider;
    verse.aiTranslation.translatedBy = 'gpt';
    for (const c of verse.commentaries) if (c.translatorSlug === TRANSLATOR && c.language === 'ml') c.translatedBy = 'gpt';
    const re = relabelStored('ml', verse);
    assert.equal(re.verse.aiTranslation.translatedBy, 'claude');
    assert.equal(re.verse.commentaries[0].translatedBy, 'claude');
  });

  test('a verse a person wrote (no stamp) is left alone', () => {
    const verse = saved('ml');
    delete verse.aiTranslation;
    assert.equal(relabelStored('ml', verse).verse, verse);
  });
});

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

  describe('--patches', () => {
    const word = { lang: 'ml', verseId: '1.2.1', part: 'wordMeanings', i: 0, find: 'രാജാവ്', replace: 'രാജാവും' };
    const patchFile = (dir, list) => {
      const file = join(dir, 'patches.json');
      writeFileSync(file, JSON.stringify(list));
      return file;
    };
    const clean = (file) => ({ ...file, verses: [saved('ml')] }); // the bucket's verse with its bad line already mended

    test('are listed in a dry run, written with --apply, and a second run finds them already in place', async () => {
      const { dir, key } = bucket();
      writeFileSync(join(dir, key), JSON.stringify(clean(read(dir, key))));
      const patches = patchFile(dir, [word]);
      const dry = await exec(dir, '--patches', patches);
      assert.match(dry.stdout, /hand patches: 1 to apply, 0 already in place/);
      assert.equal(read(dir, key).verses[0].wordMeanings[0].meaning, 'ധൃതരാഷ്ട്ര രാജാവ് പറഞ്ഞു');
      await exec(dir, '--patches', patches, '--apply');
      const after = read(dir, key).verses[0];
      assert.equal(after.wordMeanings[0].meaning, 'ധൃതരാഷ്ട്ര രാജാവും പറഞ്ഞു');
      assert.deepEqual(after.aiTranslation.scriptFix.parts, ['wordMeanings']);
      const again = await exec(dir, '--patches', patches, '--apply');
      assert.match(again.stdout, /hand patches: 0 to apply, 1 already in place/);
      assert.match(again.stdout, /0 would change/);
    });

    test('a patch that does not match stops everything before anything is written', async () => {
      const { dir, key, file } = bucket();
      const patches = patchFile(dir, [word, { ...word, find: 'not in the text', replace: 'something else' }]);
      const err = await failing(exec(dir, '--patches', patches, '--apply'));
      assert.match(err.stdout + err.stderr, /patch not-found/);
      assert.match(err.stderr, /Stopping before any write/);
      assert.deepEqual(read(dir, key), file);
      assert.equal(existsSync(join(dir, backupKey(key))), false);
    });

    test('a patch for a verse the file does not hold is reported too', async () => {
      const { dir } = bucket();
      const err = await failing(exec(dir, '--patches', patchFile(dir, [{ ...word, verseId: '2.2.1' }])));
      assert.match(err.stdout + err.stderr, /verse-not-found|chapter/);
    });
  });

  describe('--relabel', () => {
    // The bucket's verse with its bad line already mended, and the pre-fix labels: rows and verse say claude, the stamps say GPT.
    function mislabelledBucket() {
      const b = bucket();
      const verse = saved('ml');
      for (const c of verse.commentaries) if (c.translatorSlug === TRANSLATOR && c.language === 'ml') c.translatedBy = 'claude';
      verse.aiTranslation.translatedBy = 'claude';
      const file = { ...b.file, verses: [verse] };
      writeFileSync(join(b.dir, b.key), JSON.stringify(file, null, 2));
      return { ...b, file };
    }

    test('is listed in a dry run, written with --apply (backed up first), and a second run finds nothing to do', async () => {
      const { dir, key, file } = mislabelledBucket();
      const dry = await exec(dir, '--relabel');
      assert.match(dry.stdout, /translation row: translatedBy claude → gpt\s+1/);
      assert.match(dry.stdout, /verse: translatedBy claude → gpt\s+1/);
      assert.deepEqual(read(dir, key), file, 'a dry run writes nothing');
      await exec(dir, '--relabel', '--apply');
      assert.deepEqual(read(dir, backupKey(key)), file, 'the backup is the file as it was');
      const after = read(dir, key).verses[0];
      assert.equal(after.aiTranslation.translatedBy, 'gpt');
      assert.equal(after.commentaries.find((c) => c.translatorSlug === TRANSLATOR && c.language === 'ml').translatedBy, 'gpt');
      assert.equal(after.aiTranslation.scriptFix, undefined, 'a relabel is no repair');
      const again = await exec(dir, '--relabel', '--apply');
      assert.match(again.stdout, /0 would change/);
    });

    test('without the flag the labels are left alone', async () => {
      const { dir, key, file } = mislabelledBucket();
      await exec(dir, '--apply');
      assert.deepEqual(read(dir, key), file);
    });
  });

  test('a language it does not handle is refused', async () => {
    const { dir } = bucket();
    const err = await failing(run(process.execPath, [script, '--local-store', dir, '--langs', 'gu'], { env: process.env }));
    assert.match(err.stderr, /"gu" is not handled here/);
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
