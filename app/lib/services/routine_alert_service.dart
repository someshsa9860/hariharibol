import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/timezone.dart' as tz;

import '../core/constants/push_config.dart';
import '../core/constants/routine_config.dart';
import '../core/theme/app_colors.dart';
import '../models/routine_data.dart';
import '../models/routine_task.dart';
import 'local_push_service.dart';
import 'routine_alert_plan.dart';

/// The words on an alert, picked by a widget with a locale — this service writes
/// none (see `RoutineAlerts`).
class RoutineAlertWords {
  const RoutineAlertWords({required this.channelName, required this.body, required this.doneLabel});

  final String channelName;

  /// Under the task's own name.
  final String body;

  /// The button.
  final String doneLabel;

  String get signature => '$channelName|$body|$doneLabel';
}

/// Sets the routine's alerts: one notification, at the minute each task's time
/// range opens, with a "Mark as done" button (Android).
///
/// They are scheduled on the phone with the system's alarm clock, so they come
/// with no connection and with the app closed, and the plan is worked out from
/// the routine kept on the phone ([planRoutineAlerts]) — no server is involved.
/// Whenever the routine changes the plan is made again: alerts that are no
/// longer wanted (a task ticked, removed, or given another time) are cancelled
/// and the rest set again. They are set by the **moment** they go off, in UTC, so
/// the phone changing time zone never moves them.
///
/// The system may hold an alert a few minutes (`inexactAllowWhileIdle`): an exact
/// alarm needs a permission readers are asked for in settings, and a task's range
/// opening a little late is no loss.
///
/// Calls queue: each one is a plan of its own, and running two at once would set
/// and cancel against each other.
class RoutineAlertService {
  RoutineAlertService._();

  static final RoutineAlertService instance = RoutineAlertService._();

  Future<void> _queue = Future.value();

  /// What is set at the moment — the words and every alert — so a pass that would
  /// change nothing does nothing.
  String? _set;

  /// Only Android draws these (see `LocalPushService.isSupported`).
  bool get isSupported => LocalPushService.instance.isSupported;

  /// Makes what is set match [data]. [now] is for tests.
  Future<void> sync(RoutineData data, RoutineAlertWords words, {DateTime? now}) =>
      _enqueue(() => _sync(data, words, now ?? DateTime.now()));

  /// Takes every alert away — someone signed out.
  Future<void> cancelAll() => _enqueue(_cancelAll);

  Future<void> _enqueue(Future<void> Function() job) {
    return _queue = _queue.then((_) => job()).catchError((Object error) {
      // An alert that could not be set must never reach the reader as an error.
      debugPrint('Routine alerts could not be set: $error');
    });
  }

  Future<void> _sync(RoutineData data, RoutineAlertWords words, DateTime now) async {
    final plugin = await LocalPushService.instance.started();
    final android = plugin?.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    if (plugin == null || android == null) return;

    // A reader who turned notifications off gets no alarms set for nothing. The
    // next pass after they turn them on sets them.
    if (await android.areNotificationsEnabled() == false) {
      _set = null;
      return;
    }

    // An alert already on the screen for a task that has since been done (in the
    // app, or on another phone) is taken down.
    await _clearAnswered(plugin, android, data);

    final plan = planRoutineAlerts(data, now);
    final signature = '${words.signature}\n${plan.map((alert) => alert.signature).join('\n')}';
    if (signature == _set) return;

    await android.createNotificationChannel(
      AndroidNotificationChannel(RoutineConfig.alertChannelId, words.channelName, importance: Importance.high),
    );

    final wanted = {for (final alert in plan) alert.id};
    for (final pending in await plugin.pendingNotificationRequests()) {
      if (_isAlert(pending.id) && !wanted.contains(pending.id)) await plugin.cancel(id: pending.id);
    }

    for (final alert in plan) {
      await plugin.zonedSchedule(
        id: alert.id,
        title: alert.title,
        body: words.body,
        // A moment, not a wall-clock time: UTC needs no time-zone database.
        scheduledDate: tz.TZDateTime.from(alert.at, tz.UTC),
        payload: alert.payload,
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        notificationDetails: NotificationDetails(
          android: AndroidNotificationDetails(
            RoutineConfig.alertChannelId,
            words.channelName,
            icon: PushConfig.androidSmallIcon,
            color: AppColors.saffron,
            importance: Importance.high,
            priority: Priority.high,
            category: AndroidNotificationCategory.reminder,
            actions: [
              AndroidNotificationAction(
                RoutineConfig.alertDoneActionId,
                words.doneLabel,
                // Pressed, it ticks the task and goes away without opening the app.
                showsUserInterface: false,
                cancelNotification: true,
              ),
            ],
          ),
        ),
      );
    }
    _set = signature;
  }

  Future<void> _cancelAll() async {
    final plugin = await LocalPushService.instance.started();
    if (plugin == null) return;
    for (final pending in await plugin.pendingNotificationRequests()) {
      if (_isAlert(pending.id)) await plugin.cancel(id: pending.id);
    }
    final android = plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    for (final shown in await android?.getActiveNotifications() ?? const <ActiveNotification>[]) {
      final id = shown.id;
      if (id != null && _isAlert(id)) await plugin.cancel(id: id);
    }
    _set = null;
  }

  /// Cancels each alert in the tray whose task is done or gone.
  Future<void> _clearAnswered(
    FlutterLocalNotificationsPlugin plugin,
    AndroidFlutterLocalNotificationsPlugin android,
    RoutineData data,
  ) async {
    for (final shown in await android.getActiveNotifications()) {
      final id = shown.id;
      if (id == null || !_isAlert(id)) continue;
      final task = _taskOf(shown.payload, data);
      if (task == null || task.isDone) await plugin.cancel(id: id);
    }
  }

  /// The task an alert's payload names, as the routine has it now.
  static RoutineTask? _taskOf(String? payload, RoutineData data) {
    try {
      final decoded = jsonDecode(payload ?? '');
      if (decoded is! Map) return null;
      final taskId = decoded[RoutineConfig.alertTaskKey]?.toString();
      final day = decoded[RoutineConfig.alertDayKey]?.toString();
      if (taskId == null || day == null) return null;
      for (final task in data.on(day)) {
        if (task.id == taskId) return task;
      }
    } catch (_) {
      // Not one of ours.
    }
    return null;
  }

  static bool _isAlert(int id) => id >= RoutineConfig.alertIdBase;
}
