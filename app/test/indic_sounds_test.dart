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
