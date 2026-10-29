import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
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

/// Whether the routine's alerts can come at the very minute, and asking the
/// reader to allow it. What the routine screen's card needs, apart so a test can
/// fake it (`routineOnTimeAccessProvider`).
abstract interface class RoutineOnTimeAccess {
  /// True only where asking would change something: Android 12 or later, with
  /// notifications on and exact alarms not allowed.
  Future<bool> needed();

  /// Opens the system's page for it. True when the reader came back having
  /// allowed it.
  Future<bool> ask();
}

/// Sets the routine's alerts: one notification, at the minute each task's time
/// range opens, with a "Mark as done" button. Android and iOS.
///
/// They are scheduled on the phone, with the system's own alarm (Android's
/// `AlarmManager`, iOS's notification centre), so they come with no connection
/// and with the app closed, and the plan is worked out from the routine kept on
/// the phone ([planRoutineAlerts]) — no server is involved. Whenever the routine
/// changes the plan is made again: alerts that are no longer wanted (a task
/// ticked, removed, or given another time) are cancelled and the rest set again.
/// They are set by the **moment** they go off, in UTC, so the phone changing time
/// zone never moves them.
///
/// **On time, on Android.** An alert is an exact alarm
/// (`exactAllowWhileIdle`) when the reader has allowed the app to set them
/// (`SCHEDULE_EXACT_ALARM`: allowed by default up to Android 13, asked for in
/// settings from Android 14 — the routine screen's card, [RoutineOnTimeAccess]);
/// otherwise it is set inexact and Android may hold it a few minutes. The app
/// never declares `USE_EXACT_ALARM`, which Google Play keeps for alarm-clock and
/// calendar apps. iOS has no such switch: a notification it is given comes on
/// time. iOS keeps 64 waiting notifications an app at most, so it gets the
/// nearest [RoutineConfig.alertMaxPendingIos].
///
/// The button: Android draws it from the notification itself; iOS needs a
/// category, which `AppDelegate` registers when asked ([_registerCategory]) and
/// whose press it writes itself (see `routine_alert_ticks.dart`).
///
/// Calls queue: each one is a plan of its own, and running two at once would set
/// and cancel against each other.
class RoutineAlertService implements RoutineOnTimeAccess {
  RoutineAlertService._();

  static final RoutineAlertService instance = RoutineAlertService._();

  /// `AppDelegate`'s side, iOS only.
  static const MethodChannel _ios = MethodChannel(RoutineConfig.alertChannel);

  /// What the plugin answers when an exact alarm is set without leave — taken
  /// away between the check and the setting.
  static const String _exactRefused = 'exact_alarms_not_permitted';

  Future<void> _queue = Future.value();

  /// What is set at the moment — the words, whether they are exact, and every
  /// alert — so a pass that would change nothing does nothing.
  String? _set;

  /// The button's label the iOS category was last registered with.
  String? _category;

  /// The two platforms that set alarms on the phone (see
  /// `LocalPushService.canSchedule`).
  bool get isSupported => LocalPushService.instance.canSchedule;

  /// Makes what is set match [data]. [now] is for tests.
  Future<void> sync(RoutineData data, RoutineAlertWords words, {DateTime? now}) =>
      _enqueue(() => _sync(data, words, now ?? DateTime.now()));

  /// Takes every alert away — someone signed out.
  Future<void> cancelAll() => _enqueue(_cancelAll);

  @override
  Future<bool> needed() async {
    try {
      final android = await _android();
      if (android == null || await android.areNotificationsEnabled() == false) return false;
      return await android.canScheduleExactNotifications() == false;
    } catch (error) {
      debugPrint('Exact alarms could not be checked: $error');
      return false;
    }
  }

  @override
  Future<bool> ask() async {
    try {
      final allowed = await (await _android())?.requestExactAlarmsPermission() ?? false;
      // A pass now, so the alerts already set become exact ones.
      if (allowed) _set = null;
      return allowed;
    } catch (error) {
      debugPrint('Exact alarms could not be asked for: $error');
      return false;
    }
  }

  Future<AndroidFlutterLocalNotificationsPlugin?> _android() async => (await LocalPushService.instance.started())
      ?.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();

  Future<void> _enqueue(Future<void> Function() job) {
    return _queue = _queue.then((_) => job()).catchError((Object error) {
      // An alert that could not be set must never reach the reader as an error.
      debugPrint('Routine alerts could not be set: $error');
    });
  }

