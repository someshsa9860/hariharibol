import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/constants/storage_keys.dart';
import '../models/routine_data.dart';
import '../models/routine_task.dart';
import '../services/ekadashi_calendar.dart';
import '../services/local_store.dart';
import '../services/routine_alert_ticks.dart';
import 'routine_sync_provider.dart';
import 'session_provider.dart';

/// The routine. It is kept on the device first — every change is written to
/// local storage before anything else, so the tab never waits on the network —
/// and mirrored to the account in the background (see [routineSyncerProvider]).
///
/// Days do not leak into each other. A task is added *for* a day and stays on
/// it, so scrolling back through the date strip shows what was planned and what
/// was finished. The daily routine is the one thing that repeats, and each day
/// keeps its own checks for it.
class RoutineNotifier extends Notifier<RoutineData> {
  @override
  RoutineData build() {
    final store = LocalStore.instance;

    // Rebuilt when a different account signs in, not on every profile change.
    final userId = ref.watch(currentUserProvider.select((user) => user?.id));
    final owner = store.read<String>(BoxKeys.routineOwner);
    if (userId != null && owner != null && owner != userId) {
      // The list on this phone is another account's, and is on that account.
      // It must not be uploaded into this one.
      unawaited(_forgetOwnersRoutine(userId));
      return const RoutineData();
    }

    // Tasks saved before they carried a day all belonged to the day the list
    // was last opened on.
    final legacyDay = store.read<String>(BoxKeys.routineDate);
    final data = RoutineData.fromJson(
      {
        'tasks': store.read<List>(BoxKeys.routineTasks),
        'daily': store.read<List>(BoxKeys.routineDaily),
        'checks': store.read<Map>(BoxKeys.routineChecks),
      },
      legacyDay: (legacyDay == null || legacyDay.isEmpty)
          ? routineDayKey(DateTime.now())
          : legacyDay,
    );

    // A list kept before accounts owned it belongs to whoever opens it first.
    // An empty one has nothing to protect, so nothing is written for it: the
    // owner goes down with the first change instead (see [_persist]).
    if (userId != null && owner == null && !data.isEmpty) {
      unawaited(store.write(BoxKeys.routineOwner, userId));
    }
    return data;
  }

  Future<void> _forgetOwnersRoutine(String newOwner) async {
    final store = LocalStore.instance;
    for (final key in [
      BoxKeys.routineTasks,
      BoxKeys.routineDaily,
      BoxKeys.routineChecks,
      BoxKeys.routineDate,
      BoxKeys.routineSynced,
    ]) {
      await store.delete(key);
    }
    await store.write(BoxKeys.routineOwner, newOwner);
  }

  /// Writes the routine to the phone, then asks for it to be sent to the
  /// account.
  Future<void> _persist({bool sync = true}) async {
    final store = LocalStore.instance;
    final stored = state.toJson();
    final userId = ref.read(currentUserProvider)?.id;
    if (userId != null) await store.write(BoxKeys.routineOwner, userId);
    await store.write(BoxKeys.routineTasks, stored['tasks']);
    await store.write(BoxKeys.routineDaily, stored['daily']);
    await store.write(BoxKeys.routineChecks, stored['checks']);
    if (sync) ref.read(routineSyncerProvider).schedule();
  }

  /// Takes what a sync produced as the routine. It is not sent again: it is
  /// what the server holds, plus anything changed on the phone while the
  /// request was on its way, and that change has its own sync waiting.
  Future<void> adopt(RoutineData data) async {
    state = data;
    await _persist(sync: false);
  }

  static String _newId() => DateTime.now().microsecondsSinceEpoch.toString();

  /// A task for one particular day, with the time range it is meant to be
  /// done in, if it has one.
  Future<void> addTask({
    required DateTime day,
    required String title,
    required RoutineCategory category,
    RoutineWindow? window,
  }) async {
    final task = RoutineTask(
      id: _newId(),
      title: routineTitle(title),
      category: category,
      slot: window?.slot ?? RoutineSlot.anytime,
      window: window,
      day: routineDayKey(day),
    );
    state = state.copyWith(tasks: [...state.tasks, task]);
    await _persist();
  }

