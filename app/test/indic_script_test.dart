// Devanagari carried into another Indic script, and the verse transliteration that
// uses it. The same cases as backend/test/pick-transliteration.test.js — the two
// must agree, or a phone online and a phone offline would show different letters.

import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/format/indic_script.dart';
import 'package:hariharibol/core/format/script.dart';
import 'package:hariharibol/db/app_database.dart';
import 'package:hariharibol/repositories/book_repository.dart';

const _iast = 'sañjaya uvāca';
const _sanskrit = 'सञ्जय उवाच';

TranslationRecord _row(String language, {String? transliteration, String type = 'TRANSLATION'}) => TranslationRecord(
      id: language,
      verseRowId: 'v',
      languageCode: language,
      type: type,
      displayOrder: 0,
      transliteration: transliteration,
    );

String? _pick(List<TranslationRecord> rows, List<String> chain, {String? sanskrit}) =>
    BookRepository.pickTransliteration(rows, chain, _iast, sanskrit: sanskrit);

void main() {
  final english = _row('en');
  final marathi = _row('mr', transliteration: 'सञ्जय उवाच');
  final tamil = _row('ta', transliteration: 'சஞ்ஜய உவாச');

  group('fromDevanagari', () {
    test('a code-point shift for the scripts that mirror Devanagari', () {
      expect(fromDevanagari(_sanskrit, 'kn'), 'ಸಞ್ಜಯ ಉವಾಚ');
      expect(fromDevanagari(_sanskrit, 'te'), 'సఞ్జయ ఉవాచ');
      expect(fromDevanagari('हरे कृष्ण', 'bn'), 'হরে কৃষ্ণ');
    });

    test('verse numbers and dandas come across, dandas unchanged', () {
      expect(fromDevanagari('तस्मात् ।\n॥३-४१॥', 'kn'), 'ತಸ್ಮಾತ್ ।\n॥೩-೪೧॥');
    });

    test('Om, and letters a script lacks, use the tables', () {
      expect(fromDevanagari('ॐ', 'kn'), 'ಓಂ');
      expect(fromDevanagari('वासुदेव', 'bn'), 'বাসুদেব');
      expect(fromDevanagari('कृष्ण', 'ta'), 'கிருஷ்ண');
    });

    test('Tamil folds aspirates and voiced consonants onto the plain ones', () {
      expect(fromDevanagari('गोविन्द', 'ta'), 'கோவிந்த');
    });

    test('Hindi, Marathi, English and unknown codes come back unchanged', () {
      for (final code in ['hi', 'mr', 'en', 'sa', 'xx']) {
        expect(fromDevanagari(_sanskrit, code), _sanskrit);
        expect(hasIndicScript(code), isFalse);
      }
      expect(hasIndicScript('kn'), isTrue);
    });
  });

  group('pickTransliteration', () {
    test('a Marathi reader gets the Marathi transliteration, not the Roman one', () {
      expect(_pick([english, marathi], ['mr', 'en']), 'सञ्जय उवाच');
    });

    test('a Kannada reader with nothing stored gets Kannada letters, not Roman', () {
      expect(_pick([english], ['kn', 'en'], sanskrit: _sanskrit), 'ಸಞ್ಜಯ ಉವಾಚ');
    });

    test('a stored transliteration still wins over the conversion', () {
      expect(_pick([tamil], ['ta', 'en'], sanskrit: _sanskrit), 'சஞ்ஜய உவாச');
    });

    test('the first language in the chain with an answer decides', () {
      expect(_pick([marathi], ['te', 'mr', 'en'], sanskrit: _sanskrit), 'సఞ్జయ ఉవాచ');
      expect(_pick([marathi, tamil], ['mr', 'ta', 'en'], sanskrit: _sanskrit), 'सञ्जय उवाच');
    });

    test('English and Devanagari readers keep the Roman text', () {
      expect(_pick([english], ['en'], sanskrit: _sanskrit), _iast);
      expect(_pick([english], ['hi', 'en'], sanskrit: _sanskrit), _iast);
    });

    test('a blank stored value is not an answer', () {
      expect(_pick([_row('mr', transliteration: '  ')], ['mr', 'en']), _iast);
    });

    test('without the Devanagari there is nothing to convert', () {
      expect(_pick([english], ['kn', 'en']), _iast);
      expect(_pick([english], ['kn', 'en'], sanskrit: '   '), _iast);
    });

    test('a poetic expansion row of the same language does not hide the translation beside it', () {
      final ovi = _row('mr', type: 'POETIC_EXPANSION');
      expect(_pick([ovi, marathi], ['mr', 'en']), 'सञ्जय उवाच');
    });
  });

  test('isDevanagari reads the first letter', () {
    expect(isDevanagari('॥ १.१ ॥ धर्म'), isTrue);
    expect(isDevanagari('ಧರ್ಮ'), isFalse);
    expect(isDevanagari('dharma'), isFalse);
    expect(isDevanagari(''), isFalse);
  });
}
