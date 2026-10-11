import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/constants/auto_chant_config.dart';
import 'package:hariharibol/services/mantra_phrase_matcher.dart';

const _maha = 'Hare Krishna Hare Krishna Krishna Krishna Hare Hare '
    'Hare Rama Hare Rama Rama Rama Hare Hare';

/// Feeds [text] a word at a time, like a recogniser revising its transcript,
/// then closes the utterance; returns the repetitions counted.
int _heard(MantraPhraseMatcher matcher, String text) {
  final words = text.split(' ');
  var total = 0;
  for (var i = 1; i <= words.length; i++) {
    total += matcher.update(words.take(i).join(' '));
  }
  total += matcher.update(text, isFinal: true);
  matcher.reset();
  return total;
}

void main() {
  group('fold', () {
    test('spelling variants of a sound agree', () {
      expect(MantraPhraseMatcher.fold('Hare'), MantraPhraseMatcher.fold('Hari'));
      expect(MantraPhraseMatcher.fold('Kṛṣṇa'), 'KRSNA');
      expect(MantraPhraseMatcher.fold('Krishna'), 'KRISNA');
      expect(MantraPhraseMatcher.fold('Shivaya'), MantraPhraseMatcher.fold('Sivaya'));
    });
  });

  group('the sharper recogniser writes Sanskrit in Devanagari', () {
    const rama = ['श्री राम जय राम जय जय राम', 'Shri Ram Jai Ram Jai Jai Ram'];
    const bar = AutoChantConfig.accurateMatchThreshold;

    test('what it wrote for a chant counts, in whichever script it chose', () {
      // Taken from the offline bench: the real output for the same chant.
      for (final heard in ['श्री राम जै राम जै जय राम', 'શ્રી રામ જય રામ જય જય રામ', 'ശ്രീ രാമ ജയ രാമ ജയ ജയ രാമ']) {
        expect(_heard(MantraPhraseMatcher(rama, threshold: bar), heard), 1, reason: heard);
      }
    });

    test('three in a row are three', () {
      const once = 'श्री राम जय राम जय जय राम';
      expect(_heard(MantraPhraseMatcher(rama, threshold: bar), '$once $once $once'), 3);
    });

    test('ordinary Hindi is not a chant, though half-way it would have been', () {
      const sentence = 'आज मौसम बहुत अच्छा है और हम बाजार जा रही हैं';
      expect(_heard(MantraPhraseMatcher(rama, threshold: bar), sentence), 0);
    });

    test('a different mantra is not this one', () {
      const other = 'ॐ नमः शिवाय ॐ नमः शिवाय';
      expect(_heard(MantraPhraseMatcher(rama, threshold: bar), other), 0);
    });
  });

  group('a one-syllable mantra', () {
    test('"Om" is counted when it is what was said', () {
      expect(_heard(MantraPhraseMatcher(['Om', 'Aum']), 'OM'), 1);
      expect(_heard(MantraPhraseMatcher(['ॐ']), 'ओम'), 1);
    });

    test('the same sound inside a sentence is a couple of counts at most, never one per sound', () {
      // Transcripts of ordinary speech from the bench: "um"/"om" turns up in them.
      // At the 36% floor a two-letter phrase is met by a single letter, so a
      // sentence can count; a further count needs more, which holds it to a
      // couple ("AM" is two thirds of "Aum"). It was none at a bar of half.
      for (final sentence in ['ADD MASSAM BOHETA OR HUMBAIJAR JAM', 'GODS OF AMAZA JUMPAPER HAD ABOUT THE SUMMER']) {
        expect(_heard(MantraPhraseMatcher(['Om', 'Aum']), sentence), lessThanOrEqualTo(2), reason: sentence);
      }
    });
  });

  group('counting', () {
    test('one clean repetition is one', () {
      expect(_heard(MantraPhraseMatcher([_maha]), _maha), 1);
    });

    test('two back to back are two, with no pause between', () {
      expect(_heard(MantraPhraseMatcher([_maha]), '$_maha $_maha'), 2);
    });

    test('a recogniser that mishears the words still counts', () {
      const mangled = 'HARI KRISHNA HARI CHRISTINA KRISHNA KRISHNA HARI HARI '
          'HARI RAMA HARI RAMA RAMA RAMA HARI';
      expect(_heard(MantraPhraseMatcher([_maha]), mangled), 1);
    });

    test('fast chanting that drops letters counts each time through', () {
      const fast = 'ARE KRISNA ARE KRISNA KRISNA ARE ARE ARE RAMA ARE RAMA RAMA ARE ARE';
      expect(_heard(MantraPhraseMatcher([_maha]), '$fast $fast $fast'), 3);
    });

    test('a quarter of the mantra does not count', () {
      expect(_heard(MantraPhraseMatcher([_maha]), 'hare krishna hare'), 0);
    });

    test('a chant the recogniser only half caught counts at the floor', () {
      // Short of half the mantra's sounds: left uncounted when the bar was half.
      final matcher = MantraPhraseMatcher([_maha]);
      const heard = 'hare krishna hare krishna krishna';
      final near = matcher.closest(heard)!;
      expect(near.ratio, inInclusiveRange(AutoChantConfig.matchThreshold, 0.5));
      expect(near.needed, AutoChantConfig.matchThreshold);
      expect(_heard(matcher, heard), 1);
    });

    test('below the floor does not count', () {
      final matcher = MantraPhraseMatcher([_maha]);
      expect(_heard(matcher, 'good bud'), 0);
      expect(_heard(matcher, 'the quick brown fox jumps over the lazy dog'), 0);
      expect(_heard(matcher, 'I went to the market this morning and bought some vegetables for dinner'), 0);
    });

    test('a chant that never pauses is counted as it goes, not after the pause', () {
      // Four garbled repetitions, no gap: each is settled by what follows it.
      const garbled = 'ARI KRISNA ARI KRISNA KRISNA ARI ARI ARI RAMA ';
      final words = (garbled * 4).trim().split(' ');
      final matcher = MantraPhraseMatcher([_maha]);
      var before = 0;
      for (var i = 1; i <= words.length; i++) {
        before += matcher.update(words.take(i).join(' '));
      }
      expect(before, greaterThanOrEqualTo(3), reason: 'counted while still chanting');
      final total = before + matcher.update(garbled * 4, isFinal: true);
      expect(total, lessThanOrEqualTo(4), reason: 'and not counted again when the voice stops');
    });

    test('half a repetition is not counted twice as the rest arrives', () {
      final matcher = MantraPhraseMatcher([_maha]);
      final words = '$_maha $_maha'.split(' ');
      var total = 0;
      for (var i = 1; i <= words.length; i++) {
        total += matcher.update(words.take(i).join(' '));
      }
      expect(total, 2);
    });

    test('words with none of the mantra\'s sounds do not count', () {
      final matcher = MantraPhraseMatcher([_maha]);
      expect(_heard(matcher, 'good bud'), 0);
      expect(_heard(matcher, 'to do good'), 0);
    });

    test('any of a mantra\'s phrases will do, the best one wins', () {
      final matcher = MantraPhraseMatcher(['Om Namah Shivaya', 'Om Namaha Shivay']);
      expect(_heard(matcher, 'om namaha shivay om namah shivaya'), 2);
    });

    test('a very short mantra needs more for a further repetition', () {
      final matcher = MantraPhraseMatcher(['Om Namah Shivaya']);
      expect(_heard(matcher, 'om namah shivaya'), 1);
      expect(_heard(matcher, 'om namah shivaya om namah shivaya'), 2);
      expect(_heard(matcher, 'hare krishna hare krishna'), 0);
    });

    test('the first count needs the floor and nothing more, whatever the length', () {
      for (final letters in [2, 12, 24, 60]) {
        expect(MantraPhraseMatcher.needed(letters), AutoChantConfig.matchThreshold);
      }
      // A further repetition in the same stretch is held higher when short.
      expect(MantraPhraseMatcher.needed(60, further: true), AutoChantConfig.matchThreshold);
      expect(MantraPhraseMatcher.needed(12, further: true), greaterThan(AutoChantConfig.matchThreshold));
      // The sharper recogniser keeps the short-phrase rise on every count.
      expect(
        MantraPhraseMatcher.needed(12, threshold: AutoChantConfig.accurateMatchThreshold),
        greaterThan(AutoChantConfig.accurateMatchThreshold),
      );
    });

    test('closest says how near a miss came, and changes nothing', () {
      final matcher = MantraPhraseMatcher(['Om Namah Shivaya']);
      final miss = matcher.closest('bd gt pk')!;
      expect(miss.ratio, lessThan(miss.needed));

      final hit = matcher.closest('om namah shivaya')!;
      expect(hit.ratio, greaterThanOrEqualTo(hit.needed));
      // Looking did not use anything up: the same words still count.
      expect(_heard(matcher, 'om namah shivaya'), 1);
    });

    test('closest looks only at what is not yet counted', () {
      final matcher = MantraPhraseMatcher([_maha]);
      expect(matcher.closest(_maha)!.ratio, greaterThanOrEqualTo(MantraPhraseMatcher.needed(_maha.length)));
      expect(matcher.update(_maha, isFinal: true), 1);
      // What is left over is at most a stub, nowhere near another repetition.
      final left = matcher.closest(_maha);
      expect(left == null || left.ratio < left.needed, isTrue);
    });

    test('no phrases means nothing is ever heard', () {
      final matcher = MantraPhraseMatcher(const []);
      expect(matcher.hasPhrases, isFalse);
      expect(matcher.closest('hare krishna'), isNull);
      expect(matcher.update('hare krishna', isFinal: true), 0);
    });
  });
}
