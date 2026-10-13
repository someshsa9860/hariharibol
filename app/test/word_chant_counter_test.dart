import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/services/word_chant_counter.dart';

class _Clock {
  DateTime now = DateTime(2026);
  DateTime call() => now;
  void advance(int ms) => now = now.add(Duration(milliseconds: ms));
}

void main() {
  late _Clock clock;
  late WordChantCounter counter;

  setUp(() {
    clock = _Clock();
    counter = WordChantCounter(
      allowed: const ['hairy', 'Krishna', 'ram'],
      standard: const Duration(seconds: 2),
      now: clock.call,
    );
  });

  test('counts when an allowed word is heard, whatever its case', () {
    expect(counter.onTranscript('Hairy', isFinal: false), 1);
    expect(counter.total, 1);
  });

  test('words that are not allowed count for nothing', () {
    expect(counter.onTranscript('hello there', isFinal: false), 0);
  });

  test('never faster than the standard time, however many allowed words come', () {
    expect(counter.onTranscript('hairy krishna hairy krishna', isFinal: false), 1);
    clock.advance(1500);
    expect(counter.onTranscript('hairy krishna hairy krishna hairy ram', isFinal: false), 0);
    expect(counter.total, 1);
  });

  test('counts again once the standard time has passed', () {
    counter.onTranscript('hairy', isFinal: false);
    clock.advance(2000);
    expect(counter.onTranscript('hairy krishna', isFinal: false), 1);
    expect(counter.total, 2);
  });

  test('a word already looked at in a revised transcript is not counted twice', () {
    counter.onTranscript('hairy', isFinal: false);
    clock.advance(5000);
    expect(counter.onTranscript('hairy', isFinal: false), 0);
    expect(counter.onTranscript('hairy krishna', isFinal: false), 1);
  });

  test('a final transcript starts the next stretch afresh', () {
    counter.onTranscript('hairy', isFinal: true);
    clock.advance(2500);
    expect(counter.onTranscript('hairy', isFinal: false), 1);
  });

  test('a transcript that revises itself shorter is read from its new end', () {
    counter.onTranscript('hello hello hello', isFinal: false);
    clock.advance(2500);
    expect(counter.onTranscript('ram', isFinal: false), 1);
  });

  test('with no allowed words it has none to hear', () {
    expect(WordChantCounter(allowed: const [], standard: const Duration(seconds: 1)).hasWords, isFalse);
  });
}
