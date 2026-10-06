import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/models/chant_log.dart';
import 'package:hariharibol/services/chant_recorder.dart';

/// A clock the test moves by hand, so a "gap" is exactly what the script says.
class _Clock {
  DateTime now = DateTime(2026, 10, 6, 6);

  void advance(int milliseconds) => now = now.add(Duration(milliseconds: milliseconds));
}

void main() {
  late _Clock clock;
  late ChantRecorder recorder;

  setUp(() {
    clock = _Clock();
    recorder = ChantRecorder(beadsPerRound: 4, now: () => clock.now);
  });

  void chant(int count, {int gapMs = 1000, bool first = true}) {
    for (var i = 0; i < count; i++) {
      if (!(first && i == 0)) clock.advance(gapMs);
      recorder.tap();
    }
  }

  test('the first tap has no gap, every later one measures from the one before', () {
    recorder.tap();
    clock.advance(1500);
    final second = recorder.tap();
    clock.advance(700);
    final third = recorder.tap();

    expect(recorder.taps.first.gapMs, 0);
    expect(second.gapMs, 1500);
    expect(third.gapMs, 700);
    expect([second.seq, third.seq], [2, 3]);
  });

  test('a round is the next beadsPerRound taps', () {
    chant(10);

    expect(recorder.completedMalas, 2);
    expect(recorder.currentMala, 3);
    expect(recorder.beadsInMala, 2);
    expect(recorder.malaOf(4), 1);
    expect(recorder.malaOf(5), 2);

    final malas = recorder.malas;
    expect(malas.map((m) => m.index), [1, 2, 3]);
    expect(malas.map((m) => m.complete), [true, true, false]);
    expect(malas.map((m) => m.beads), [4, 4, 2]);
  });

  test('a round starts at its first tap, ends at its last, and lasts the span between', () {
    chant(4, gapMs: 2000);

    final mala = recorder.malas.single;
    expect(mala.startedAt, DateTime(2026, 10, 6, 6));
    expect(mala.endedAt, DateTime(2026, 10, 6, 6, 0, 6));
    expect(mala.durationMs, 6000);
    expect(mala.avgGapMs, 2000);
  });

  test('averages read off every tap but the first', () {
    chant(8, gapMs: 2000);
    clock.advance(3000);
    recorder.tap(); // first tap of round 3, 3s after the last of round 2

    final stats = recorder.stats;
    expect(stats.totalChants, 9);
    expect(stats.malasDone, 2);
    expect(stats.avgMalaSeconds, 6);
    expect(stats.fastestMalaSeconds, 6);
    // 7 gaps of 2s and one of 3s, over the 8 gaps after the first tap.
    expect(stats.avgChantSeconds, closeTo((7 * 2 + 3) / 8, 0.0001));
  });

  test('nothing is averaged until there is something to average', () {
    expect(recorder.stats.avgChantSeconds, isNull);
    expect(recorder.stats.avgMalaSeconds, isNull);

    recorder.tap();
    expect(recorder.stats.avgChantSeconds, isNull);
    expect(recorder.currentMalaElapsed, Duration.zero);

    clock.advance(2000);
    recorder.tap();
    expect(recorder.stats.avgChantSeconds, 2);
    expect(recorder.stats.avgMalaSeconds, isNull);
  });

  test('the current round is timed from its first tap until now', () {
    chant(2, gapMs: 1000);
    clock.advance(4000);

    expect(recorder.currentMalaElapsed, const Duration(seconds: 5));

    chant(2, gapMs: 1000, first: false);
    // The round just finished, so there is no round in progress to time.
    expect(recorder.currentMalaElapsed, Duration.zero);
  });

  test('undo takes back the last tap but never reopens a finished round', () {
    chant(5);
    expect(recorder.undo(), isTrue);
    expect(recorder.tapCount, 4);

    expect(recorder.beadsInMala, 0);
    expect(recorder.undo(), isFalse);
    expect(recorder.tapCount, 4);
  });

  test('the next tap after an undo reuses the sequence number', () {
    chant(2);
    recorder.undo();
    clock.advance(500);
    expect(recorder.tap().seq, 2);
  });

  group('what has to be sent', () {
    test('only rounds that changed are handed over, and once', () {
      chant(5);

      final first = recorder.takeDirtyMalas();
      expect(first.map((m) => m.index), [1, 2]);
      expect(recorder.takeDirtyMalas(), isEmpty);

      clock.advance(1000);
      recorder.tap();
      expect(recorder.takeDirtyMalas().map((m) => m.index), [2]);
    });

    test('a failed send is put back and goes out again', () {
      chant(2);
      final taken = recorder.takeDirtyMalas();

      recorder.restoreUnsent(malas: taken);

      expect(recorder.takeDirtyMalas().map((m) => m.index), [1]);
    });

    test('undo marks its round to be sent again', () {
      chant(3);
      recorder.takeDirtyMalas();

      recorder.undo();

      final dirty = recorder.takeDirtyMalas();
      expect(dirty.single.beads, 2);
    });

    test('words attach to their tap and wait to be sent', () {
      chant(2);
      final heard = ChantHeard(
        seq: 2,
        malaIndex: 1,
        text: 'hare krishna',
        heardAt: clock.now,
      );

      recorder.attachHeard(heard);

      expect(recorder.taps[1].heard, 'hare krishna');
      expect(recorder.taps[0].heard, isNull);
      expect(recorder.takeUnsentHeard().single.seq, 2);
      expect(recorder.takeUnsentHeard(), isEmpty);
    });

    test('words for a tap that was undone are dropped', () {
      chant(2);
      recorder.attachHeard(
        ChantHeard(seq: 2, malaIndex: 1, text: 'hare', heardAt: clock.now),
      );

      recorder.undo();

      expect(recorder.takeUnsentHeard(), isEmpty);
    });

    test('a newer attachment survives a failed send being put back', () {
      chant(1);
      recorder.attachHeard(ChantHeard(seq: 1, malaIndex: 1, text: 'old', heardAt: clock.now));
      final taken = recorder.takeUnsentHeard();
      recorder.attachHeard(ChantHeard(seq: 1, malaIndex: 1, text: 'new', heardAt: clock.now));

      recorder.restoreUnsent(heard: taken);

      expect(recorder.takeUnsentHeard().single.text, 'new');
    });
  });

  test('a round survives the trip to the server and back', () {
    chant(4, gapMs: 1200);
    final mala = recorder.malas.single;

    final back = ChantMalaLog.fromJson(mala.toJson());

    expect(back.index, mala.index);
    expect(back.complete, isTrue);
    expect(back.durationMs, mala.durationMs);
    expect(back.taps.map((t) => t.gapMs), mala.taps.map((t) => t.gapMs));
  });
}
