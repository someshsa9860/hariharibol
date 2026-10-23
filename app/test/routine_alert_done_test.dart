// The routine taking in what was ticked from an alert's button, with the real
// local store (the same harness as the notifier cases in routine_syncer_test.dart).

import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/constants/routine_config.dart';
import 'package:hariharibol/core/constants/storage_keys.dart';
import 'package:hariharibol/models/app_user.dart';
import 'package:hariharibol/models/routine_data.dart';
import 'package:hariharibol/models/routine_sync.dart';
import 'package:hariharibol/models/routine_task.dart';
import 'package:hariharibol/providers/routine_provider.dart';
import 'package:hariharibol/providers/routine_sync_provider.dart';
import 'package:hariharibol/providers/session_provider.dart';
import 'package:hariharibol/services/local_store.dart';
import 'package:hariharibol/services/routine_alert_ticks.dart';
import 'package:hariharibol/services/routine_service.dart';
import 'package:hariharibol/services/routine_syncer.dart';

const day = '2026-10-15';

RoutineTask task(String id, {int? doneAt}) => RoutineTask(
  id: id,
  title: 'Evening chanting',
  day: day,
  window: const RoutineWindow(start: 18 * 60, end: 19 * 60),
  isDone: doneAt != null,
  doneAt: doneAt,
);

RoutineAlertTick press(String id, {DateTime? at, String onDay = day}) =>
    RoutineAlertTick(taskId: id, day: onDay, at: at ?? DateTime(2026, 10, 15, 18, 5));

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory dir;

  setUpAll(() async {
    dir = await Directory.systemTemp.createTemp('hariharibol_routine_alert');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/path_provider'),
      (call) async => dir.path,
    );
    await LocalStore.instance.init();
  });

  // Not `Hive.close()`: see routine_sheet_test.dart.
  tearDownAll(() {
    if (dir.existsSync()) dir.deleteSync(recursive: true);
  });

  setUp(() => LocalStore.instance.clear());

  group('RoutineNotifier.markDoneFromAlerts', () {
    final signedIn = AppUser.fromJson({'id': 'usr_1', 'email': 'a@smoke.test'});
    late _SpySyncer spy;
    late ProviderContainer container;

    RoutineNotifier open(RoutineData data) {
      spy = _SpySyncer();
      container = ProviderContainer(
        overrides: [
          currentUserProvider.overrideWith(() => _FixedUser(signedIn)),
          routineSyncerProvider.overrideWithValue(spy),
        ],
      );
      return container.read(routineProvider.notifier)..state = data;
    }

    tearDown(() => container.dispose());

    RoutineData routine() => container.read(routineProvider);

    test('ticks the task at the minute the button was pressed, on the phone and for the sync', () async {
      final notifier = open(RoutineData(tasks: [task('t1')]));

      await notifier.markDoneFromAlerts([press('t1')]);

      expect(routine().tasks.single.isDone, isTrue);
      expect(routine().tasks.single.doneAt, 18 * 60 + 5);
      expect(routine().tasks.single.status, RoutineStatus.onTime);
      final stored = LocalStore.instance.read<List>(BoxKeys.routineTasks)!;
      expect((stored.single as Map)['doneAt'], 18 * 60 + 5);
      expect(spy.scheduled, 1);
    });

    test('ticks a daily item as that day\'s check', () async {
      final notifier = open(
        const RoutineData(
          daily: [
            DailyRoutineItem(
              id: 'd1',
              title: 'Japa',
              since: '2026-10-01',
              window: RoutineWindow(start: 18 * 60, end: 19 * 60),
            ),
          ],
        ),
      );

      await notifier.markDoneFromAlerts([press('d1')]);

      expect(routine().checks[day], {'d1': 18 * 60 + 5});
      expect(spy.scheduled, 1);
    });

    test('a press after midnight is the end of the task\'s own day', () async {
      final notifier = open(RoutineData(tasks: [task('t1')]));

      await notifier.markDoneFromAlerts([press('t1', at: DateTime(2026, 10, 16, 0, 10))]);

      expect(routine().tasks.single.doneAt, RoutineConfig.minutesPerDay - 1);
    });

    test('a task already done keeps the time it was done at, and nothing is written', () async {
      final notifier = open(RoutineData(tasks: [task('t1', doneAt: 500)]));

      await notifier.markDoneFromAlerts([press('t1')]);

      expect(routine().tasks.single.doneAt, 500);
      expect(LocalStore.instance.read<List>(BoxKeys.routineTasks), isNull);
      expect(spy.scheduled, 0);
    });

    test('a task that is gone, or on another day, is ignored', () async {
      final notifier = open(RoutineData(tasks: [task('t1')]));

      await notifier.markDoneFromAlerts([press('missing'), press('t1', onDay: '2026-10-16')]);

      expect(routine().tasks.single.isDone, isFalse);
      expect(spy.scheduled, 0);
    });

    test('several presses tick each task once and go up as one change', () async {
      final notifier = open(RoutineData(tasks: [task('t1'), task('t2'), task('t3', doneAt: 400)]));

      await notifier.markDoneFromAlerts([
        press('t1', at: DateTime(2026, 10, 15, 18, 1)),
        press('t2', at: DateTime(2026, 10, 15, 18, 2)),
        press('t3', at: DateTime(2026, 10, 15, 18, 3)),
        press('t1', at: DateTime(2026, 10, 15, 18, 4)),
      ]);

      final done = {for (final each in routine().tasks) each.id: each.doneAt};
      expect(done, {'t1': 18 * 60 + 1, 't2': 18 * 60 + 2, 't3': 400});
      expect(spy.scheduled, 1);
    });

    test('with nothing pressed nothing happens', () async {
      final notifier = open(RoutineData(tasks: [task('t1')]));

      await notifier.markDoneFromAlerts(const []);

      expect(routine().tasks.single.isDone, isFalse);
      expect(spy.scheduled, 0);
    });
  });
}

class _FixedUser extends CurrentUser {
  _FixedUser(this._user);

  final AppUser? _user;

  @override
  AppUser? build() => _user;
}

/// Counts how often it was asked to sync; the routine's changes are never sent.
class _SpySyncer extends RoutineSyncer {
  _SpySyncer()
    : super(
        remote: _NoServer(),
        read: () => const RoutineData(),
        write: (_) async {},
        userId: () => null,
      );

  int scheduled = 0;

  @override
  void schedule({Duration? after}) => scheduled += 1;
}

class _NoServer implements RoutineRemote {
  @override
  Future<RoutineData> sync(RoutineChanges changes, {required String since}) =>
      throw UnimplementedError('nothing is sent in this test');
}
