// The repetition state machine, exercised as a scripted sequence of detector
// events against a fake clock — no audio, no models, no isolate. This is the
// one piece of auto-count that decides what counts as a repetition, so it is
// the one piece that has to be provably right on its own.

import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/services/mantra_repetition_counter.dart';

/// A clock the test moves by hand, so cooldown timing is asserted exactly
/// rather than raced against real `Future.delayed` waits.
class _FakeClock {
  DateTime _now = DateTime(2026);

  DateTime call() => _now;

  void advance(Duration by) => _now = _now.add(by);
}

void main() {
  group('MantraRepetitionCounter — single-detection mantras', () {
    late _FakeClock clock;
    late MantraRepetitionCounter counter;

    setUp(() {
      clock = _FakeClock();
      counter = MantraRepetitionCounter(cooldown: const Duration(milliseconds: 500), now: clock.call);
    });

    test('starts idle with nothing counted', () {
      expect(counter.phase, AutoChantPhase.idle);
      expect(counter.count, 0);
    });

    test('a keyword firing with no voice reported is ignored', () {
      final counted = counter.onKeywordDetected();
      expect(counted, isFalse);
      expect(counter.count, 0);
    });

    test('voice on, then one firing, counts exactly one repetition', () {
      counter.onVoiceActive(true);
      expect(counter.phase, AutoChantPhase.listening);

      final counted = counter.onKeywordDetected();

      expect(counted, isTrue);
      expect(counter.count, 1);
      expect(counter.phase, AutoChantPhase.cooldown);
    });

    test('a second firing inside the cooldown window is debounced, not counted', () {
      counter.onVoiceActive(true);
      counter.onKeywordDetected();

      clock.advance(const Duration(milliseconds: 100));
      final countedAgain = counter.onKeywordDetected();

      expect(countedAgain, isFalse);
      expect(counter.count, 1);
    });

    test('a firing after the cooldown elapses counts as the next repetition', () {
      counter.onVoiceActive(true);
      counter.onKeywordDetected();

      clock.advance(const Duration(milliseconds: 501));
      final countedAgain = counter.onKeywordDetected();

      expect(countedAgain, isTrue);
      expect(counter.count, 2);
    });

    test('phase returns to listening once the cooldown has passed', () {
      counter.onVoiceActive(true);
      counter.onKeywordDetected();
      expect(counter.phase, AutoChantPhase.cooldown);

      clock.advance(const Duration(milliseconds: 501));
      expect(counter.phase, AutoChantPhase.listening);
    });

    test('voice dropping to silence reads as idle regardless of cooldown', () {
      counter.onVoiceActive(true);
      counter.onKeywordDetected();

      counter.onVoiceActive(false);

      expect(counter.phase, AutoChantPhase.idle);
    });

    test('reset clears the count and returns to idle', () {
      counter.onVoiceActive(true);
      counter.onKeywordDetected();

      counter.reset();

      expect(counter.count, 0);
      expect(counter.phase, AutoChantPhase.idle);
    });
  });

  group('MantraRepetitionCounter — paired detections (e.g. the mahamantra\'s "Hare Hare")', () {
    late _FakeClock clock;
    late MantraRepetitionCounter counter;

    setUp(() {
      clock = _FakeClock();
      counter = MantraRepetitionCounter(
        cooldown: const Duration(milliseconds: 200),
        detectionsPerRepetition: 2,
        now: clock.call,
      );
      counter.onVoiceActive(true);
    });

    test('one firing alone is not enough to count a repetition', () {
      final counted = counter.onKeywordDetected();
      expect(counted, isFalse);
      expect(counter.count, 0);
    });

    test('two firings in a row count exactly one repetition', () {
      counter.onKeywordDetected();
      clock.advance(const Duration(milliseconds: 10));
      final counted = counter.onKeywordDetected();

      expect(counted, isTrue);
      expect(counter.count, 1);
    });

    test('a dropout mid-phrase discards the pending firing instead of carrying it over', () {
      counter.onKeywordDetected(); // first "Hare Hare" of the round
      counter.onVoiceActive(false); // the chant is abandoned or the mic cuts out
      counter.onVoiceActive(true); // a new attempt begins

      final counted = counter.onKeywordDetected();

      expect(counted, isFalse, reason: 'this is only the first firing of the new attempt');
      expect(counter.count, 0);
    });

    test('three firings without a gap count one repetition, with one pending', () {
      counter.onKeywordDetected();
      clock.advance(const Duration(milliseconds: 10));
      counter.onKeywordDetected();
      clock.advance(const Duration(milliseconds: 201)); // past cooldown
      final counted = counter.onKeywordDetected();

      expect(counted, isFalse);
      expect(counter.count, 1);
    });
  });
}
