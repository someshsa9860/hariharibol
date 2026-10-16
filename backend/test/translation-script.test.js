// The script converters behind the Malayalam / Tamil Gita repair: IAST into a script, any Indic script back to IAST or
// into Malayalam, a transliteration line of the source, and the loose sound skeleton used to compare a saved line with the
// English. Pure functions, no I/O, no network.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  distance, iastKey, iastTo, iastToMalayalam, iastToTamil, indicToIast, indicToMalayalam, sanskritLine, scriptKey, toDevanagari,
} from '../scripts/lib/translation-script.js';

/** [IAST, Malayalam, Tamil] — words from the first chapter, as the rest of the corpus writes them. */
const WORDS = [
  ['dharma-kṣetre', 'ധർമ-ക്ഷേത്രേ', 'தர்ம-க்ஷேத்ரே'],
  ['kuru-kṣetre', 'കുരു-ക്ഷേത്രേ', 'குரு-க்ஷேத்ரே'],
  ['samavetā', 'സമവേതാ', 'ஸமவேதா'],
  ['yuyutsavaḥ', 'യുയുത്സവഃ', 'யுயுத்ஸவஃ'],
  ['māmakāḥ', 'മാമകാഃ', 'மாமகாஃ'],
  ['pāṇḍavāś', 'പാണ്ഡവാശ്', 'பாண்டவாஶ்'],
  ['kim', 'കിം', 'கிம்'],
  ['akurvata', 'അകുർവത', 'அகுர்வத'],
  ['sañjaya', 'സഞ്ജയ', 'ஸஞ்ஜய'],
  ['kṛṣṇa', 'കൃഷ്ണ', 'க்ருஷ்ண'],
  ['bhagavān', 'ഭഗവാൻ', 'பகவான்'],
  ['dhṛtarāṣṭra uvāca', 'ധൃതരാഷ്ട്ര ഉവാച', 'த்ருதராஷ்ட்ர உவாச'],
];

describe('IAST into Malayalam', () => {
  for (const [iast, ml] of WORDS) test(iast, () => assert.equal(iastToMalayalam(iast), ml));

  test('a word-final m is the anusvara, and a final n is the chillu', () => {
    assert.equal(iastToMalayalam('kim'), 'കിം');
    assert.equal(iastToMalayalam('bhagavān'), 'ഭഗവാൻ');
  });

  test('the source writes an avagraha as ".a" between two letters; the "a" is part of the code', () => {
    assert.equal(iastToMalayalam('ko.atra'), 'കോഽത്ര');
    assert.equal(iastToMalayalam('paco.a to'), 'പചോഽ തോ');
  });

  test('capital letters are folded and separators are kept as they were', () => {
    assert.equal(iastToMalayalam('Kṛṣṇa, Kṛṣṇa'), 'കൃഷ്ണ, കൃഷ്ണ');
    assert.equal(iastToMalayalam('(kim)'), '(കിം)');
  });
});

describe('IAST into Tamil', () => {
  for (const [iast, , ta] of WORDS) test(iast, () => assert.equal(iastToTamil(iast), ta));

  test('aspirates and voiced stops are plain letters, the Grantha letters stand for what Tamil lacks, and no superscripts are used', () => {
    for (const [iast] of WORDS) assert.doesNotMatch(iastToTamil(iast), /[²³⁴¹⁰⁵-⁹₀-₉]/, iast);
    assert.equal(iastToTamil('dharma'), 'தர்ம');
    assert.equal(iastToTamil('bhagavān'), 'பகவான்');
    assert.match(iastToTamil('kṣetre'), /க்ஷ/);
  });

  test('the visarga is ஃ and the avagraha is the right single quote', () => {
    assert.equal(iastToTamil('yuyutsavaḥ'), 'யுயுத்ஸவஃ');
    assert.equal(iastToTamil('ko.atra'), 'கோ’த்ர');
  });

  test('iastTo picks the language', () => {
    assert.equal(iastTo('ml', 'kim'), iastToMalayalam('kim'));
    assert.equal(iastTo('ta', 'kim'), iastToTamil('kim'));
  });
});

describe('a transliteration line of the source', () => {
  test('a half line ends in a single danda', () => {
    assert.equal(sanskritLine('dharma-kṣetre kuru-kṣetre samavetā yuyutsavaḥ .', 'ml'), 'ധർമ-ക്ഷേത്രേ കുരു-ക്ഷേത്രേ സമവേതാ യുയുത്സവഃ ।');
  });

  test('the end of a verse carries its number between double dandas', () => {
    assert.equal(sanskritLine('māmakāḥ pāṇḍavāś caiva kim akurvata sañjaya ||1-1||', 'ta'), 'மாமகாஃ பாண்டவாஶ் சைவ கிம் அகுர்வத ஸஞ்ஜய ॥1-1॥');
    assert.equal(sanskritLine('māmakāḥ pāṇḍavāś caiva kim akurvata sañjaya ||1-1||', 'ml'), 'മാമകാഃ പാണ്ഡവാശ് ചൈവ കിം അകുർവത സഞ്ജയ ॥1-1॥');
  });

  test('a compound verse keeps its range', () => {
    assert.match(sanskritLine('tasmāt sarveṣu kāleṣu ||13-14||', 'ml'), / ॥13-14॥$/);
  });

  test('a line with no danda gets none', () => {
    assert.equal(sanskritLine('kim', 'ta'), 'கிம்');
  });
});

