// Which alerts the routine asks for: one for each task with a time range that
// has not opened yet and is not done, over the next few days.

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/constants/push_config.dart';
import 'package:hariharibol/core/constants/routine_config.dart';
import 'package:hariharibol/models/routine_data.dart';
import 'package:hariharibol/models/routine_task.dart';
import 'package:hariharibol/services/routine_alert_plan.dart';

/// A Thursday morning, 09:00.
final now = DateTime(2026, 10, 15, 9);

String dayKey(int ahead) => routineDayKey(DateTime(now.year, now.month, now.day + ahead));

RoutineTask task(
  String id, {
  int ahead = 0,
  int? start = 18 * 60,
  int length = 60,
  bool done = false,
  String title = 'Evening chanting',
}) => RoutineTask(
  id: id,
  title: title,
  day: dayKey(ahead),
  window: start == null ? null : RoutineWindow(start: start, end: start + length),
  isDone: done,
  doneAt: done ? 500 : null,
);

DailyRoutineItem daily(String id, {int start = 6 * 60, String since = '2026-10-01', String until = ''}) =>
    DailyRoutineItem(
      id: id,
      title: 'Morning chanting',
      since: since,
      until: until,
      window: RoutineWindow(start: start, end: start + 60),
    );

List<RoutineAlert> plan(RoutineData data) => planRoutineAlerts(data, now);

