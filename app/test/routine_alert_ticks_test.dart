// Where a press of an alert's "Mark as done" waits for the app, and the entry
// point the plugin runs when the button is pressed with the app closed.

import 'dart:async';
import 'dart:convert';

import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/constants/routine_config.dart';
import 'package:hariharibol/services/routine_alert_ticks.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

const day = '2026-10-15';

String payload({String task = 't1', String taskDay = day}) =>
    jsonEncode({RoutineConfig.alertTaskKey: task, RoutineConfig.alertDayKey: taskDay});

NotificationResponse pressed({String? actionId = RoutineConfig.alertDoneActionId, String? body}) =>
    NotificationResponse(
      notificationResponseType: NotificationResponseType.selectedNotificationAction,
      actionId: actionId,
      payload: body ?? payload(),
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() => SharedPreferencesAsyncPlatform.instance = InMemorySharedPreferencesAsync.empty());

  group('RoutineAlertTick.minute', () {
    RoutineAlertTick at(DateTime moment) => RoutineAlertTick(taskId: 't1', day: day, at: moment);

    test('is the time of the press, on the task\'s own day', () {
      expect(at(DateTime(2026, 10, 15, 18, 5)).minute, 18 * 60 + 5);
      expect(at(DateTime(2026, 10, 15)).minute, 0);
    });

    test('is the end of that day for a press made after midnight', () {
      expect(at(DateTime(2026, 10, 16, 0, 10)).minute, RoutineConfig.minutesPerDay - 1);
    });
  });

  group('RoutineAlertTicks', () {
    test('gives back what was recorded, oldest first, and then nothing', () async {
      await RoutineAlertTicks.record(taskId: 'b', day: day, at: DateTime(2026, 10, 15, 19));
      await RoutineAlertTicks.record(taskId: 'a', day: day, at: DateTime(2026, 10, 15, 18));

      final taken = await RoutineAlertTicks.take();

      expect([for (final each in taken) each.taskId], ['a', 'b']);
      expect(taken.first.day, day);
      expect(taken.first.at, DateTime(2026, 10, 15, 18));
      expect(await RoutineAlertTicks.take(), isEmpty);
    });

    test('keeps a task id with dots in it whole', () async {
      await RoutineAlertTicks.record(taskId: 'local.1.2', day: day, at: DateTime(2026, 10, 15, 18));

      final taken = await RoutineAlertTicks.take();

      expect(taken.single.taskId, 'local.1.2');
      expect(taken.single.day, day);
    });

    test('a task pressed twice before the app looked is one press, the later one', () async {
      await RoutineAlertTicks.record(taskId: 'a', day: day, at: DateTime(2026, 10, 15, 18));
      await RoutineAlertTicks.record(taskId: 'a', day: day, at: DateTime(2026, 10, 15, 18, 30));

      final taken = await RoutineAlertTicks.take();

      expect(taken, hasLength(1));
      expect(taken.single.at, DateTime(2026, 10, 15, 18, 30));
    });

    test('leaves every other setting alone', () async {
      final preferences = SharedPreferencesAsync();
      await preferences.setString('theme', 'dark');
      await RoutineAlertTicks.record(taskId: 'a', day: day, at: DateTime(2026, 10, 15, 18));

      await RoutineAlertTicks.take();

      expect(await preferences.getString('theme'), 'dark');
    });

    test('drops, without failing, an entry it cannot read', () async {
      final preferences = SharedPreferencesAsync();
      await preferences.setInt('${RoutineConfig.alertTickPrefix}nonsense', 5);
      await preferences.setString('${RoutineConfig.alertTickPrefix}$day.t1', 'not a time');

      expect(await RoutineAlertTicks.take(), isEmpty);
      expect(await preferences.getKeys(), isEmpty);
    });
  });

  group('the app is told at once when it is running', () {
    test('a ping reaches whoever is listening, and stops reaching them when they stop', () async {
      var heard = 0;
      final first = Completer<void>();
      final port = RoutineAlertTicks.listen(() {
        heard += 1;
        if (!first.isCompleted) first.complete();
      });

      RoutineAlertTicks.ping();
      await first.future.timeout(const Duration(seconds: 2));
      expect(heard, 1);

      RoutineAlertTicks.stopListening(port);
      RoutineAlertTicks.ping();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      expect(heard, 1);
    });

    test('a ping with nobody listening is harmless', () {
      expect(RoutineAlertTicks.ping, returnsNormally);
    });
  });

  group('routineAlertBackground', () {
    test('records the press of "Mark as done"', () async {
      await routineAlertBackground(pressed(body: payload(task: 'local.9')));

      final taken = await RoutineAlertTicks.take();

      expect(taken.single.taskId, 'local.9');
      expect(taken.single.day, day);
    });

    test('ignores every other press', () async {
      await routineAlertBackground(pressed(actionId: null));
      await routineAlertBackground(pressed(actionId: 'something_else'));

      expect(await RoutineAlertTicks.take(), isEmpty);
    });

    test('ignores a payload that is not one of ours, without failing', () async {
      await routineAlertBackground(pressed(body: 'not json'));
      await routineAlertBackground(pressed(body: '[]'));
      await routineAlertBackground(pressed(body: jsonEncode({RoutineConfig.alertTaskKey: 't1'})));
      await routineAlertBackground(pressed(body: jsonEncode({RoutineConfig.alertTaskKey: '', RoutineConfig.alertDayKey: day})));

      expect(await RoutineAlertTicks.take(), isEmpty);
    });
  });
}
