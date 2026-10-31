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

/// A file of 438 s whose prayer takes 5 s and whose chanting is over at 430 s:
/// the 425 s between them are shared by 108 chants, 425/108 s each, and the last
/// 8 s of the file count nothing.
final ChantMalaTiming trimmed = ChantMalaTiming(
  start: const Duration(seconds: 5),
  end: const Duration(seconds: 430),
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

    test('a chant is the stretch between start and end over the chants, not the whole file', () {
      expect(trimmed.perChant.inMicroseconds, closeTo(425 / 108 * 1e6, 1));
      // The first chant ends 425/108 s (about 3.94 s) after the prayer, at about 8.94 s.
      expect(trimmed.chantsDoneAt(const Duration(seconds: 5)), 0);
      expect(trimmed.chantsDoneAt(const Duration(milliseconds: 8934)), 0);
      expect(trimmed.chantsDoneAt(const Duration(milliseconds: 8936)), 1);
      // Halfway through the stretch is halfway through the count.
      expect(trimmed.chantsDoneAt(const Duration(milliseconds: 217500)), 54);
      expect(trimmed.chantsDoneAt(const Duration(milliseconds: 429999)), 107);
      expect(trimmed.chantsDoneAt(const Duration(seconds: 430)), 108);
      expect(trimmed.chantsDoneAt(const Duration(seconds: 438)), 108);
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

    test('no chants done is the start of the chanting, after the prayer', () {
      expect(timing.positionAfter(0), const Duration(seconds: 10));
      expect(trimmed.positionAfter(0), const Duration(seconds: 5));
      // Below nothing is the same place; it is never in front of the prayer's end.
      expect(timing.positionAfter(-3), const Duration(seconds: 10));
    });

    test('30 chants of a recording with a prayer lead-in are the prayer plus 30 chants', () {
      // 10 s of prayer, then 30 chants of 4 s.
      expect(timing.positionAfter(30), const Duration(seconds: 130));
      expect(timing.positionAfter(1), const Duration(seconds: 14));
      expect(timing.positionAfter(107), const Duration(seconds: 438));
    });

    test('all the chants, or more, is the end of the chanting', () {
      expect(timing.positionAfter(108), const Duration(seconds: 442));
      expect(timing.positionAfter(500), const Duration(seconds: 442));
      expect(trimmed.positionAfter(108), const Duration(seconds: 430));
    });

    test('a position it gives is counted as exactly that many chants', () {
      final thirds = ChantMalaTiming(
        start: Duration.zero,
        end: const Duration(seconds: 100),
        chants: 3,
      );
      final awkward = ChantMalaTiming(
        start: const Duration(milliseconds: 1234),
        end: const Duration(milliseconds: 99999),
        chants: 7,
      );
      for (final t in [timing, trimmed, thirds, awkward]) {
        for (var n = 0; n <= t.chants; n++) {
          expect(t.chantsDoneAt(t.positionAfter(n)), n, reason: '$n of ${t.chants} chants');
        }
      }
    });

    test('and it is the earliest such position: a microsecond sooner is a chant short', () {
      final thirds = ChantMalaTiming(
        start: Duration.zero,
        end: const Duration(seconds: 100),
        chants: 3,
      );
      for (final t in [timing, trimmed, thirds]) {
        for (var n = 1; n < t.chants; n++) {
          final before = t.positionAfter(n) - const Duration(microseconds: 1);
          expect(t.chantsDoneAt(before), n - 1, reason: '$n of ${t.chants} chants');
        }
      }
    });
  });

  group('ChantMalaFollower', () {
    ChantMalaFollower follower() => ChantMalaFollower(timing, continuousStep: step);

    test('playing the whole recording counts every chant once', () {
      final f = follower();
      expect(play(f, Duration.zero, const Duration(seconds: 442)), 108);
      expect(f.counted, 108);
    });

    test('a file that runs on past its chanting still counts 108 and no more', () {
      final f = ChantMalaFollower(trimmed, continuousStep: step);
      // The prayer at the front counts nothing, and neither do the last 8 s.
      expect(play(f, Duration.zero, const Duration(seconds: 5)), 0);
      expect(play(f, const Duration(seconds: 5), const Duration(seconds: 430)), 108);
      expect(play(f, const Duration(seconds: 430), const Duration(seconds: 438)), 0);
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
