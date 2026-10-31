// The daily routine worked out from the rounds someone chants, and the one limit
// it keeps: nobody goes to bed before noon.

import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/constants/routine_plan_config.dart';
import 'package:hariharibol/core/constants/routine_presets.dart';
import 'package:hariharibol/models/routine_task.dart';
import 'package:hariharibol/services/routine_planner.dart';

const _mahamantraMs = 4000;
const _shivaMs = 1500;

int _at(int hour, [int minute = 0]) => hour * 60 + minute;

RoutineWindow _of(RoutinePlan plan, RoutinePreset preset) =>
    plan.items.firstWhere((item) => item.preset == preset).window;

void main() {
  group('how long the rounds take', () {
    test('108 chants a round, over the mantra\'s own time, and the pauses between', () {
      // 16 x 108 x 4 s = 115.2 min, and a round takes half as long again.
      expect(RoutinePlanner.chantMinutesFor(rounds: 16, chantMs: _mahamantraMs), 173);
      expect(RoutinePlanner.chantMinutesFor(rounds: 4, chantMs: _mahamantraMs), 44);
    });

    test('is never shorter than the least the morning shows', () {
      expect(
        RoutinePlanner.chantMinutesFor(rounds: 1, chantMs: _shivaMs),
        RoutinePlanConfig.minChantWindowMinutes,
      );
    });

    test('a mantra with no time of its own takes the standard one', () {
      expect(
        RoutinePlanner.chantMinutesFor(rounds: 16, chantMs: 0),
        RoutinePlanner.chantMinutesFor(rounds: 16, chantMs: RoutinePlanConfig.fallbackChantMs),
      );
    });
  });

  group('when to wake', () {
    test('more rounds mean an earlier wake-up', () {
      var previous = _at(23, 59);
      var fell = false;
      for (final rounds in [1, 4, 8, 16, 24, 32, 64]) {
        final wake = RoutinePlanner.suggestWake(rounds: rounds, chantMs: _mahamantraMs);
        expect(wake, lessThanOrEqualTo(previous), reason: '$rounds rounds');
        fell = fell || wake < previous;
        previous = wake;
      }
      expect(fell, isTrue);
    });

    test('16 rounds of the Hare Krishna mantra: up at 4:00, the earliest suggested', () {
      // 3:15 by the sum, raised to 4:00.
      expect(RoutinePlanner.suggestWake(rounds: 16, chantMs: _mahamantraMs), _at(4));
    });

    test('a few rounds wake at 5:45, the earliest the shortest morning allows', () {
      expect(RoutinePlanner.suggestWake(rounds: 1, chantMs: _mahamantraMs), _at(5, 45));
      expect(RoutinePlanner.suggestWake(rounds: 4, chantMs: _shivaMs), _at(5, 45));
    });

    test('a great many rounds are not suggested before 4 AM', () {
      expect(RoutinePlanner.suggestWake(rounds: 64, chantMs: _mahamantraMs), _at(4));
      expect(RoutinePlanner.suggestWake(rounds: 200, chantMs: 12000), _at(4));
    });

    test('is a quarter hour mark, between 4 AM and 5:45 AM, for every rounds count', () {
      for (final chantMs in [0, 1500, 4000, 12000]) {
        for (var rounds = RoutinePlanConfig.minRounds; rounds <= RoutinePlanConfig.maxRounds; rounds++) {
          final wake = RoutinePlanner.suggestWake(rounds: rounds, chantMs: chantMs);
          expect(wake % 15, 0);
          expect(wake, inInclusiveRange(_at(4), _at(5, 45)), reason: '$rounds x $chantMs');
        }
      }
    });
  });

  group('the limit', () {
    test('a bedtime is never before noon', () {
      expect(RoutinePlanner.isBedtimeAllowed(_at(12)), isTrue);
      expect(RoutinePlanner.isBedtimeAllowed(_at(11, 59)), isFalse);
      expect(RoutinePlanner.isBedtimeAllowed(_at(8)), isFalse);
      expect(RoutinePlanner.isBedtimeAllowed(_at(0, 30)), isFalse);
    });

    test('a bedtime after 10:30 PM is allowed, up to the last minute of the day', () {
      expect(RoutinePlanner.isBedtimeAllowed(_at(21)), isTrue);
      expect(RoutinePlanner.isBedtimeAllowed(_at(23, 30)), isTrue);
      expect(RoutinePlanner.isBedtimeAllowed(_at(23, 59)), isTrue);
    });

    test('a bedtime before noon is pulled to noon', () {
      final plan = RoutinePlanner.plan(
        rounds: 16,
        chantMs: _mahamantraMs,
        wake: _at(6),
        bedtime: _at(8),
      );

      expect(plan.wake, _at(6));
      expect(plan.bedtime, _at(12));
    });

    test('a wake-up after 4 AM is kept, and the bedtime follows it', () {
      final plan = RoutinePlanner.plan(rounds: 16, chantMs: _mahamantraMs, wake: _at(6));

      expect(plan.wake, _at(6));
      expect(plan.bedtime, _at(23, 45));
    });
  });

  group('the bedtime', () {
    test('follows the wake-up, leaving six hours', () {
      expect(RoutinePlanner.suggestBedtime(_at(4)), _at(22));
      expect(RoutinePlanner.suggestBedtime(_at(3, 15)), _at(21, 15));
      expect(RoutinePlanner.suggestBedtime(_at(1)), _at(19));
    });

    test('a wake-up after 6 AM leaves the bedtime at 11:45 PM, not past midnight', () {
      expect(RoutinePlanner.suggestBedtime(_at(6)), _at(23, 45));
      expect(RoutinePlanner.suggestBedtime(_at(9)), _at(23, 45));
    });

    test('is between 6 PM and 11:45 PM for a wake-up at any time of the day', () {
      for (var wake = 0; wake < Duration.minutesPerDay; wake += 15) {
        expect(
          RoutinePlanner.suggestBedtime(wake),
          inInclusiveRange(_at(18), _at(23, 45)),
          reason: 'wake at $wake',
        );
      }
    });
  });

  group('the day', () {
    test('from waking to sleep, in order', () {
      final plan = RoutinePlanner.plan(rounds: 16, chantMs: _mahamantraMs);

      expect([for (final item in plan.items) item.preset], [
        RoutinePreset.wakeUp,
        RoutinePreset.morningChant,
        RoutinePreset.breakfast,
        RoutinePreset.lunch,
        RoutinePreset.eveningChant,
        RoutinePreset.dinner,
        RoutinePreset.scriptureReading,
        RoutinePreset.sleep,
      ]);
      expect(plan.items.first.preset, RoutinePreset.wakeUp);
      expect(plan.items.last.preset, RoutinePreset.sleep);
    });

    test('wakes at the suggested time and chants once ready', () {
      // 4 rounds: up at 5:30, 45 minutes to get ready, then the 44 they take.
      final plan = RoutinePlanner.plan(rounds: 4, chantMs: _mahamantraMs);

      expect(plan.wake, _at(5, 30));
      expect(_of(plan, RoutinePreset.wakeUp), RoutineWindow(start: _at(5, 30), end: _at(6)));
      expect(
        _of(plan, RoutinePreset.morningChant),
        RoutineWindow(start: _at(6, 15), end: _at(6, 59)),
      );
      expect(plan.fitsMorning, isTrue);
    });

    test('16 rounds run past the morning from the 4 AM wake-up: they end at 7:38', () {
      final plan = RoutinePlanner.plan(rounds: 16, chantMs: _mahamantraMs);

      // 4:45 to get going, then the 173 the rounds take.
      expect(plan.wake, _at(4));
      expect(plan.fitsMorning, isFalse);
      expect(_of(plan, RoutinePreset.morningChant).end, _at(4, 45) + 173);
    });

    test('every row is a range the routine accepts, with no wrap past midnight', () {
      for (final rounds in [1, 4, 16, 32, 64, 200]) {
        for (final chantMs in [1500, 4000, 12000]) {
          final plan = RoutinePlanner.plan(rounds: rounds, chantMs: chantMs);
          for (final item in plan.items) {
            expect(
              RoutineWindow.isValid(item.window.start, item.window.end),
              isTrue,
              reason: '${item.preset} at $rounds x $chantMs',
            );
          }
        }
      }
    });

    test('keeps a wake-up from 4 AM to 5:45 AM and a bedtime after noon, for every rounds count', () {
      for (var rounds = RoutinePlanConfig.minRounds; rounds <= RoutinePlanConfig.maxRounds; rounds++) {
        final plan = RoutinePlanner.plan(rounds: rounds, chantMs: _mahamantraMs);
        expect(
          _of(plan, RoutinePreset.wakeUp).start,
          inInclusiveRange(_at(4), _at(5, 45)),
          reason: '$rounds',
        );
        expect(
          _of(plan, RoutinePreset.sleep).start,
          inInclusiveRange(_at(12), _at(23, 45)),
          reason: '$rounds',
        );
      }
    });

    test('a wake-up chosen later than suggested says the rounds no longer fit', () {
      final plan = RoutinePlanner.plan(rounds: 16, chantMs: _mahamantraMs, wake: _at(5));

      // 5:00 + 45 + 173 = 8:38.
      expect(plan.fitsMorning, isFalse);
      expect(_of(plan, RoutinePreset.morningChant).end, _at(5) + 45 + 173);
    });

    test('breakfast waits for the rounds to end', () {
      final few = RoutinePlanner.plan(rounds: 4, chantMs: _mahamantraMs);
      expect(_of(few, RoutinePreset.breakfast), RoutinePreset.breakfast.window);

      final late = RoutinePlanner.plan(rounds: 16, chantMs: _mahamantraMs, wake: _at(4));
      expect(
        _of(late, RoutinePreset.breakfast).start,
        greaterThanOrEqualTo(_of(late, RoutinePreset.morningChant).end + 15),
      );
    });

    test('rounds that run on into the day are cut off at the morning\'s end and breakfast goes', () {
      final plan = RoutinePlanner.plan(rounds: 200, chantMs: 12000);

      expect(plan.fitsMorning, isFalse);
      expect(_of(plan, RoutinePreset.morningChant).end, RoutinePlanConfig.latestChantEndMinute);
      expect(plan.items.any((item) => item.preset == RoutinePreset.breakfast), isFalse);
    });

    test('a bedtime moved earlier brings the evening with it', () {
      final usual = RoutinePlanner.plan(rounds: 16, chantMs: _mahamantraMs, bedtime: _at(22));
      final early = RoutinePlanner.plan(rounds: 16, chantMs: _mahamantraMs, bedtime: _at(20));

      expect(_of(usual, RoutinePreset.dinner), RoutinePreset.dinner.window);
      expect(
        _of(early, RoutinePreset.dinner).start,
        _of(usual, RoutinePreset.dinner).start - 120,
      );
      expect(_of(early, RoutinePreset.sleep).start, _at(20));
    });

    test('is the same for the same inputs', () {
      final a = RoutinePlanner.plan(rounds: 16, chantMs: _mahamantraMs, wake: _at(3), bedtime: _at(21));
      final b = RoutinePlanner.plan(rounds: 16, chantMs: _mahamantraMs, wake: _at(3), bedtime: _at(21));

      expect(a.wake, b.wake);
      expect(
        [for (final item in a.items) item.window],
        [for (final item in b.items) item.window],
      );
    });
  });
}
