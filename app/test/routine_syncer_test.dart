// The routine's background sync, against a fake server that behaves like the
// real one (removals, then rows; tasks and ticks only from the window on; the
// whole daily routine) and the real local store.

import 'dart:async';
import 'dart:io';
import 'dart:math';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/constants/routine_config.dart';
import 'package:hariharibol/core/constants/storage_keys.dart';
import 'package:hariharibol/models/api_failure.dart';
import 'package:hariharibol/models/app_user.dart';
import 'package:hariharibol/models/routine_data.dart';
import 'package:hariharibol/models/routine_sync.dart';
import 'package:hariharibol/models/routine_task.dart';
import 'package:hariharibol/providers/routine_provider.dart';
import 'package:hariharibol/providers/routine_sync_provider.dart';
import 'package:hariharibol/providers/session_provider.dart';
import 'package:hariharibol/services/local_store.dart';
import 'package:hariharibol/services/routine_service.dart';
import 'package:hariharibol/services/routine_syncer.dart';

const today = '2026-10-15';
const since = '2026-06-17';

RoutineTask task(String id, {String day = today, String title = 'Scripture reading', int? doneAt}) =>
    RoutineTask(id: id, title: title, day: day, isDone: doneAt != null, doneAt: doneAt);

DailyRoutineItem item(String id) => DailyRoutineItem(id: id, title: 'Japa', since: '2026-10-01');

List<String> ids(Iterable<RoutineTask> tasks) => [for (final each in tasks) each.id];

ApiFailure failure(FailureKind kind) => ApiFailure(kind: kind);

class FakeServer implements RoutineRemote {
  final tasks = <String, RoutineTask>{};
  final daily = <String, DailyRoutineItem>{};
  final checks = <RoutineCheckKey, int?>{};
  final calls = <RoutineChanges>[];

  Object? failWith;

  /// While set, a request waits for it — the time the request is "on its way".
  Completer<void>? gate;
  int _running = 0;
  int mostAtOnce = 0;

  @override
  Future<RoutineData> sync(RoutineChanges changes, {required String since}) async {
    calls.add(changes);
    _running += 1;
    mostAtOnce = max(mostAtOnce, _running);
    try {
      await gate?.future;
      final error = failWith;
      if (error != null) throw error;

      for (final id in changes.removedTasks) {
        tasks.remove(id);
      }
      changes.removedChecks.forEach(checks.remove);
      for (final each in changes.daily) {
        daily[each.id] = each;
      }
      for (final each in changes.tasks) {
        tasks[each.id] = each;
      }
      for (final check in changes.checks) {
        checks[(day: check.day, itemId: check.itemId)] = check.doneAt;
      }

      final answered = <String, Map<String, int?>>{};
      for (final entry in checks.entries) {
        if (entry.key.day.compareTo(since) < 0) continue;
        (answered[entry.key.day] ??= {})[entry.key.itemId] = entry.value;
      }
      return RoutineData(
        tasks: [
          for (final each in tasks.values)
            if (each.day.compareTo(since) >= 0) each,
        ],
        daily: daily.values.toList(),
        checks: answered,
      );
    } finally {
      _running -= 1;
    }
  }
}

