// Where the chants of a recorded mala fall, and how a stream of playback
// positions becomes counts. What is being guarded is the arithmetic the counter
// stands on: a chant is counted as it ends, a seek counts nothing, and a mala
// played through counts exactly its chants — no more and no fewer.

import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/services/chant_mala_timing.dart';

/// A mala that opens with a ten second prayer, then chants for 432 s: 108
/// chants of 4 s each.
final ChantMalaTiming timing = ChantMalaTiming(
  start: const Duration(seconds: 10),
  end: const Duration(seconds: 442),
  chants: 108,
);

const Duration step = Duration(seconds: 2);
const Duration tick = Duration(milliseconds: 100);

/// Plays from [from] to [to], a tenth of a second at a time, and returns how
/// many chants were counted on the way.
int play(ChantMalaFollower follower, Duration from, Duration to) {
  var counted = 0;
  for (var at = from + tick; at <= to; at += tick) {
    counted += follower.advance(at);
  }
  return counted;
}

void main() {
  group('ChantMalaTiming', () {
    test('a chant takes the stretch divided by the number of chants', () {
      expect(timing.perChant, const Duration(seconds: 4));
    });

    test('nothing is counted until the first chant has ended', () {
      expect(timing.chantsDoneAt(Duration.zero), 0);
      expect(timing.chantsDoneAt(const Duration(seconds: 10)), 0);
      expect(timing.chantsDoneAt(const Duration(milliseconds: 13999)), 0);
    });

    test('a chant is counted at the moment it ends', () {
      expect(timing.chantsDoneAt(const Duration(seconds: 14)), 1);
      expect(timing.chantsDoneAt(const Duration(milliseconds: 17999)), 1);
      expect(timing.chantsDoneAt(const Duration(seconds: 18)), 2);
    });

    test('the last chant ends at the end, and nothing is counted after it', () {
      expect(timing.chantsDoneAt(const Duration(milliseconds: 441999)), 107);
      expect(timing.chantsDoneAt(const Duration(seconds: 442)), 108);
      expect(timing.chantsDoneAt(const Duration(minutes: 20)), 108);
    });

    test('a stretch that does not divide evenly never rounds a chant short', () {
      final thirds = ChantMalaTiming(
        start: Duration.zero,
        end: const Duration(seconds: 100),
        chants: 3,
      );
      expect(thirds.chantsDoneAt(const Duration(milliseconds: 33332)), 0);
      expect(thirds.chantsDoneAt(const Duration(milliseconds: 33334)), 1);
      expect(thirds.chantsDoneAt(const Duration(seconds: 100)), 3);
    });
  });

  group('ChantMalaFollower', () {
    ChantMalaFollower follower() => ChantMalaFollower(timing, continuousStep: step);

    test('playing the whole recording counts every chant once', () {
      final f = follower();
      expect(play(f, Duration.zero, const Duration(seconds: 442)), 108);
      expect(f.counted, 108);
    });

    test('a count lands within a reading of the end of its chant', () {
      final f = follower();
      expect(play(f, Duration.zero, const Duration(milliseconds: 13900)), 0);
      expect(f.advance(const Duration(milliseconds: 14000)), 1);
    });

    test('a step that crosses several chants counts all of them', () {
      final quick = ChantMalaFollower(
        ChantMalaTiming(start: Duration.zero, end: const Duration(seconds: 10), chants: 10),
        continuousStep: step,
      );
      expect(quick.advance(const Duration(milliseconds: 1900)), 1);
      // Two seconds exactly is still listening, not a seek.
      expect(quick.advance(const Duration(milliseconds: 3900)), 2);
    });

    test('seeking ahead counts nothing for the chants it skips', () {
      final f = follower()..relocate(const Duration(seconds: 300));
      expect(f.counted, 72);
      expect(f.advance(const Duration(milliseconds: 300100)), 0);
      // Chant 73 ends at 302 s; counting carries on from there.
      expect(play(f, const Duration(milliseconds: 300100), const Duration(seconds: 302)), 1);
    });

    test('seeking back counts nothing, and playing it again counts it again', () {
      final f = follower();
      expect(play(f, Duration.zero, const Duration(seconds: 100)), 22);

      f.relocate(const Duration(seconds: 50));
      expect(f.counted, 10);
      expect(play(f, const Duration(seconds: 50), const Duration(seconds: 100)), 12);
    });

    test('a jump nobody asked for is treated as a seek', () {
      final f = follower();
      expect(play(f, Duration.zero, const Duration(seconds: 20)), 2);
      expect(f.advance(const Duration(seconds: 200)), 0);
      expect(f.counted, 47);
    });

    test('a reading that wobbles back neither uncounts nor recounts a chant', () {
      final f = follower();
      expect(play(f, Duration.zero, const Duration(milliseconds: 14100)), 1);
      expect(f.advance(const Duration(milliseconds: 13950)), 0);
      expect(f.counted, 1);
      expect(f.advance(const Duration(milliseconds: 14050)), 0);
    });

    test('standing still counts nothing', () {
      final f = follower();
      expect(play(f, Duration.zero, const Duration(seconds: 14)), 1);
      expect(f.advance(const Duration(seconds: 14)), 0);
      expect(f.advance(const Duration(seconds: 14)), 0);
    });
  });
}
