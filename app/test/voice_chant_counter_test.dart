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
    counter = VoiceChantCounter(standard: const Duration(seconds: 1), now: clock.call);
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
      standard: const Duration(seconds: 1),
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
}
