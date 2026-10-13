import 'dart:convert';

import '../core/constants/routine_config.dart';
import 'json.dart';
import 'routine_task.dart';

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

  /// Nothing kept at all: no task, no daily item, no check.
  bool get isEmpty =>
      tasks.isEmpty &&
      daily.isEmpty &&
      checks.values.every((checked) => checked.isEmpty);

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

  /// The routine as the phone stores it, and as the last sync answered it.
  Json toJson() => {
    'tasks': [for (final task in tasks) task.toJson()],
    'daily': [for (final item in daily) item.toJson()],
    'checks': {
      for (final entry in checks.entries)
        if (entry.value.isNotEmpty) entry.key: entry.value,
    },
  };

  /// Reads [toJson] back — and the older shapes of it: tasks saved before they
  /// carried a day belonged to [legacyDay], and checks saved before times were
  /// kept are a list of the ids checked that day.
  factory RoutineData.fromJson(Json json, {String legacyDay = ''}) {
    final checks = <String, Map<String, int?>>{};
    final stored = json['checks'];
    if (stored is Map) {
      for (final entry in stored.entries) {
        final marks = entry.value;
        if (marks is Map) {
          checks['${entry.key}'] = {
            for (final mark in marks.entries)
              '${mark.key}': mark.value is int ? mark.value as int : null,
          };
        } else if (marks is List) {
          checks['${entry.key}'] = {for (final id in marks) '$id': null};
        }
      }
    }

    return RoutineData(
      tasks: [
        for (final task in _maps(json['tasks']).map(RoutineTask.fromJson))
          legacyDay.isNotEmpty && task.day.isEmpty ? task.withDay(legacyDay) : task,
      ],
      daily: _maps(json['daily']).map(DailyRoutineItem.fromJson).toList(),
      checks: checks,
    );
  }

  /// The routine as the server answers a sync: the same tasks and daily items,
  /// and the checks as a list of `{ itemId, day, doneAt }`.
  factory RoutineData.fromServer(Json json) {
    final checks = <String, Map<String, int?>>{};
    for (final check in _maps(json['checks'])) {
      final day = asString(check['day']);
      final id = asString(check['itemId']);
      if (day.isEmpty || id.isEmpty) continue;
      (checks[day] ??= {})[id] = check['doneAt'] is int ? check['doneAt'] as int : null;
    }

    return RoutineData(
      tasks: _maps(json['tasks']).map(RoutineTask.fromJson).toList(),
      daily: _maps(json['daily']).map(DailyRoutineItem.fromJson).toList(),
      checks: checks,
    );
  }

  /// Whether two routines hold the same things, in the same order.
  bool sameAs(RoutineData other) => jsonEncode(toJson()) == jsonEncode(other.toJson());

  /// Hive hands maps back as `Map<dynamic, dynamic>`.
  static Iterable<Json> _maps(Object? stored) =>
      (stored is List ? stored : const []).whereType<Map>().map(Json.from);
}
