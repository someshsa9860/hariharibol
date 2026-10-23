import 'dart:convert';

import '../core/constants/push_config.dart';
import '../core/constants/routine_config.dart';
import '../models/routine_data.dart';
import '../models/routine_task.dart';

/// One alert: a notification, at the minute a task's time range opens, for one
/// task on one day.
class RoutineAlert {
  const RoutineAlert({required this.taskId, required this.day, required this.title, required this.at});

  final String taskId;

  /// The day the task belongs to, as [routineDayKey].
  final String day;
  final String title;

  /// When it goes off, in the phone's own time.
  final DateTime at;

  /// The same alert always has the same id, so setting it again replaces it and
  /// the task's own notification can be found and cleared (see
  /// [RoutineConfig.alertIdBase]).
  int get id => RoutineConfig.alertIdBase + _hash('$day|$taskId') % RoutineConfig.alertIdSpan;

  /// What comes back when the notification, or its button, is pressed.
  String get payload => jsonEncode({
    RoutineConfig.alertTaskKey: taskId,
    RoutineConfig.alertDayKey: day,
    PushConfig.deeplinkKey: RoutineConfig.alertDeeplink,
  });

  /// 32-bit FNV-1a. `String.hashCode` is not the same from one run to the next,
  /// and an id has to survive the app being closed.
  static int _hash(String text) {
    const offsetBasis = 0x811c9dc5;
    const prime = 0x01000193;
    const mask = 0xFFFFFFFF;
    var hash = offsetBasis;
    for (final unit in utf8.encode(text)) {
      hash = ((hash ^ unit) * prime) & mask;
    }
    return hash;
  }

  /// Everything that makes this alert different from another, for telling
  /// whether what is set is still right.
  String get signature => '$id|${at.millisecondsSinceEpoch}|$title';
}

/// The alerts to set: one for each task of the next [RoutineConfig.alertDays]
/// days that has a time range, is not done, and whose range has not opened yet.
/// The nearest [RoutineConfig.alertMaxPending] are kept.
///
/// A task with no time range has no moment to be alerted at, so it gets none; a
/// done task needs none. A daily item gets one alert for each day it applies on.
List<RoutineAlert> planRoutineAlerts(RoutineData data, DateTime now) {
  final alerts = <RoutineAlert>[];
  for (var ahead = 0; ahead < RoutineConfig.alertDays; ahead++) {
    // Built from its parts, not by adding 24 hours, so a clock change never
    // moves it off its day.
    final day = DateTime(now.year, now.month, now.day + ahead);
    final key = routineDayKey(day);
    for (final task in data.on(key)) {
      final window = task.window;
      if (task.isDone || window == null) continue;
      final at = DateTime(day.year, day.month, day.day, 0, window.start);
      if (!at.isAfter(now)) continue;
      alerts.add(RoutineAlert(taskId: task.id, day: key, title: task.title, at: at));
    }
  }
  alerts.sort((a, b) => a.at.compareTo(b.at));
  return alerts.take(RoutineConfig.alertMaxPending).toList();
}