describe('another Indic script into IAST', () => {
  test('Devanagari', () => {
    assert.equal(indicToIast('धर्मक्षेत्रे'), 'dharmakṣetre');
    assert.equal(indicToIast('कृष्ण'), 'kṛṣṇa');
  });

  test('Kannada', () => {
    assert.equal(indicToIast('ಧರ್ಮಕ್ಷೇತ್ರೇ'), 'dharmakṣetre');
  });

  test('Malayalam: the chillu letters are a consonant with a virama, not a letter of another block', () => {
    assert.equal(indicToIast('ധർമ്മ'), 'dharmma');
    assert.equal(indicToIast('ഭഗവാൻ'), 'bhagavān');
    assert.equal(indicToIast('കൃഷ്ണ'), 'kṛṣṇa');
    assert.equal(indicToIast('ഉൾ'), 'uḷ');
    assert.equal(indicToIast('കൺ'), 'kaṇ');
    assert.equal(indicToIast('പൽ'), 'pal');
  });

  test('the chillu letters become a consonant and a virama in Devanagari, one for one', () => {
    assert.equal(toDevanagari('ൺ'), 'ण्');
    assert.equal(toDevanagari('ൻ'), 'न्');
    assert.equal(toDevanagari('ർ'), 'र्');
    assert.equal(toDevanagari('ൽ'), 'ल्');
    assert.equal(toDevanagari('ൾ'), 'ळ्');
    assert.equal(toDevanagari('ൿ'), 'क्');
  });

  test('digits of any script become ASCII digits, and the danda stays', () => {
    assert.equal(toDevanagari('१२३'), '123');
    assert.equal(toDevanagari('।'), '।');
  });
});

describe('another Indic script into Malayalam', () => {
  test('Devanagari, letter for letter', () => {
    assert.equal(indicToMalayalam('धर्मक्षेत्रे'), 'ധർമക്ഷേത്രേ');
  });

  test('a final न् or र् before a consonant takes the chillu, as the corpus writes it', () => {
    assert.equal(indicToMalayalam('भगवान्'), 'ഭഗവാൻ');
    assert.equal(indicToMalayalam('कर्म'), 'കർമ');
  });

  test('Kannada', () => {
    assert.equal(indicToMalayalam('ಧರ್ಮ'), 'ധർമ');
  });

  test('Malayalam already there is not touched', () => {
    assert.equal(indicToMalayalam('ഭഗവാൻ'), 'ഭഗവാൻ');
    assert.equal(indicToMalayalam('ഭഗവാൻ धर्म'), 'ഭഗവാൻ ധർമ');
  });

  test('digits and Latin letters pass through as ASCII', () => {
    assert.equal(indicToMalayalam('१२ abc'), '12 abc');
  });
});

describe('the sound skeleton', () => {
  test('length, voicing, aspiration and the nasal and sibilant classes are ignored', () => {
    assert.equal(iastKey('bhagavān'), 'pakavan');
    assert.equal(iastKey('dharma-kṣetre'), 'tarnaksetre');
    assert.equal(iastKey('Bhagavān'), iastKey('bhagavan'));
    assert.equal(iastKey('kṛṣṇa'), 'krusna');
  });

  test('the avagraha and its source spelling are dropped', () => {
    assert.equal(iastKey('ko.atra'), iastKey('kotra'));
  });

  test('a script text keys to the same skeleton as the IAST it was made from', () => {
    for (const lang of ['ml', 'ta']) {
      for (const [iast] of WORDS) {
        assert.equal(distance(scriptKey(lang, iastTo(lang, iast)), iastKey(iast)), 0, `${lang} ${iast}`);
      }
    }
  });

  test('IAST read back from a script reaches the same skeleton', () => {
    for (const [iast, ml] of WORDS) assert.equal(iastKey(indicToIast(ml)), iastKey(iast), iast);
  });

  test('a whole line survives the trip', () => {
    const line = 'māmakāḥ pāṇḍavāś caiva kim akurvata sañjaya ||1-1||';
    for (const lang of ['ml', 'ta']) assert.ok(distance(scriptKey(lang, sanskritLine(line, lang)), iastKey(line)) < 0.05, lang);
  });

  test('a line in the wrong language is far from the English', () => {
    assert.ok(distance(scriptKey('ml', 'ധൃതരാഷ്ട്രൻ പറഞ്ഞു'), iastKey('dharmakṣetre kurukṣetre')) > 0.4);
  });
});

describe('distance', () => {
  test('0 for the same text, 1 for nothing in common, a share for a partial match', () => {
    assert.equal(distance('abc', 'abc'), 0);
    assert.equal(distance('abc', 'xyz'), 1);
    assert.equal(distance('abcd', 'abxd'), 0.25);
  });

  test('two empty texts are the same', () => {
    assert.equal(distance('', ''), 0);
  });

  test('an empty text against any other is 1', () => {
    assert.equal(distance('', 'abc'), 1);
  });
});