  Future<void> _sync(RoutineData data, RoutineAlertWords words, DateTime now) async {
    final plugin = await LocalPushService.instance.started();
    if (plugin == null) return;
    final android = plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    final ios = plugin.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>();
    if (android == null && ios == null) return;

    // A reader who turned notifications off gets no alarms set for nothing. The
    // next pass after they turn them on sets them.
    if (!await _enabled(android, ios)) {
      _set = null;
      return;
    }

    // An alert already on the screen for a task that has since been done (in the
    // app, or on another phone) is taken down.
    await _clearAnswered(plugin, data);

    var exact = await android?.canScheduleExactNotifications() ?? false;
    final plan = planRoutineAlerts(
      data,
      now,
      max: ios != null ? RoutineConfig.alertMaxPendingIos : RoutineConfig.alertMaxPending,
    );
    if (_signature(words, exact, plan) == _set) return;

    await android?.createNotificationChannel(
      AndroidNotificationChannel(RoutineConfig.alertChannelId, words.channelName, importance: Importance.high),
    );
    if (ios != null) await _registerCategory(words.doneLabel);

    final wanted = {for (final alert in plan) alert.id};
    for (final pending in await plugin.pendingNotificationRequests()) {
      if (_isAlert(pending.id) && !wanted.contains(pending.id)) await plugin.cancel(id: pending.id);
    }

    for (final alert in plan) {
      try {
        await _schedule(plugin, alert, words, exact: exact);
      } on PlatformException catch (error) {
        if (!exact || error.code != _exactRefused) rethrow;
        // Leave was taken away a moment ago: this one and the rest go inexact.
        exact = false;
        await _schedule(plugin, alert, words, exact: false);
      }
    }
    _set = _signature(words, exact, plan);
  }

  Future<void> _schedule(
    FlutterLocalNotificationsPlugin plugin,
    RoutineAlert alert,
    RoutineAlertWords words, {
    required bool exact,
  }) {
    return plugin.zonedSchedule(
      id: alert.id,
      title: alert.title,
      body: words.body,
      // A moment, not a wall-clock time: UTC needs no time-zone database.
      scheduledDate: tz.TZDateTime.from(alert.at, tz.UTC),
      payload: alert.payload,
      androidScheduleMode: exact ? AndroidScheduleMode.exactAllowWhileIdle : AndroidScheduleMode.inexactAllowWhileIdle,
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
        // Shown, with its sound, even while the app is open. The ordinary
        // interruption level: "time sensitive" needs an entitlement and a reason
        // App Review accepts.
        iOS: const DarwinNotificationDetails(
          categoryIdentifier: RoutineConfig.alertCategoryId,
          presentAlert: true,
          presentBanner: true,
          presentList: true,
          presentSound: true,
        ),
      ),
    );
  }

  static String _signature(RoutineAlertWords words, bool exact, List<RoutineAlert> plan) =>
      '${words.signature}|$exact\n${plan.map((alert) => alert.signature).join('\n')}';

  static Future<bool> _enabled(
    AndroidFlutterLocalNotificationsPlugin? android,
    IOSFlutterLocalNotificationsPlugin? ios,
  ) async {
    if (android != null) return await android.areNotificationsEnabled() != false;
    final options = await ios?.checkPermissions();
    return options == null || options.isEnabled || options.isProvisionalEnabled;
  }

  /// Puts the "Mark as done" button on iOS alerts. Registered by `AppDelegate`
  /// beside the categories already there (the push buttons'), never in place of
  /// them. Without it the alert still comes, with no button.
  Future<void> _registerCategory(String doneLabel) async {
    if (_category == doneLabel) return;
    try {
      await _ios.invokeMethod<void>('setCategory', {
        'id': RoutineConfig.alertCategoryId,
        'action': RoutineConfig.alertDoneActionId,
        'label': doneLabel,
      });
      _category = doneLabel;
    } catch (error) {
      debugPrint('The routine alert button could not be registered: $error');
    }
  }

  Future<void> _cancelAll() async {
    final plugin = await LocalPushService.instance.started();
    if (plugin == null) return;
    for (final pending in await plugin.pendingNotificationRequests()) {
      if (_isAlert(pending.id)) await plugin.cancel(id: pending.id);
    }
    for (final shown in await plugin.getActiveNotifications()) {
      final id = shown.id;
      if (id != null && _isAlert(id)) await plugin.cancel(id: id);
    }
    _set = null;
  }

  /// Cancels each alert on the screen whose task is done or gone.
  Future<void> _clearAnswered(FlutterLocalNotificationsPlugin plugin, RoutineData data) async {
    for (final shown in await plugin.getActiveNotifications()) {
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
