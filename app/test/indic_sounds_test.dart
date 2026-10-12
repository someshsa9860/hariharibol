import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/services/indic_sounds.dart';
import 'package:hariharibol/services/mantra_phrase_matcher.dart';

void main() {
  group('indicToRoman', () {
    test('Roman text, digits and spaces pass through untouched', () {
      expect(indicToRoman('Hare Krishna 108'), 'Hare Krishna 108');
      expect(indicToRoman('Kṛṣṇa'), 'Kṛṣṇa');
    });

    test('Devanagari is spelled out, and the "a" that ends a word is not said', () {
      expect(indicToRoman('राम'), 'ram');
      expect(indicToRoman('श्री राम'), 'shri ram');
      expect(indicToRoman('ॐ नमः शिवाय'), 'om namah shivay');
    });

    test('a virama joins consonants, a nasal and a nukta letter are said', () {
      expect(indicToRoman('कृष्ण'), 'krishn');
      expect(indicToRoman('हरे कृष्ण'), 'hare krishn');
      expect(indicToRoman('\u095Bरूर'), 'zarur');
    });

    test('every Indic script lands on the same sounds', () {
      final ram = MantraPhraseMatcher.fold('Ram');
      for (final written in ['राम', 'રામ', 'রাম', 'ਰਾਮ', 'రామ', 'ರಾಮ', 'രാമ']) {
        expect(MantraPhraseMatcher.fold(written), ram, reason: written);
      }
    });
  });

  group('readableScripts', () {
    test('Devanagari and Roman text come through as they are', () {
      expect(readableScripts('हरे कृष्ण हरे राम'), 'हरे कृष्ण हरे राम');
      expect(readableScripts('Hare Krishna 108'), 'Hare Krishna 108');
      expect(readableScripts('Kṛṣṇa'), 'Kṛṣṇa');
    });

    test('Urdu is never shown, however it is mixed in', () {
      expect(readableScripts('شويرام جيرام ججيرام'), '');
      expect(readableScripts('um nome شوي'), 'um nome');
      expect(readableScripts('اوم نمور بگبتے واسو دیوائ'), '');
      expect(readableScripts('हरे ہرے कृष्ण'), 'हरे कृष्ण');
    });

    test('another Indic script is shown as its Devanagari twin', () {
      expect(readableScripts('રામ'), 'राम');
      expect(readableScripts('ഹരേ'), 'हरे');
      expect(readableScripts('ಹರೇ ಕೃಷ್ಣ'), 'हरे कृष्ण');
    });

    test('other scripts are dropped and the spaces they leave are closed up', () {
      expect(readableScripts('राम 你好 राम'), 'राम राम');
      expect(readableScripts('рама ram'), 'ram');
      expect(readableScripts('  \n राम \t  राम  '), 'राम राम');
      expect(readableScripts(''), '');
    });

    test('nothing it lets through folds differently from what was heard', () {
      // The card is told less than the matcher is, never something else.
      for (final text in ['राम राम', 'રામ રામ', 'om namah shivaya']) {
        expect(MantraPhraseMatcher.fold(readableScripts(text)), MantraPhraseMatcher.fold(text));
      }
    });
  });

  group('fold agrees with the offline bench', () {
    // Real transcripts from the recogniser, and their folded form as produced by
    // the Python reference the bench numbers came from.
    final cases = (jsonDecode(File('test/fixtures/indic_fold_cases.json').readAsStringSync()) as List)
        .map((c) => (c as List).cast<String>())
        .toList();

    test('${cases.length} cases', () {
      for (final c in cases) {
        expect(MantraPhraseMatcher.fold(c[0]), c[1], reason: c[0]);
      }
    });
  });
}
