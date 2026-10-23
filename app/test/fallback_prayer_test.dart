// The prayer a mantra with none of its own ends each round with: kṛṣṇārpaṇamastu,
// written in the reading language's script.

import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/format/indic_script.dart';
import 'package:hariharibol/services/fallback_prayer.dart';

void main() {
  group('the text', () {
    test('is kṛṣṇārpaṇamastu, in Devanagari and in Roman letters', () {
      expect(FallbackPrayer.devanagari, 'कृष्णार्पणमस्तु');
      expect(FallbackPrayer.roman, 'kṛṣṇārpaṇamastu');
    });

    test('Hindi, Marathi and Sanskrit read it in Devanagari as it is', () {
      for (final code in ['hi', 'mr', 'sa']) {
        final written = FallbackPrayer.textFor([code]);
        expect(written.language, code);
        expect(written.text, FallbackPrayer.devanagari);
      }
    });

    test('English reads it in Roman letters', () {
      final written = FallbackPrayer.textFor(['en']);
      expect(written.language, 'en');
      expect(written.text, FallbackPrayer.roman);
    });

    test('each other Indian language reads it in its own script', () {
      final scripts = {
        'gu': RegExp(r'^[઀-૿]+$'),
        'bn': RegExp(r'^[ঀ-৿]+$'),
        'as': RegExp(r'^[ঀ-৿]+$'),
        'pa': RegExp(r'^[਀-੿]+$'),
        'or': RegExp(r'^[଀-୿]+$'),
        'ta': RegExp(r'^[஀-௿]+$'),
        'te': RegExp(r'^[ఀ-౿]+$'),
        'kn': RegExp(r'^[ಀ-೿]+$'),
        'ml': RegExp(r'^[ഀ-ൿ]+$'),
      };

      scripts.forEach((code, script) {
        final written = FallbackPrayer.textFor([code]);
        expect(written.language, code, reason: code);
        expect(written.text, fromDevanagari(FallbackPrayer.devanagari, code), reason: code);
        expect(script.hasMatch(written.text), isTrue, reason: '$code: ${written.text}');
        expect(written.text, isNot(FallbackPrayer.devanagari), reason: code);
      });
    });

    test('follows the first language of the chain that it can be written in', () {
      expect(FallbackPrayer.textFor(['ta', 'hi']).language, 'ta');
      expect(FallbackPrayer.textFor(['hi', 'ta']).language, 'hi');
      expect(FallbackPrayer.textFor(['xx', 'kn']).language, 'kn');
    });

    test('is in Roman letters for a chain it cannot be written in, or an empty one', () {
      expect(FallbackPrayer.textFor(['xx']).text, FallbackPrayer.roman);
      expect(FallbackPrayer.textFor(const []).text, FallbackPrayer.roman);
      expect(FallbackPrayer.textFor(const []).language, 'en');
    });
  });

  group('the mantra', () {
    test('is named as given, written for the reading chain, and takes three seconds', () {
      final prayer = FallbackPrayer.of(name: 'Offering to Krishna', readingChain: const ['mr', 'en']);

      expect(prayer.name, 'Offering to Krishna');
      expect(prayer.text, FallbackPrayer.devanagari);
      expect(prayer.textLanguage, 'mr');
      expect(prayer.transliteration, FallbackPrayer.roman);
      expect(prayer.durationMs, FallbackPrayer.standardMs);
      expect(prayer.durationMs, 3000);
      expect(prayer.prayer, isNull, reason: 'a prayer has no prayer of its own');
    });

    test('is the same mantra whatever the language, so the app can tell it from a real one', () {
      final english = FallbackPrayer.of(name: 'a', readingChain: const ['en']);
      final tamil = FallbackPrayer.of(name: 'b', readingChain: const ['ta']);
      expect(english.id, tamil.id);
      expect(english.slug, 'krishnarpanamastu');
    });
  });
}