/// Waits (really) until [done] holds.
Future<void> until(bool Function() done) async {
  for (var waited = 0; !done() && waited < 2000; waited += 5) {
    await Future<void>.delayed(const Duration(milliseconds: 5));
  }
  expect(done(), isTrue, reason: 'timed out waiting');
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory dir;

  setUpAll(() async {
    dir = await Directory.systemTemp.createTemp('hariharibol_routine_sync');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
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

  group('RoutineSyncer', () {
    late FakeServer server;
    late RoutineData routine;
    String? user;
    late RoutineSyncer syncer;

    setUp(() {
      server = FakeServer();
      routine = const RoutineData();
      user = 'usr_1';
      syncer = RoutineSyncer(
        remote: server,
        read: () => routine,
        write: (data) async => routine = data,
        userId: () => user,
        clock: () => DateTime(2026, 10, 15, 12),
      );
    });

    tearDown(() => syncer.dispose());

    Map<String, dynamic>? base() => LocalStore.instance.readJson(BoxKeys.routineSynced);

    test('the first sync sends what the phone already has', () async {
      routine = RoutineData(
        tasks: [task('t1'), task('t2', doneAt: 500)],
        daily: [item('d1')],
        checks: const {today: {'d1': 400}},
      );

      await syncer.syncNow();

      expect(server.tasks.keys, ['t1', 't2']);
      expect(server.daily.keys, ['d1']);
      expect(server.checks, {(day: today, itemId: 'd1'): 400});
      expect(ids(routine.tasks), ['t1', 't2']);
      expect(base()?['owner'], 'usr_1');
    });

    test('with nothing changed a sync sends nothing, and still reads', () async {
      routine = RoutineData(tasks: [task('t1')]);
      await syncer.syncNow();

      server.tasks['fromAnotherPhone'] = task('fromAnotherPhone');
      await syncer.syncNow();

      expect(server.calls.last.isEmpty, isTrue);
      expect(ids(routine.tasks), ['t1', 'fromAnotherPhone']);
    });

    test('only what changed since the last sync is sent', () async {
      routine = RoutineData(tasks: [task('t1')], daily: [item('d1')]);
      await syncer.syncNow();

      routine = RoutineData(
        tasks: [task('t1', doneAt: 480), task('t2')],
        daily: routine.daily,
      );
      await syncer.syncNow();

      final sent = server.calls.last;
      expect(ids(sent.tasks), ['t1', 't2']);
      expect(sent.daily, isEmpty);
      expect(sent.checks, isEmpty);
    });

    test('a task removed on the phone is removed on the account', () async {
      routine = RoutineData(tasks: [task('t1'), task('t2')]);
      await syncer.syncNow();

      routine = RoutineData(tasks: [task('t2')]);
      await syncer.syncNow();

      expect(server.calls.last.removedTasks, ['t1']);
      expect(server.tasks.keys, ['t2']);
    });

    test('a task removed on another phone goes from this one', () async {
      routine = RoutineData(tasks: [task('t1'), task('t2')]);
      await syncer.syncNow();

      server.tasks.remove('t1');
      await syncer.syncNow();

      expect(ids(routine.tasks), ['t2']);
    });

    test('where two phones changed the same task, the later one wins', () async {
      routine = RoutineData(tasks: [task('t1', title: 'Original')]);
      await syncer.syncNow();

      server.tasks['t1'] = task('t1', title: 'Edited on the other phone');
      routine = RoutineData(tasks: [task('t1', title: 'Edited here')]);
      await syncer.syncNow();

      expect(server.tasks['t1']?.title, 'Edited here');
      expect(routine.tasks.single.title, 'Edited here');
    });

    test('days before the window are kept and sent only once', () async {
      routine = RoutineData(
        tasks: [task('old', day: '2025-01-01'), task('t1')],
        checks: const {'2025-01-01': {'d1': 400}},
      );
      await syncer.syncNow();

      expect(server.tasks.keys, containsAll(['old', 't1']));
      expect(ids(routine.tasks), unorderedEquals(['old', 't1']));
      expect(routine.checks['2025-01-01'], {'d1': 400});

      await syncer.syncNow();
      expect(server.calls.last.isEmpty, isTrue);
    });

    test('an edit made while the request is on its way is kept and sent next', () async {
      routine = RoutineData(tasks: [task('t1')]);
      server.gate = Completer<void>();

      final running = syncer.syncNow();
      await until(() => server.calls.isNotEmpty);
      routine = RoutineData(tasks: [...routine.tasks, task('typedMeanwhile')]);
      server.gate!.complete();
      await running;

      expect(ids(routine.tasks), ['t1', 'typedMeanwhile']);
      expect(syncer.isScheduled, isTrue);

      await syncer.syncNow();
      expect(ids(server.calls.last.tasks), ['typedMeanwhile']);
      expect(server.tasks.keys, ['t1', 'typedMeanwhile']);
    });

    test('an answer that comes after signing out is not used', () async {
      routine = RoutineData(tasks: [task('t1')]);
      server.tasks['theirs'] = task('theirs');
      server.gate = Completer<void>();

      final running = syncer.syncNow();
      await until(() => server.calls.isNotEmpty);
      user = 'usr_2';
      server.gate!.complete();
      await running;

      expect(ids(routine.tasks), ['t1']);
      expect(base(), isNull);
    });

    test('a request that fails changes nothing and is tried again later', () async {
      routine = RoutineData(tasks: [task('t1')]);
      server.failWith = failure(FailureKind.network);

      await syncer.syncNow();

      expect(ids(routine.tasks), ['t1']);
      expect(base(), isNull);
      expect(syncer.isScheduled, isTrue);
    });

    test('a request the server refused is not repeated, one it could not take is', () async {
      Future<bool> retries(FailureKind kind) async {
        final other = RoutineSyncer(
          remote: server,
          read: () => routine,
          write: (data) async => routine = data,
          userId: () => user,
        );
        server.failWith = failure(kind);
        await other.syncNow();
        final scheduled = other.isScheduled;
        other.dispose();
        return scheduled;
      }

      expect(await retries(FailureKind.validation), isFalse);
      expect(await retries(FailureKind.forbidden), isFalse);
      expect(await retries(FailureKind.unauthorized), isFalse);
      expect(await retries(FailureKind.server), isTrue);
      expect(await retries(FailureKind.timeout), isTrue);
      expect(await retries(FailureKind.rateLimited), isTrue);
    });

    test('with nobody signed in nothing is sent or scheduled', () async {
      user = null;
      routine = RoutineData(tasks: [task('t1')]);

      syncer.schedule(after: Duration.zero);
      await syncer.syncNow();

      expect(server.calls, isEmpty);
      expect(syncer.isScheduled, isFalse);
    });

    test('a large routine goes up in pieces, all of it', () async {
      routine = RoutineData(tasks: [for (var i = 0; i < 1300; i++) task('t$i')]);

      await syncer.syncNow();

      expect(server.calls, hasLength(3));
      expect(
        server.calls.every((call) => call.rows <= RoutineConfig.syncChunkRows),
        isTrue,
      );
      expect(server.tasks, hasLength(1300));
      expect(routine.tasks, hasLength(1300));
    });

    test('what another account last synced here is not trusted', () async {
      await LocalStore.instance.write(BoxKeys.routineSynced, {
        'owner': 'usr_other',
        ...RoutineData(tasks: [task('theirs')]).toJson(),
      });
      routine = RoutineData(tasks: [task('mine')]);

      await syncer.syncNow();

      expect(server.calls.single.removedTasks, isEmpty);
      expect(ids(server.calls.single.tasks), ['mine']);
      expect(base()?['owner'], 'usr_1');
    });

    test('changes made close together go up in one sync', () async {
      routine = RoutineData(tasks: [task('t1')]);

      syncer.schedule(after: const Duration(milliseconds: 40));
      await Future<void>.delayed(const Duration(milliseconds: 10));
      syncer.schedule(after: const Duration(milliseconds: 40));
      await Future<void>.delayed(const Duration(milliseconds: 10));
      syncer.schedule(after: const Duration(milliseconds: 40));
      await until(() => server.calls.isNotEmpty);
      await Future<void>.delayed(const Duration(milliseconds: 100));

      expect(server.calls, hasLength(1));
    });

    test('two syncs never run at once, and the second still happens', () async {
      routine = RoutineData(tasks: [task('t1')]);
      server.gate = Completer<void>();

      final first = syncer.syncNow();
      await until(() => server.calls.isNotEmpty);
      final second = syncer.syncNow();
      expect(server.calls, hasLength(1));
      server.gate!.complete();
      await Future.wait([first, second]);
      await until(() => server.calls.length == 2);

      expect(server.mostAtOnce, 1);
    });

    test('once disposed it sends nothing more', () async {
      syncer.dispose();
      routine = RoutineData(tasks: [task('t1')]);

      await syncer.syncNow();

      expect(server.calls, isEmpty);
    });
  });

  group('RoutineNotifier', () {
    final signedIn = AppUser.fromJson({'id': 'usr_1', 'email': 'a@smoke.test'});
    late _SpySyncer spy;
    late ProviderContainer container;

    ProviderContainer open({AppUser? user}) {
      spy = _SpySyncer();
      return container = ProviderContainer(
        overrides: [
          currentUserProvider.overrideWith(() => _FixedUser(user)),
          routineSyncerProvider.overrideWithValue(spy),
        ],
      );
    }

    tearDown(() => container.dispose());

    Future<void> addTask(String title) => container
        .read(routineProvider.notifier)
        .addTask(day: DateTime(2026, 10, 15), title: title, category: RoutineCategory.home);

    test('a change is written to the phone and then handed to the sync', () async {
      open(user: signedIn);

      await addTask('  ${'a' * 300}  ');

      final stored = LocalStore.instance.read<List>(BoxKeys.routineTasks);
      expect(stored, hasLength(1));
      expect((stored!.single as Map)['title'], hasLength(RoutineConfig.maxTitleLength));
      expect(LocalStore.instance.read<String>(BoxKeys.routineOwner), 'usr_1');
      expect(spy.scheduled, 1);
    });

    test('what a sync produced is taken without being sent again', () async {
      open(user: signedIn);

      await container.read(routineProvider.notifier).adopt(RoutineData(tasks: [task('t1')]));

      expect(ids(container.read(routineProvider).tasks), ['t1']);
      expect(LocalStore.instance.read<List>(BoxKeys.routineTasks), hasLength(1));
      expect(spy.scheduled, 0);
    });

    test('a routine from before accounts belongs to whoever opens it first', () async {
      await LocalStore.instance.write(BoxKeys.routineTasks, [task('t1').toJson()]);
      open(user: signedIn);

      expect(ids(container.read(routineProvider).tasks), ['t1']);
      await until(() => LocalStore.instance.read<String>(BoxKeys.routineOwner) == 'usr_1');
    });

    test('an empty routine claims nothing', () async {
      open(user: signedIn);

      container.read(routineProvider);
      await Future<void>.delayed(const Duration(milliseconds: 20));

      expect(LocalStore.instance.read<String>(BoxKeys.routineOwner), isNull);
    });

    test('the same account keeps its routine', () async {
      await LocalStore.instance.write(BoxKeys.routineOwner, 'usr_1');
      await LocalStore.instance.write(BoxKeys.routineTasks, [task('t1').toJson()]);
      open(user: signedIn);

      expect(ids(container.read(routineProvider).tasks), ['t1']);
    });

    test("another account's routine is not shown, not sent and not kept", () async {
      await LocalStore.instance.write(BoxKeys.routineOwner, 'usr_2');
      await LocalStore.instance.write(BoxKeys.routineTasks, [task('theirs').toJson()]);
      await LocalStore.instance.write(BoxKeys.routineSynced, {
        'owner': 'usr_2',
        ...RoutineData(tasks: [task('theirs')]).toJson(),
      });
      open(user: signedIn);

      expect(container.read(routineProvider).tasks, isEmpty);
      await until(() => LocalStore.instance.read<String>(BoxKeys.routineOwner) == 'usr_1');
      expect(LocalStore.instance.read<List>(BoxKeys.routineTasks), isNull);
      expect(LocalStore.instance.readJson(BoxKeys.routineSynced), isNull);
    });
  });
}

class _FixedUser extends CurrentUser {
  _FixedUser(this._user);

  final AppUser? _user;

  @override
  AppUser? build() => _user;
}

/// A syncer that only counts how often it was asked to run.
class _SpySyncer extends RoutineSyncer {
  _SpySyncer()
    : super(
        remote: FakeServer(),
        read: () => const RoutineData(),
        write: (_) async {},
        userId: () => null,
      );

  int scheduled = 0;

  @override
  void schedule({Duration? after}) => scheduled += 1;
}
