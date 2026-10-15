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

  test('a round goes to the server as a summary, and comes back with the same figures', () {
    chant(4, gapMs: 1200);
    final mala = recorder.malas.single;

    final sent = mala.toJson();
    expect(sent.containsKey('taps'), isFalse, reason: 'taps are kept on the phone, not stored');

    final back = ChantMalaLog.fromJson(sent);

    expect(back.index, mala.index);
    expect(back.complete, isTrue);
    expect(back.beads, 4);
    expect(back.durationMs, mala.durationMs);
    expect(back.avgGapMs, mala.avgGapMs);
    expect(back.taps, isEmpty);
  });

  test('a tap is allowed once the gap has passed since the last, and the first is always allowed', () {
    const gap = Duration(seconds: 2);
    expect(recorder.tapAllowed(gap), isTrue);

    recorder.tap();
    clock.advance(1999);
    expect(recorder.tapAllowed(gap), isFalse);
    clock.advance(1);
    expect(recorder.tapAllowed(gap), isTrue);
  });

  test('a tap that is taken back makes room for the next one', () {
    const gap = Duration(seconds: 2);
    recorder.tap();
    clock.advance(5000);
    recorder.tap();
    expect(recorder.tapAllowed(gap), isFalse);

    expect(recorder.undo(), isTrue);
    expect(recorder.tapAllowed(gap), isTrue);
  });

  group('picking up a round where it was left', () {
    test('carried beads count as the start of the round, with no taps behind them', () {
      recorder.carry(2);

      expect(recorder.beadsInMala, 2);
      expect(recorder.completedMalas, 0);
      expect(recorder.currentMala, 1);
      expect(recorder.taps, isEmpty);
    });

    test('the round finishes after the beads that were left, not a whole new round', () {
      recorder.carry(2);
      chant(2);

      expect(recorder.completedMalas, 1);
      expect(recorder.beadsInMala, 0);
      expect(recorder.currentMala, 2);

      final mala = recorder.malas.first;
      expect(mala.complete, isTrue);
      expect(mala.beads, 4);
      expect(mala.durationMs, 0, reason: 'the start of it was never timed');
    });

    test('a round that was carried is left out of the timings, one that was not is kept', () {
      recorder.carry(2);
      chant(2, gapMs: 900);
      chant(4, gapMs: 1500, first: false);

      final stats = ChantStats.of(recorder.malas);
      final timed = recorder.malas.last.durationMs / 1000;
      expect(stats.fastestMalaSeconds, timed);
      expect(stats.avgMalaSeconds, timed);
    });

    test('carrying more than a round holds at one short of it', () {
      recorder.carry(40);

      expect(recorder.beadsInMala, 3);
      expect(recorder.completedMalas, 0);
    });

    test('taking a bead back works on carried beads too', () {
      recorder.carry(2);

      expect(recorder.undo(), isTrue);
      expect(recorder.beadsInMala, 1);
      expect(recorder.undo(), isTrue);
      expect(recorder.beadsInMala, 0);
      expect(recorder.undo(), isFalse);
    });

    test('a round with no tap of its own is not sent', () {
      recorder.carry(2);

      expect(recorder.takeDirtyMalas(), isEmpty);
    });

    test('the first chant after beginning is timed from then, so a prayer is not counted in it', () {
      recorder.beginChanting();
      clock.advance(4000);

      expect(recorder.tapAllowed(const Duration(seconds: 5)), isFalse);
      clock.advance(1000);
      expect(recorder.tapAllowed(const Duration(seconds: 5)), isTrue);
      expect(recorder.tap().gapMs, 5000);
    });
  });

  group('rounds that come back from the server', () {
    test('their figures are the ones stored, not worked out from taps', () {
      final stored = ChantMalaLog.stored(
        index: 1,
        beads: 108,
        complete: true,
        startedAt: DateTime(2026, 10, 6, 6),
        endedAt: DateTime(2026, 10, 6, 6, 10),
        durationMs: 600000,
        avgGapMs: 5000,
      );

      expect(stored.beads, 108);
      expect(stored.durationMs, 600000);
      expect(stored.avgGapMs, 5000);
      expect(stored.taps, isEmpty);
    });

    test('a round with no known duration is not the fastest or the average', () {
      final unknown = ChantMalaLog.stored(
        index: 1,
        beads: 108,
        complete: true,
        startedAt: DateTime(2026, 10, 6, 6),
        endedAt: DateTime(2026, 10, 6, 6, 1),
      );
      final timed = ChantMalaLog.stored(
        index: 2,
        beads: 108,
        complete: true,
        startedAt: DateTime(2026, 10, 6, 7),
        endedAt: DateTime(2026, 10, 6, 7, 10),
        durationMs: 600000,
        avgGapMs: 5000,
      );

      final stats = ChantStats.of([unknown, timed]);
      expect(stats.fastestMalaSeconds, 600);
      expect(stats.avgMalaSeconds, 600);
    });
  });
}
