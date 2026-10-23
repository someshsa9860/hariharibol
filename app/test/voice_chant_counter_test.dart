// The whole counting rule of auto count, driven by a scripted voice and a fake
// clock — no audio, no model.

import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/services/mantra_repetition_counter.dart' show AutoChantPhase;
import 'package:hariharibol/services/voice_chant_counter.dart';

class _Clock {
  DateTime now = DateTime(2026);
  DateTime call() => now;
  void advance(int ms) => now = now.add(Duration(milliseconds: ms));
}

void main() {
  late _Clock clock;
  late VoiceChantCounter counter;

  setUp(() {
    clock = _Clock();
    counter = VoiceChantCounter(pace: const Duration(seconds: 1), now: clock.call);
  });

  test('counts one chant for each standard time of sound', () {
    counter.onVoice(true);
    clock.advance(900);
    expect(counter.tick(), 0);
    clock.advance(200);
    expect(counter.tick(), 1);
    clock.advance(1000);
    expect(counter.tick(), 1);
    expect(counter.total, 2);
  });

  test('counts nothing while there is no sound, and picks up again when it returns', () {
    counter.onVoice(true);
    clock.advance(1000);
    expect(counter.tick(), 1);
    counter.onVoice(false);

    clock.advance(10000);
    expect(counter.tick(), 0);

    counter.onVoice(true);
    clock.advance(1000);
    expect(counter.tick(), 1);
    expect(counter.total, 2);
  });

  test('a chant said once and stopped still counts when it was mostly said', () {
    counter.onVoice(true);
    clock.advance(700);
    expect(counter.onVoice(false), 1);
  });

  test('a short sound that is not a chant counts for nothing', () {
    counter.onVoice(true);
    clock.advance(300);
    expect(counter.onVoice(false), 0);
    expect(counter.total, 0);
  });

  test('a chant already counted while the sound went on is not counted again at its end', () {
    counter.onVoice(true);
    clock.advance(1050);
    expect(counter.tick(), 1);
    expect(counter.onVoice(false), 0);
  });

  test('the detector\'s delay at each end is not counted as chanting', () {
    counter = VoiceChantCounter(
      pace: const Duration(seconds: 1),
      lead: const Duration(milliseconds: 250),
      tail: const Duration(milliseconds: 500),
      now: clock.call,
    );
    counter.onVoice(true);
    // 250 ms before it was reported + 1000 of chanting + 500 of reported silence.
    clock.advance(1500);
    expect(counter.tick(), 1);
    expect(counter.onVoice(false), 0);
    expect(counter.total, 1);
  });

  test('a late tick catches up on every chant that came due', () {
    counter.onVoice(true);
    clock.advance(3500);
    expect(counter.tick(), 3);
  });

  test('the phase follows the sound, and reads counted for a moment after a chant', () {
    expect(counter.phase, AutoChantPhase.idle);
    counter.onVoice(true);
    expect(counter.phase, AutoChantPhase.listening);
    clock.advance(1000);
    counter.tick();
    expect(counter.phase, AutoChantPhase.cooldown);
    clock.advance(1000);
    expect(counter.phase, AutoChantPhase.listening);
    counter.onVoice(false);
    expect(counter.phase, AutoChantPhase.idle);
  });

  group('the pace is the reader\'s, and can change while counting', () {
    test('a pace of its own is counted by, not the standard time', () {
      counter = VoiceChantCounter(pace: const Duration(milliseconds: 1500), now: clock.call);
      counter.onVoice(true);
      clock.advance(1499);
      expect(counter.tick(), 0);
      clock.advance(1);
      expect(counter.tick(), 1);
      clock.advance(1500);
      expect(counter.tick(), 1);
    });

    test('a chant is never quicker than the pace, however long the sitting', () {
      counter.onVoice(true);
      var counted = 0;
      for (var i = 0; i < 120; i++) {
        clock.advance(500);
        counted += counter.tick();
      }
      // 60 s of sound at one chant a second: no speeding up on its own.
      expect(counted, 60);
    });

    test('a slower pace set mid-count keeps what was chanted, and does not stall it', () {
      counter.onVoice(true);
      clock.advance(1400); // one chant counted, 400 ms towards the next
      expect(counter.tick(), 1);
      expect(counter.changePace(const Duration(milliseconds: 2000)), 0);
      expect(counter.pace, const Duration(milliseconds: 2000));
      clock.advance(1599);
      expect(counter.tick(), 0);
      clock.advance(1);
      expect(counter.tick(), 1); // 400 kept + 1600 more = one 2000 ms chant
    });

    test('a quicker pace set mid-count does not make a chant jump out', () {
      counter.onVoice(true);
      clock.advance(900); // 900 of 1000 ms towards the first chant
      expect(counter.changePace(const Duration(milliseconds: 500)), 0);
      // 900 ms kept against a 500 ms pace is already one chant and 400 over; it is
      // counted on the next tick, not twice.
      expect(counter.tick(), 1);
      expect(counter.tick(), 0);
      clock.advance(100);
      expect(counter.tick(), 1);
      expect(counter.total, 2);
    });

    test('the chants an old pace had made due are counted when the pace changes', () {
      counter.onVoice(true);
      clock.advance(2100);
      expect(counter.changePace(const Duration(seconds: 3)), 2);
      expect(counter.total, 2);
    });

    test('the pace is kept through a silence and through a reset', () {
      counter.onVoice(true);
      counter.changePace(const Duration(milliseconds: 800));
      counter.onVoice(false);
      counter.reset();
      expect(counter.pace, const Duration(milliseconds: 800));
      expect(counter.total, 0);

      counter.onVoice(true);
      clock.advance(799);
      expect(counter.tick(), 0);
      clock.advance(1);
      expect(counter.tick(), 1);
    });

    test('a last, unfinished chant is judged against the pace in force', () {
      counter.changePace(const Duration(seconds: 2));
      counter.onVoice(true);
      clock.advance(1100); // 55% of 2 s: not enough
      expect(counter.onVoice(false), 0);
      counter.onVoice(true);
      clock.advance(1300); // 65%: counts
      expect(counter.onVoice(false), 1);
    });
  });

  group('counting by the clock alone', () {
    test('one chant every pace from the moment it starts, with no sound at all', () {
      counter.startSteady();
      expect(counter.phase, AutoChantPhase.listening);
      clock.advance(999);
      expect(counter.tick(), 0);
      clock.advance(1);
      expect(counter.tick(), 1);
      clock.advance(5000);
      expect(counter.tick(), 5);
      expect(counter.total, 6);
    });

    test('it does not wait for a lead the way the detector does', () {
      counter = VoiceChantCounter(
        pace: const Duration(seconds: 1),
        lead: const Duration(milliseconds: 250),
        now: clock.call,
      );
      counter.startSteady();
      clock.advance(1000);
      expect(counter.tick(), 1);
    });

    test('starting twice does not restart the clock', () {
      counter.startSteady();
      clock.advance(600);
      counter.startSteady();
      clock.advance(400);
      expect(counter.tick(), 1);
    });

    test('a change of pace keeps the time already chanted towards the next chant', () {
      counter.startSteady();
      clock.advance(600);
      counter.changePace(const Duration(seconds: 2));
      clock.advance(1399);
      expect(counter.tick(), 0);
      clock.advance(1);
      expect(counter.tick(), 1);
    });

    test('reset stops it', () {
      counter.startSteady();
      counter.reset();
      clock.advance(5000);
      expect(counter.tick(), 0);
      expect(counter.phase, AutoChantPhase.idle);
    });
  });
}
