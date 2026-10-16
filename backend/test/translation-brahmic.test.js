// IAST into the scripts of Hindi, Marathi, Bengali, Telugu and Kannada (scripts/lib/translation-brahmic.js), and the way
// translation-script.js uses it. Pure functions, no I/O, no network.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { iastToBrahmic, iastToDevanagari } from '../scripts/lib/translation-brahmic.js';
import { iastKey, iastTo, indicToBrahmic, sanskritLine, scriptKey } from '../scripts/lib/translation-script.js';

/** [IAST, hi/mr, bn, te, kn] — words from the first chapter, as the rest of the corpus writes them. */
const WORDS = [
  ['dharma-kṣetre', 'धर्म-क्षेत्रे', 'ধর্ম-ক্ষেত্রে', 'ధర్మ-క్షేత్రే', 'ಧರ್ಮ-ಕ್ಷೇತ್ರೇ'],
  ['yuyutsavaḥ', 'युयुत्सवः', 'যুযুৎসবঃ', 'యుయుత్సవః', 'ಯುಯುತ್ಸವಃ'],
  ['pāṇḍavāś', 'पाण्डवाश्', 'পাণ্ডবাশ্', 'పాణ్డవాశ్', 'ಪಾಣ್ಡವಾಶ್'],
  ['sañjaya', 'सञ्जय', 'সঞ্জয়', 'సఞ్జయ', 'ಸಞ್ಜಯ'],
  ['kṛṣṇa', 'कृष्ण', 'কৃষ্ণ', 'కృష్ణ', 'ಕೃಷ್ಣ'],
  ['kim', 'किम्', 'কিম্', 'కిమ్', 'ಕಿಮ್'],
  ['abravīt', 'अब्रवीत्', 'অব্রবীৎ', 'అబ్రవీత్', 'ಅಬ್ರವೀತ್'],
  ['dhṛtarāṣṭra uvāca', 'धृतराष्ट्र उवाच', 'ধৃতরাষ্ট্র উবাচ', 'ధృతరాష్ట్ర ఉవాచ', 'ಧೃತರಾಷ್ಟ್ರ ಉವಾಚ'],
  ['kuntī', 'कुन्ती', 'কুন্তী', 'కుంతీ', 'ಕುಂತೀ'],
  ['janma', 'जन्म', 'জন্ম', 'జన్మ', 'ಜನ್ಮ'],
  ['saṃjaya', 'संजय', 'সংজয়', 'సంజయ', 'ಸಂಜಯ'],
];

describe('IAST into Devanagari', () => {
  test('consonants, vowel signs, conjuncts and the three marks', () => {
    assert.equal(iastToDevanagari('dharma-kṣetre'), 'धर्म-क्षेत्रे');
    assert.equal(iastToDevanagari('jñāna'), 'ज्ञान');
    assert.equal(iastToDevanagari('sāṃkhya'), 'सांख्य');
    assert.equal(iastToDevanagari('duḥkha'), 'दुःख');
    assert.equal(iastToDevanagari('aiśvarya'), 'ऐश्वर्य');
    assert.equal(iastToDevanagari('bhrātṝn'), 'भ्रातॄन्');
  });

  test('an aspirate is one letter, and a stop followed by an h that is not its aspirate is two', () => {
    assert.equal(iastToDevanagari('bhagavān'), 'भगवान्');
    assert.equal(iastToDevanagari('tathā'), 'तथा');
    assert.equal(iastToDevanagari('sah'), 'सह्');
    assert.equal(iastToDevanagari('ś'), 'श्');
  });

  test('the source writes an avagraha as ".a" between two letters; the "a" is part of the code', () => {
    assert.equal(iastToDevanagari('ko.atra'), 'कोऽत्र');
    assert.equal(iastToDevanagari('paco.a to'), 'पचोऽ तो');
  });

  test('".N" is the candrabindu before l', () => {
    assert.equal(iastToDevanagari('śraddhāvā.Nllabhate'), 'श्रद्धावाँल्लभते');
    assert.equal(iastToBrahmic('kn', 'imā.Nllokān'), 'ಇಮಾಁಲ್ಲೋಕಾನ್');
  });

  test('digits, punctuation and separators stay; capitals are read as lower case', () => {
    assert.equal(iastToDevanagari('Kṛṣṇa, 12-3 (kim)'), 'कृष्ण, 12-3 (किम्)');
  });
});