  /// An item of the daily routine, from today on.
  Future<void> addDaily({
    required String title,
    required RoutineCategory category,
    RoutineWindow? window,
  }) async {
    final item = DailyRoutineItem(
      id: _newId(),
      title: routineTitle(title),
      category: category,
      slot: window?.slot ?? RoutineSlot.anytime,
      window: window,
      since: routineDayKey(DateTime.now()),
    );
    state = state.copyWith(daily: [...state.daily, item]);
    await _persist();
  }

  /// Takes an item out of the daily routine from today on. The days already
  /// lived keep showing it.
  Future<void> removeDaily(String id) async {
    final yesterday = routineDayKey(
      routineDay(DateTime.now()).subtract(const Duration(days: 1)),
    );
    state = state.copyWith(
      daily: [
        for (final item in state.daily)
          if (item.id == id) item.endedOn(yesterday) else item,
      ],
    );
    await _persist();
  }

  /// Ticks [task] on the day it is shown on, done at [minute] (minutes after
  /// midnight). Ticking a done task again at another time changes its time.
  Future<void> markDone(RoutineTask task, {required int minute}) async {
    _tick(task, minute);
    await _persist();
  }

  void _tick(RoutineTask task, int minute) {
    if (task.isDaily) {
      state = state.copyWith(
        checks: {
          ...state.checks,
          task.day: {...(state.checks[task.day] ?? const {}), task.id: minute},
        },
      );
    } else {
      _replace(task.id, (each) => each.doneAtMinute(minute));
    }
  }

  /// Ticks what was marked done from an alert's button (see
  /// `RoutineAlertTicks`), each at the time the button was pressed. A task that
  /// is gone, or already done, is left as it is: a press is never counted twice
  /// and never changes the time of a tick made in the app.
  Future<void> markDoneFromAlerts(List<RoutineAlertTick> presses) async {
    var changed = false;
    for (final press in presses) {
      for (final task in state.on(press.day)) {
        if (task.id != press.taskId || task.isDone) continue;
        _tick(task, press.minute);
        changed = true;
      }
    }
    if (changed) await _persist();
  }

  /// Unticks [task]; the time it was done at goes with the tick.
  Future<void> unmark(RoutineTask task) async {
    if (task.isDaily) {
      state = state.copyWith(
        checks: {
          ...state.checks,
          task.day: {...(state.checks[task.day] ?? const {})}..remove(task.id),
        },
      );
    } else {
      _replace(task.id, (each) => each.notDone());
    }
    await _persist();
  }

  void _replace(String id, RoutineTask Function(RoutineTask) change) {
    state = state.copyWith(
      tasks: [
        for (final each in state.tasks)
          if (each.id == id) change(each) else each,
      ],
    );
  }

  Future<void> remove(String id) async {
    state = state.copyWith(
      tasks: state.tasks.where((task) => task.id != id).toList(),
    );
    await _persist();
  }

  /// Puts a removed task back, for the snack bar's undo action.
  Future<void> restore(RoutineTask task) async {
    state = state.copyWith(tasks: [...state.tasks, task]);
    await _persist();
  }
}

final routineProvider = NotifierProvider<RoutineNotifier, RoutineData>(
  RoutineNotifier.new,
);

/// The day the routine tab is showing.
class SelectedRoutineDay extends Notifier<DateTime> {
  @override
  DateTime build() => routineDay(DateTime.now());

  void select(DateTime day) => state = routineDay(day);
}

final selectedRoutineDayProvider =
    NotifierProvider<SelectedRoutineDay, DateTime>(SelectedRoutineDay.new);

/// One day's routine, by [routineDayKey].
final routineDayProvider = Provider.family<List<RoutineTask>, String>(
  (ref, day) => ref.watch(routineProvider.select((data) => data.on(day))),
);

/// How many of a day's items are done, and how many there are.
typedef RoutineProgress = ({int done, int total});

RoutineProgress routineProgressOf(List<RoutineTask> tasks) =>
    (done: tasks.where((task) => task.isDone).length, total: tasks.length);

final ekadashiCalendarProvider = Provider<EkadashiCalendar>(
  (ref) => const EkadashiCalendar(),
);

/// Just the counts for one day, so a date chip rebuilds when its own day
/// changes and not on every tick anywhere else in the routine.
final routineProgressProvider = Provider.family<RoutineProgress, String>(
  (ref, day) => ref.watch(
    routineProvider.select((data) => routineProgressOf(data.on(day))),
  ),
);