void main() {
  group('which tasks get an alert', () {
    test('a task whose range opens later today gets one, at that minute', () {
      final alerts = plan(RoutineData(tasks: [task('t1')]));

      expect(alerts, hasLength(1));
      expect(alerts.single.taskId, 't1');
      expect(alerts.single.title, 'Evening chanting');
      expect(alerts.single.day, dayKey(0));
      expect(alerts.single.at, DateTime(2026, 10, 15, 18));
    });

    test('a range that opened already gets none, and neither does one opening this minute', () {
      final alerts = plan(RoutineData(tasks: [task('past', start: 8 * 60), task('now', start: 9 * 60)]));

      expect(alerts, isEmpty);
    });

    test('a task with no range has no moment to be alerted at', () {
      expect(plan(RoutineData(tasks: [task('t1', start: null)])), isEmpty);
    });

    test('a task that is done needs no alert', () {
      expect(plan(RoutineData(tasks: [task('t1', done: true)])), isEmpty);
    });

    test('a task for a day gone by gets none', () {
      expect(plan(RoutineData(tasks: [task('t1', ahead: -1)])), isEmpty);
    });

    test('a task for tomorrow gets one for tomorrow', () {
      final alerts = plan(RoutineData(tasks: [task('t1', ahead: 1, start: 7 * 60)]));

      expect(alerts.single.at, DateTime(2026, 10, 16, 7));
      expect(alerts.single.day, dayKey(1));
    });
  });

  group('the days ahead', () {
    test('the last day inside the horizon is planned and the next one is not', () {
      final inside = task('in', ahead: RoutineConfig.alertDays - 1);
      final outside = task('out', ahead: RoutineConfig.alertDays);

      final alerts = plan(RoutineData(tasks: [inside, outside]));

      expect([for (final each in alerts) each.taskId], ['in']);
    });

    test('a daily item gets one for each coming day it applies on, today not yet opened', () {
      // 06:00 has gone today, so today is left out.
      final alerts = plan(RoutineData(daily: [daily('d1')]));

      expect(alerts, hasLength(RoutineConfig.alertDays - 1));
      expect([for (final each in alerts) each.day], [for (var ahead = 1; ahead < RoutineConfig.alertDays; ahead++) dayKey(ahead)]);
    });

    test('a daily item that has not opened today is alerted today as well', () {
      final alerts = plan(RoutineData(daily: [daily('d1', start: 20 * 60)]));

      expect(alerts, hasLength(RoutineConfig.alertDays));
      expect(alerts.first.at, DateTime(2026, 10, 15, 20));
    });

    test('a daily item ticked for a day gets none for that day', () {
      final alerts = plan(
        RoutineData(
          daily: [daily('d1')],
          checks: {
            dayKey(2): {'d1': 400},
          },
        ),
      );

      expect(alerts.map((each) => each.day), isNot(contains(dayKey(2))));
      expect(alerts, hasLength(RoutineConfig.alertDays - 2));
    });

    test('a daily item that ended is not alerted after its last day, nor before it started', () {
      final ended = plan(RoutineData(daily: [daily('d1', until: dayKey(2))]));
      final notYet = plan(RoutineData(daily: [daily('d1', since: dayKey(5))]));

      expect(ended.map((each) => each.day), [dayKey(1), dayKey(2)]);
      expect(notYet.map((each) => each.day), [dayKey(5), dayKey(6)]);
    });
  });

  group('order and the cap', () {
    test('they come in time order, whatever order the tasks were added in', () {
      final alerts = plan(
        RoutineData(
          tasks: [
            task('late', start: 21 * 60),
            task('tomorrow', ahead: 1, start: 5 * 60),
            task('early', start: 10 * 60),
          ],
        ),
      );

      expect([for (final each in alerts) each.taskId], ['early', 'late', 'tomorrow']);
    });

    test('only the nearest are kept when there are too many', () {
      final near = [for (var index = 0; index < RoutineConfig.alertMaxPending; index++) task('near$index', ahead: 1)];
      final far = [for (var index = 0; index < 20; index++) task('far$index', ahead: 3)];

      final alerts = plan(RoutineData(tasks: [...far, ...near]));

      expect(alerts, hasLength(RoutineConfig.alertMaxPending));
      expect(alerts.every((each) => each.day == dayKey(1)), isTrue);
    });

    test('a smaller cap keeps the nearest that many (iOS holds fewer)', () {
      final tasks = [task('later', ahead: 2), task('soonest'), task('next', ahead: 1)];

      final alerts = planRoutineAlerts(RoutineData(tasks: tasks), now, max: 2);

      expect(alerts.map((each) => each.taskId), ['soonest', 'next']);
      expect(planRoutineAlerts(RoutineData(tasks: tasks), now, max: 1).single.taskId, 'soonest');
    });
  });

  group('an alert', () {
    RoutineAlert alert({String id = 't1', String day = '2026-10-15', String title = 'Evening chanting', int hour = 18}) =>
        RoutineAlert(taskId: id, day: day, title: title, at: DateTime(2026, 10, 15, hour));

    test('has the same id every time, so it can be found again after the app was closed', () {
      // Pinned: the base plus 32-bit FNV-1a of "day|taskId" (worked out apart from the app) modulo
      // the span. String.hashCode would change from one run to the next.
      expect(alert().id, 415435559);
      expect(alert(day: '2026-10-16').id, 120652548);
      expect(alert(id: 't2').id, 432213178);
    });

    test('has an id of its own for each task and each day, above the ones a push uses', () {
      final ids = {alert().id, alert(id: 't2').id, alert(day: '2026-10-16').id};

      expect(ids, hasLength(3));
      for (final id in ids) {
        expect(id, greaterThanOrEqualTo(RoutineConfig.alertIdBase));
        expect(id, lessThan(RoutineConfig.alertIdBase + RoutineConfig.alertIdSpan));
        expect(id, lessThan(1 << 31), reason: 'Android keeps a notification id in 32 bits');
      }
    });

    test('carries the task, the day and where a tap goes', () {
      final payload = jsonDecode(alert().payload) as Map<String, dynamic>;

      expect(payload, {
        RoutineConfig.alertTaskKey: 't1',
        RoutineConfig.alertDayKey: '2026-10-15',
        PushConfig.deeplinkKey: RoutineConfig.alertDeeplink,
      });
    });

    test('has a signature that changes with the time, the title and the task', () {
      final signatures = {
        alert().signature,
        alert(hour: 19).signature,
        alert(title: 'Japa').signature,
        alert(id: 't2').signature,
      };

      expect(signatures, hasLength(4));
      expect(alert().signature, alert().signature);
    });
  });
}
