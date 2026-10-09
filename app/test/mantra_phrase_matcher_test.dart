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

    test('the same sound inside a sentence is not', () {
      // Transcripts of ordinary speech from the bench: "um"/"om" turns up in them.
      for (final sentence in ['ADD MASSAM BOHETA OR HUMBAIJAR JAM', 'GODS OF AMAZA JUMPAPER HAD ABOUT THE SUMMER']) {
        expect(_heard(MantraPhraseMatcher(['Om', 'Aum']), sentence), 0, reason: sentence);
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

    test('half a repetition is not counted twice as the rest arrives', () {
      final matcher = MantraPhraseMatcher([_maha]);
      final words = '$_maha $_maha'.split(' ');
      var total = 0;
      for (var i = 1; i <= words.length; i++) {
        total += matcher.update(words.take(i).join(' '));
      }
      expect(total, 2);
    });

    test('another mantra, or plain speech, does not count', () {
      final matcher = MantraPhraseMatcher([_maha]);
      expect(_heard(matcher, 'om namah shivaya om namah shivaya'), 0);
      expect(_heard(matcher, 'the quick brown fox jumps over the lazy dog'), 0);
    });

    test('any of a mantra\'s phrases will do, the best one wins', () {
      final matcher = MantraPhraseMatcher(['Om Namah Shivaya', 'Om Namaha Shivay']);
      expect(_heard(matcher, 'om namaha shivay om namah shivaya'), 2);
    });

    test('a very short mantra needs more than half to match', () {
      final matcher = MantraPhraseMatcher(['Om Namah Shivaya']);
      expect(_heard(matcher, 'om namah shivaya'), 1);
      expect(_heard(matcher, 'hare krishna hare krishna'), 0);
    });

    test('closest says how near a miss came, and changes nothing', () {
      final matcher = MantraPhraseMatcher(['Om Namah Shivaya']);
      final miss = matcher.closest('hare krishna')!;
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
