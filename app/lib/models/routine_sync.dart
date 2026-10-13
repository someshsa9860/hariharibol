import 'dart:convert';
import 'dart:math';

import 'json.dart';
import 'routine_data.dart';
import 'routine_task.dart';

/// A daily item ticked on a day.
class RoutineCheck {
  const RoutineCheck({required this.itemId, required this.day, this.doneAt});

  final String itemId;
  final String day;
  final int? doneAt;

  Json toJson() => {'itemId': itemId, 'day': day, 'doneAt': doneAt};
}

/// A tick is identified by the day and the daily item it was made on.
typedef RoutineCheckKey = ({String day, String itemId});

/// What one state of the routine needs to become another: the rows to create
/// or overwrite, and the rows to remove. It is what a sync sends, and what is
/// laid back over the server's answer for the edits made while it was on its
/// way.
///
/// Rows are compared by what they would be sent as, so an edit that changes
/// nothing is not a change.
class RoutineChanges {
  const RoutineChanges({
    this.tasks = const [],
    this.daily = const [],
    this.checks = const [],
    this.removedTasks = const [],
    this.removedChecks = const [],
  });

  /// What it takes to get from [from] to [to]. A daily item is never removed —
  /// ending one is an edit of it.
  factory RoutineChanges.between(RoutineData from, RoutineData to) {
    String fingerprint(Json json) => jsonEncode(json);

    final oldTasks = {for (final task in from.tasks) task.id: fingerprint(task.toJson())};
    final newTasks = {for (final task in to.tasks) task.id};
    final oldDaily = {for (final item in from.daily) item.id: fingerprint(item.toJson())};
    final oldChecks = _flat(from.checks);
    final newChecks = _flat(to.checks);

    return RoutineChanges(
      tasks: [
        for (final task in to.tasks)
          if (oldTasks[task.id] != fingerprint(task.toJson())) task,
      ],
      daily: [
        for (final item in to.daily)
          if (oldDaily[item.id] != fingerprint(item.toJson())) item,
      ],
      checks: [
        for (final entry in newChecks.entries)
          if (!oldChecks.containsKey(entry.key) || oldChecks[entry.key] != entry.value)
            RoutineCheck(itemId: entry.key.itemId, day: entry.key.day, doneAt: entry.value),
      ],
      removedTasks: [
        for (final id in oldTasks.keys)
          if (!newTasks.contains(id)) id,
      ],
      removedChecks: [
        for (final key in oldChecks.keys)
          if (!newChecks.containsKey(key)) key,
      ],
    );
  }

  final List<RoutineTask> tasks;
  final List<DailyRoutineItem> daily;
  final List<RoutineCheck> checks;
  final List<String> removedTasks;
  final List<RoutineCheckKey> removedChecks;

  int get rows =>
      tasks.length + daily.length + checks.length + removedTasks.length + removedChecks.length;

  bool get isEmpty => rows == 0;

  /// [data] with these changes made to it. A row that is new goes at the end.
  RoutineData applyTo(RoutineData data) {
    final removed = removedTasks.toSet();
    final changedTasks = {for (final task in tasks) task.id: task};
    final changedDaily = {for (final item in daily) item.id: item};

    final nextTasks = [
      for (final task in data.tasks)
        if (!removed.contains(task.id)) changedTasks[task.id] ?? task,
    ];
    final haveTask = {for (final task in data.tasks) task.id};
    nextTasks.addAll(tasks.where((task) => !haveTask.contains(task.id)));

    final nextDaily = [for (final item in data.daily) changedDaily[item.id] ?? item];
    final haveDaily = {for (final item in data.daily) item.id};
    nextDaily.addAll(daily.where((item) => !haveDaily.contains(item.id)));

    final nextChecks = _flat(data.checks);
    for (final key in removedChecks) {
      nextChecks.remove(key);
    }
    for (final check in checks) {
      nextChecks[(day: check.day, itemId: check.itemId)] = check.doneAt;
    }

    return RoutineData(tasks: nextTasks, daily: nextDaily, checks: _nested(nextChecks));
  }

  /// Pieces of at most [size] rows, for a phone with more to send than one
  /// request takes. Never empty: with nothing to send, the one piece is the
  /// request that only reads.
  List<RoutineChanges> chunked(int size) {
    if (rows <= size) return [this];

    // Every row in one list so it can be cut anywhere, then sorted back into
    // its kind.
    final all = <Object>[...tasks, ...daily, ...checks, ...removedTasks, ...removedChecks];
    return [
      for (var start = 0; start < all.length; start += size)
        () {
          final piece = all.sublist(start, min(all.length, start + size));
          return RoutineChanges(
            tasks: piece.whereType<RoutineTask>().toList(),
            daily: piece.whereType<DailyRoutineItem>().toList(),
            checks: piece.whereType<RoutineCheck>().toList(),
            removedTasks: piece.whereType<String>().toList(),
            removedChecks: piece.whereType<RoutineCheckKey>().toList(),
          );
        }(),
    ];
  }

  /// The request body.
  Json toJson(String since) => {
    'since': since,
    'tasks': [for (final task in tasks) _taskBody(task)],
    'daily': [for (final item in daily) _dailyBody(item)],
    'checks': [for (final check in checks) check.toJson()],
    'removedTasks': removedTasks,
    'removedChecks': [
      for (final check in removedChecks) {'itemId': check.itemId, 'day': check.day},
    ],
  };

  static Json _taskBody(RoutineTask task) => {
    ...task.toJson(),
    'title': routineTitle(task.title),
  };

  static Json _dailyBody(DailyRoutineItem item) => {
    ...item.toJson(),
    'title': routineTitle(item.title),
  };

  static Map<RoutineCheckKey, int?> _flat(DailyChecks checks) => {
    for (final day in checks.entries)
      for (final mark in day.value.entries) (day: day.key, itemId: mark.key): mark.value,
  };

  static DailyChecks _nested(Map<RoutineCheckKey, int?> flat) {
    final checks = <String, Map<String, int?>>{};
    for (final entry in flat.entries) {
      (checks[entry.key.day] ??= {})[entry.key.itemId] = entry.value;
    }
    return checks;
  }
}

/// What the phone holds once the server has answered a sync.
typedef RoutineMerge = ({RoutineData merged, RoutineData base});

/// Works out the routine after a sync.
///
/// [sent] is what the phone had when it sent its changes, [now] what it has as
/// the answer arrives, and [server] the answer: the whole daily routine, and
/// the tasks and ticks from [since] on, as they stand after the changes were
/// applied.
///
/// - Every day from [since] on is the server's version. That is how a task
///   added on another phone arrives, and how one removed there goes. The
///   server already holds what this phone sent, so nothing is lost by it.
/// - Days before [since] are the phone's own: the server was not asked for
///   them, so not hearing of a task there says nothing about it.
/// - Edits made while the request was on its way are laid back on top, and
///   go up with the next sync.
///
/// `base` is the new point the next sync measures from: the server's answer,
/// plus the old days the phone just sent.
RoutineMerge mergeSynced({
  required RoutineData sent,
  required RoutineData now,
  required RoutineData server,
  required String since,
}) {
  final base = RoutineData(
    tasks: [
      ...server.tasks,
      ...sent.tasks.where((task) => task.day.compareTo(since) < 0),
    ],
    daily: server.daily,
    checks: {
      ...server.checks,
      for (final entry in sent.checks.entries)
        if (entry.key.compareTo(since) < 0) entry.key: entry.value,
    },
  );
  return (merged: RoutineChanges.between(sent, now).applyTo(base), base: base);
}
