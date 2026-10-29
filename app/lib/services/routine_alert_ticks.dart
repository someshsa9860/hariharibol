import 'dart:convert';
import 'dart:isolate';
import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/constants/routine_config.dart';
import '../models/routine_task.dart';

/// A task ticked from the button on its alert (`RoutineAlerts`), waiting for the
/// app to write it into the routine.
class RoutineAlertTick {
  const RoutineAlertTick({required this.taskId, required this.day, required this.at});

  final String taskId;

  /// The day the task belongs to, as [routineDayKey].
  final String day;

  /// When the button was pressed.
  final DateTime at;

  /// The time to tick the task at, in minutes after midnight of its own day. A
  /// press made after midnight is the end of that day, not the small hours of the
  /// next one.
  int get minute => routineDayKey(at) == day ? routineMinuteOf(at) : RoutineConfig.minutesPerDay - 1;
}

/// Where a press of an alert's "Mark as done" waits for the app.
///
/// On Android a button that does not open the app runs in an isolate of its own
/// ([routineAlertBackground]), which has no way into the routine: it lives in
/// Hive, opened by the app's isolate only. So the press is written here — one key
/// each, so two presses never overwrite one another and nothing is read before it
/// is written — and the app takes them ([take]) when it opens, when it comes back
/// to the front, and at once when it is already open ([ping] / [listen]).
///
/// On iOS `AppDelegate` writes the same key itself, in the same store, and tells
/// an open app over [RoutineConfig.alertChannel] ("ticked"): no Dart has to start
/// for a press.
///
/// Taking is safe to repeat and the routine ignores a task that is already done,
/// so a press can never be counted twice.
class RoutineAlertTicks {
  RoutineAlertTicks._();

  /// `yyyy-mm-dd`, what [routineDayKey] makes.
  static const int _dayKeyLength = 10;

  static String _key(String day, String taskId) => '${RoutineConfig.alertTickPrefix}$day.$taskId';

  /// Remembers a press.
  static Future<void> record({required String taskId, required String day, required DateTime at}) async {
    try {
      await SharedPreferencesAsync().setInt(_key(day, taskId), at.millisecondsSinceEpoch);
    } catch (error) {
      debugPrint('A routine alert press could not be saved: $error');
    }
  }

  /// Every press waiting, oldest first, and forgets them.
  static Future<List<RoutineAlertTick>> take() async {
    try {
      final preferences = SharedPreferencesAsync();
      final waiting = <RoutineAlertTick>[];
      final stored = await preferences.getAll();
      for (final entry in stored.entries) {
        if (!entry.key.startsWith(RoutineConfig.alertTickPrefix)) continue;
        await preferences.remove(entry.key);
        final tick = _read(entry.key, entry.value);
        if (tick != null) waiting.add(tick);
      }
      return waiting..sort((a, b) => a.at.compareTo(b.at));
    } catch (error) {
      debugPrint('Routine alert presses could not be read: $error');
      return const [];
    }
  }

  /// `routine.alertTick.<day>.<task id>` back into a press. A day is always
  /// `yyyy-mm-dd`, so what follows its dot is the task's id, dots and all.
  static RoutineAlertTick? _read(String key, Object? value) {
    final rest = key.substring(RoutineConfig.alertTickPrefix.length);
    if (value is! int || rest.length <= _dayKeyLength + 1 || rest[_dayKeyLength] != '.') return null;
    return RoutineAlertTick(
      day: rest.substring(0, _dayKeyLength),
      taskId: rest.substring(_dayKeyLength + 1),
      at: DateTime.fromMillisecondsSinceEpoch(value),
    );
  }

  /// Tells the app's isolate, if it is running, that a press was written.
  static void ping() => IsolateNameServer.lookupPortByName(RoutineConfig.alertPortName)?.send(true);

  /// `AppDelegate`'s side, iOS only.
  static const MethodChannel _ios = MethodChannel(RoutineConfig.alertChannel);

  static bool get _onIos => !kIsWeb && defaultTargetPlatform == TargetPlatform.iOS;

  /// Calls [onPress] whenever another isolate [ping]s, or on iOS `AppDelegate`
  /// says a press was written. Pass the returned port to [stopListening] to stop.
  static ReceivePort listen(VoidCallback onPress) {
    // A port left by a previous run of this isolate (a hot restart) is replaced.
    IsolateNameServer.removePortNameMapping(RoutineConfig.alertPortName);
    final port = ReceivePort()..listen((_) => onPress());
    IsolateNameServer.registerPortWithName(port.sendPort, RoutineConfig.alertPortName);
    if (_onIos) {
      _ios.setMethodCallHandler((call) async {
        if (call.method == 'ticked') onPress();
      });
    }
    return port;
  }

  /// Stops [listen]ing.
  static void stopListening(ReceivePort port) {
    IsolateNameServer.removePortNameMapping(RoutineConfig.alertPortName);
    port.close();
    if (_onIos) _ios.setMethodCallHandler(null);
  }
}

/// Runs when a button on an alert is pressed and the app is not asked to open — in
/// its own isolate, so it starts what it needs itself. Registered with the plugin
/// in `LocalPushService`. Android only: on iOS the press never reaches the plugin
/// (`AppDelegate` answers it).
@pragma('vm:entry-point')
Future<void> routineAlertBackground(NotificationResponse response) async {
  if (response.actionId != RoutineConfig.alertDoneActionId) return;
  DartPluginRegistrant.ensureInitialized();
  try {
    final payload = jsonDecode(response.payload ?? '');
    if (payload is! Map) return;
    final taskId = payload[RoutineConfig.alertTaskKey]?.toString();
    final day = payload[RoutineConfig.alertDayKey]?.toString();
    if (taskId == null || taskId.isEmpty || day == null || day.isEmpty) return;
    await RoutineAlertTicks.record(taskId: taskId, day: day, at: DateTime.now());
    RoutineAlertTicks.ping();
  } catch (error) {
    debugPrint('A routine alert press could not be handled: $error');
  }
}
