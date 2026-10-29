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

  /// An item of the daily routine, from [from] on (today when not given).
  Future<void> addDaily({
    required String title,
    required RoutineCategory category,
    RoutineWindow? window,
    DateTime? from,
  }) async {
    final item = DailyRoutineItem(
      id: _newId(),
      title: routineTitle(title),
      category: category,
      slot: window?.slot ?? RoutineSlot.anytime,
      window: window,
      since: routineDayKey(from ?? DateTime.now()),
    );
    state = state.copyWith(daily: [...state.daily, item]);
    await _persist();
  }

  /// Takes an item out of the daily routine from today on. The days already
  /// lived keep showing it.
  Future<void> removeDaily(String id) async {
    _endDaily(id, routineDayKey(DateTime.now()));
    await _persist();
  }

  /// Deletes [task] from the day it is shown on: a task of that day goes, and a
  /// daily item stops repeating from that day on — the days before it keep it,
  /// ticks and all. What comes back puts it all back ([undoRemoval]).
  Future<RoutineRemoval> removeFromDay(RoutineTask task) async {
    final before = state;
    if (task.isDaily) {
      _endDaily(task.id, task.day);
    } else {
      state = state.copyWith(
        tasks: state.tasks.where((each) => each.id != task.id).toList(),
      );
    }
    await _persist();
    return RoutineRemoval._(before, task);
  }

  /// Puts back what [removeFromDay] took — only that, so a tick made since the
  /// removal is kept.
  Future<void> undoRemoval(RoutineRemoval removal) async {
    final task = removal.task;
    if (!task.isDaily) return restore(task);

    final item = removal.before.daily.where((each) => each.id == task.id).firstOrNull;
    if (item == null) return;
    final checks = {...state.checks};
    removal.before.checks.forEach((day, marks) {
      // Only the days the removal cleared: a tick before them was never taken,
      // and one changed since stays as it was changed.
      if (day.compareTo(task.day) >= 0 && marks.containsKey(task.id)) {
        checks[day] = {...(checks[day] ?? const {}), task.id: marks[task.id]};
      }
    });
    state = state.copyWith(
      daily: [
        for (final each in state.daily)
          if (each.id == task.id) item else each,
      ],
      checks: checks,
    );
    await _persist();
  }

  /// Changes [task] from the day it is shown on: its name, category and time
  /// range, and whether it repeats every day.
  ///
  /// - A task of one day is changed on that day, ticked or not as it was.
  /// - Made [daily], it becomes an item of the daily routine from its day on,
  ///   that day's tick carried over.
  /// - A daily item changed on a day changes **from that day on**: the days
  ///   before it keep the name and time range they were ticked against, so an
  ///   earlier tick never turns late after the fact. (When it began that very
  ///   day it is simply changed.)
  /// - A daily item made not [daily] stays on that day only, as a task of its
  ///   own with that day's tick, and stops repeating after it.
  ///
  /// Every new thing gets a new id: the sync only ever adds and ends daily
  /// items, never deletes one, so nothing here depends on the server
  /// forgetting a row.
  Future<void> editTask(
    RoutineTask task, {
    required String title,
    required RoutineCategory category,
    RoutineWindow? window,
    required bool daily,
  }) async {
    final name = routineTitle(title);
    final day = task.day;
    // Saved as it was: a daily item is not split into two the same.
    if (name == task.title &&
        category == task.category &&
        window == task.window &&
        daily == task.isDaily) {
      return;
    }
    // A task kept from before ranges keeps its part of the day until it is
    // given a range.
    final slot =
        window?.slot ??
        (task.window == null ? task.slot : RoutineSlot.anytime);

    if (!task.isDaily && !daily) {
      _replace(
        task.id,
        (each) => RoutineTask(
          id: each.id,
          title: name,
          category: category,
          slot: slot,
          window: window,
          isDone: each.isDone,
          doneAt: each.doneAt,
          day: each.day,
        ),
      );
    } else if (!task.isDaily) {
      final item = DailyRoutineItem(
        id: _newId(),
        title: name,
        category: category,
        slot: slot,
        window: window,
        since: day,
      );
      state = state.copyWith(
        tasks: state.tasks.where((each) => each.id != task.id).toList(),
        daily: [...state.daily, item],
        checks: task.isDone ? _withCheck(day, item.id, task.doneAt) : null,
      );
    } else if (!daily) {
      _endDaily(task.id, day);
      state = state.copyWith(
        tasks: [
          ...state.tasks,
          RoutineTask(
            id: _newId(),
            title: name,
            category: category,
            slot: slot,
            window: window,
            isDone: task.isDone,
            doneAt: task.doneAt,
            day: day,
          ),
        ],
      );
    } else {
      final item = state.daily.where((each) => each.id == task.id).firstOrNull;
      if (item == null) return;
      if (item.since.compareTo(day) >= 0) {
        state = state.copyWith(
          daily: [
            for (final each in state.daily)
              if (each.id == item.id)
                DailyRoutineItem(
                  id: item.id,
                  title: name,
                  category: category,
                  slot: slot,
                  window: window,
                  since: item.since,
                  until: item.until,
                )
              else
                each,
          ],
        );
      } else {
        final next = DailyRoutineItem(
          id: _newId(),
          title: name,
          category: category,
          slot: slot,
          window: window,
          since: day,
          until: item.until,
        );
        // The ticks from that day on belong to the item as it is now.
        final checks = <String, Map<String, int?>>{};
        state.checks.forEach((each, marks) {
          if (each.compareTo(day) < 0 || !marks.containsKey(item.id)) {
            checks[each] = marks;
          } else {
            checks[each] = {...marks}
              ..remove(item.id)
              ..[next.id] = marks[item.id];
          }
        });
        state = state.copyWith(
          daily: [
            for (final each in state.daily)
              if (each.id == item.id) item.endedOn(_dayBefore(day)) else each,
            next,
          ],
          checks: checks,
        );
      }
    }
    await _persist();
  }

  /// Changes an item of the daily routine from today on, as [editTask] does
  /// for it on today's list.
  Future<void> editDaily(
    DailyRoutineItem item, {
    required String title,
    required RoutineCategory category,
    RoutineWindow? window,
  }) => editTask(
    item.on(routineDayKey(DateTime.now()), isDone: false),
    title: title,
    category: category,
    window: window,
    daily: true,
  );

  /// Ends the daily item [id] the day before [day], and drops its ticks from
  /// [day] on — they belonged to days it no longer applies to.
  void _endDaily(String id, String day) {
    state = state.copyWith(
      daily: [
        for (final item in state.daily)
          if (item.id == id) item.endedOn(_dayBefore(day)) else item,
      ],
      checks: {
        for (final entry in state.checks.entries)
          entry.key: entry.key.compareTo(day) < 0 || !entry.value.containsKey(id)
              ? entry.value
              : ({...entry.value}..remove(id)),
      },
    );
  }

  DailyChecks _withCheck(String day, String id, int? minute) => {
    ...state.checks,
    day: {...(state.checks[day] ?? const {}), id: minute},
  };

  /// The key of the day before [day], by the calendar — not 24 hours back,
  /// which a change of clocks would land on the wrong day.
  static String _dayBefore(String day) {
    final date = DateTime.parse(day);
    return routineDayKey(DateTime(date.year, date.month, date.day - 1));
  }

  /// Ticks [task] on the day it is shown on, done at [minute] (minutes after
  /// midnight). Ticking a done task again at another time changes its time.
  Future<void> markDone(RoutineTask task, {required int minute}) async {
    _tick(task, minute);
    await _persist();
  }

  void _tick(RoutineTask task, int minute) {
    if (task.isDaily) {
      state = state.copyWith(checks: _withCheck(task.day, task.id, minute));
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

/// What [RoutineNotifier.removeFromDay] took, for its undo.
class RoutineRemoval {
  const RoutineRemoval._(this.before, this.task);

  /// The routine as it was just before.
  final RoutineData before;

  /// The task as it was shown on its day.
  final RoutineTask task;
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
