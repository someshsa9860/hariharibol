import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/constants/routine_config.dart';
import '../core/constants/storage_keys.dart';
import '../models/routine_task.dart';
import '../services/ekadashi_calendar.dart';
import '../services/local_store.dart';

/// Which daily items were checked on a day, and the time each was checked at
/// (minutes after midnight; null for a check made before times were kept).
typedef DailyChecks = Map<String, Map<String, int?>>;

/// Everything the routine tab keeps: tasks added for a particular day, the
/// optional daily routine, and which daily items were checked on which day.
class RoutineData {
  const RoutineData({
    this.tasks = const [],
    this.daily = const [],
    this.checks = const {},
  });

  final List<RoutineTask> tasks;
  final List<DailyRoutineItem> daily;

  /// Day key → the daily items checked that day, each with its time.
  final DailyChecks checks;

  RoutineData copyWith({
    List<RoutineTask>? tasks,
    List<DailyRoutineItem>? daily,
    DailyChecks? checks,
  }) => RoutineData(
    tasks: tasks ?? this.tasks,
    daily: daily ?? this.daily,
    checks: checks ?? this.checks,
  );

  /// The routine of one day: its daily items, each with that day's check, then
  /// whatever was added for that day — in the order of the day, tasks with a
  /// time range by when the range opens and the rest after them, in the order
  /// they were added.
  List<RoutineTask> on(String day) {
    final checked = checks[day] ?? const <String, int?>{};
    final tasksOfTheDay = [
      for (final item in daily)
        if (item.appliesOn(day))
          item.on(
            day,
            isDone: checked.containsKey(item.id),
            doneAt: checked[item.id],
          ),
      for (final task in tasks)
        if (task.day == day) task,
    ];

    // `List.sort` is not stable, so the position the task was added at breaks
    // a tie.
    final order = {
      for (var index = 0; index < tasksOfTheDay.length; index++)
        tasksOfTheDay[index]: index,
    };
    return tasksOfTheDay..sort((a, b) {
      final byStart = (a.window?.start ?? RoutineConfig.minutesPerDay)
          .compareTo(b.window?.start ?? RoutineConfig.minutesPerDay);
      return byStart != 0 ? byStart : order[a]!.compareTo(order[b]!);
    });
  }
}

/// The routine, kept on the device: there is no backend model for a personal
/// task list yet.
///
/// Days do not leak into each other. A task is added *for* a day and stays on
/// it, so scrolling back through the date strip shows what was planned and what
/// was finished. The daily routine is the one thing that repeats, and each day
/// keeps its own checks for it.
class RoutineNotifier extends Notifier<RoutineData> {
  @override
  RoutineData build() {
    final store = LocalStore.instance;

    // Tasks saved before they carried a day all belonged to the day the list
    // was last opened on.
    final legacyDay = store.read<String>(BoxKeys.routineDate);
    final fallbackDay = (legacyDay == null || legacyDay.isEmpty)
        ? routineDayKey(DateTime.now())
        : legacyDay;

    final tasks = _list(store.read<List>(BoxKeys.routineTasks))
        .map(RoutineTask.fromJson)
        .map((task) => task.day.isEmpty ? task.withDay(fallbackDay) : task)
        .toList();
    final daily = _list(
      store.read<List>(BoxKeys.routineDaily),
    ).map(DailyRoutineItem.fromJson).toList();

    final checks = <String, Map<String, int?>>{};
    final storedChecks = store.read<Map>(BoxKeys.routineChecks);
    if (storedChecks != null) {
      for (final entry in storedChecks.entries) {
        final marks = entry.value;
        if (marks is Map) {
          checks['${entry.key}'] = {
            for (final mark in marks.entries)
              '${mark.key}': mark.value is int ? mark.value as int : null,
          };
        } else if (marks is List) {
          // Saved before times were kept: a list of the ids checked that day.
          checks['${entry.key}'] = {for (final id in marks) '$id': null};
        }
      }
    }
    return RoutineData(tasks: tasks, daily: daily, checks: checks);
  }

  static Iterable<Map<String, dynamic>> _list(List? stored) =>
      (stored ?? const []).whereType<Map>().map(
        (json) => Map<String, dynamic>.from(json),
      );

  Future<void> _persist() async {
    final store = LocalStore.instance;
    await store.write(
      BoxKeys.routineTasks,
      state.tasks.map((task) => task.toJson()).toList(),
    );
    await store.write(
      BoxKeys.routineDaily,
      state.daily.map((item) => item.toJson()).toList(),
    );
    await store.write(BoxKeys.routineChecks, {
      for (final entry in state.checks.entries)
        if (entry.value.isNotEmpty) entry.key: entry.value,
    });
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
      title: title,
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
      title: title,
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
    await _persist();
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