describe('IAST into the five scripts', () => {
  for (const [iast, deva, bn, te, kn] of WORDS) {
    test(iast, () => {
      assert.equal(iastToBrahmic('hi', iast), deva);
      assert.equal(iastToBrahmic('mr', iast), deva);
      assert.equal(iastToBrahmic('bn', iast), bn);
      assert.equal(iastToBrahmic('te', iast), te);
      assert.equal(iastToBrahmic('kn', iast), kn);
    });
  }

  test('Bengali has no va and no ḷ: it writes ব and ল', () => {
    assert.equal(iastToBrahmic('bn', 'veda'), 'বেদ');
    assert.equal(iastToBrahmic('bn', 'kuḷa'), 'কুল');
  });

  test('Bengali puts a nukta on y, ḍ and ḍh between vowels, and none at the start of a word or inside a conjunct', () => {
    assert.equal(iastToBrahmic('bn', 'yajña'), 'যজ্ঞ');
    assert.equal(iastToBrahmic('bn', 'sañjaya'), 'সঞ্জয়');
    assert.equal(iastToBrahmic('bn', 'vyūḍham'), 'ব্যূঢ়ম্');
    assert.equal(iastToBrahmic('bn', 'bhavet'), 'ভবেৎ');
    assert.equal(iastToBrahmic('bn', 'āścaryavatpaśyati'), 'আশ্চর্যবৎপশ্যতি');
    assert.equal(iastToBrahmic('bn', 'tatkṣaṇāt'), 'তৎক্ষণাৎ');
    assert.equal(iastToBrahmic('bn', 'tattva'), 'তত্ত্ব');
  });

  test('Telugu and Kannada write n and m before a consonant of their own row as the anusvara, and keep ṅ ñ ṇ and other pairs', () => {
    assert.equal(iastToBrahmic('te', 'kunti'), 'కుంతి');
    assert.equal(iastToBrahmic('kn', 'sambandha'), 'ಸಂಬಂಧ');
    assert.equal(iastToBrahmic('te', 'janma'), 'జన్మ');
    assert.equal(iastToBrahmic('kn', 'anna'), 'ಅನ್ನ');
    assert.equal(iastToBrahmic('te', 'śaṅkha'), 'శఙ్ఖ');
    assert.equal(iastToBrahmic('hi', 'kunti'), 'कुन्ति');
    assert.equal(iastToBrahmic('bn', 'kunti'), 'কুন্তি');
  });

  test('an unknown language is an error, not Tamil', () => {
    assert.throws(() => iastTo('ru', 'kim'), /no converter/);
    assert.throws(() => scriptKey('ru', 'kim'), /no converter/);
  });
});

describe('through translation-script.js', () => {
  test('iastTo dispatches to the right script', () => {
    assert.equal(iastTo('bn', 'kim'), 'কিম্');
    assert.equal(iastTo('ml', 'kim'), 'കിം');
    assert.equal(iastTo('ta', 'kim'), 'கிம்');
  });

  test('a transliteration line of the source keeps its danda and verse number', () => {
    assert.equal(sanskritLine('dharmakṣetre kurukṣetre samavetā yuyutsavaḥ .', 'te'), 'ధర్మక్షేత్రే కురుక్షేత్రే సమవేతా యుయుత్సవః ।');
    assert.equal(sanskritLine('māmakāḥ pāṇḍavāścaiva kimakurvata sañjaya ||1-1||', 'hi'), 'मामकाः पाण्डवाश्चैव किमकुर्वत सञ्जय ॥1-1॥');
    assert.equal(sanskritLine('saṃjaya uvāca', 'kn'), 'ಸಂಜಯ ಉವಾಚ');
  });

  test('stray letters of one script move onto another by position', () => {
    assert.equal(indicToBrahmic('te', 'ऐ'), 'ఐ');
    assert.equal(indicToBrahmic('kn', 'ऽ'), 'ಽ');
    assert.equal(indicToBrahmic('te', 'ঽ'), 'ఽ');
    assert.equal(indicToBrahmic('bn', 'क'), 'ক');
    assert.equal(indicToBrahmic('bn', 'व'), 'ব');
    assert.equal(indicToBrahmic('hi', 'ক'), 'क');
  });

  test('the sound skeleton of a script text equals that of the IAST it was made from', () => {
    for (const lang of ['hi', 'mr', 'bn', 'te', 'kn']) {
      for (const iast of ['dharma-kṣetre', 'pāṇḍavāś', 'sañjaya', 'abravīt', 'yuyutsavaḥ', 'kṛṣṇa']) {
        const have = scriptKey(lang, iastToBrahmic(lang, iast));
        const want = iastKey(iast);
        // Bengali writes v as ব, which reads back as b: the skeleton keeps v and p apart
        if (lang === 'bn' && /v/.test(iast)) continue;
        assert.equal(have, want, `${lang} ${iast}`);
      }
    }
  });
});
