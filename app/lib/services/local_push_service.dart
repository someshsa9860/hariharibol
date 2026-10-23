import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../core/constants/push_config.dart';
import '../core/theme/app_colors.dart';
import 'push_link.dart';
import 'routine_alert_ticks.dart';

/// Draws a push as a notification while the app is open.
///
/// Android shows a push by itself only when the app is closed or in the
/// background; with the app on screen it hands the message to the app and draws
/// nothing. This draws it then, so a daily sloka that arrives while someone is
/// reading is still seen, with its picture, and can be tapped. iOS does not need
/// this — `setForegroundNotificationPresentationOptions` (in `FcmService`) makes
/// the system draw it.
///
/// Also draws the pushes that carry action buttons, which reach Android as data
/// only (`backend/utils/push-message.js`): FCM cannot draw buttons, so the app
/// does, from [pushBackgroundHandler] when it is not open and from
/// `PushForeground` when it is. A button press opens the app at that button's own
/// link ([PushLinks.tapped] with an `actionId`).
///
/// **Writes no words.** The channels' names are passed in by a widget that has a
/// `BuildContext` ([ensureChannels], [show]); the title and body are the push's.
class LocalPushService {
  LocalPushService._();

  static final LocalPushService instance = LocalPushService._();

  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();

  /// A plain client: the picture's link is presigned, and an `Authorization`
  /// header on it would make S3 refuse it.
  final Dio _dio = Dio(BaseOptions(
    connectTimeout: PushConfig.imageConnectTimeout,
    receiveTimeout: PushConfig.imageReceiveTimeout,
  ));

  Future<bool>? _ready;
  String? _channelName;
  String? _quietChannelName;
  int _nextId = 0;

  /// Only Android needs this (see above).
  bool get isSupported => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  /// Starts the plugin once. False when it could not start; every call after
  /// that gets the same answer.
  Future<bool> _init() => _ready ??= _start();

  Future<bool> _start() async {
    if (!isSupported) return false;
    try {
      await _plugin.initialize(
        settings: const InitializationSettings(
          android: AndroidInitializationSettings(PushConfig.androidSmallIcon),
        ),
        onDidReceiveNotificationResponse: (response) => _tapped(response.payload, response.actionId),
        // A button that does not open the app — a routine alert's "Mark as done" —
        // is answered here, in an isolate of its own.
        onDidReceiveBackgroundNotificationResponse: routineAlertBackground,
      );

      // A notification drawn here and tapped after the app was closed starts it
      // with the tap as the launch reason.
      final launch = await _plugin.getNotificationAppLaunchDetails();
      if (launch?.didNotificationLaunchApp ?? false) {
        _tapped(launch?.notificationResponse?.payload, launch?.notificationResponse?.actionId);
      }
      return true;
    } catch (error) {
      debugPrint('Local notifications could not start: $error');
      return false;
    }
  }

  /// The plugin, started, for the routine alerts to schedule on — there is one
  /// plugin per app and a second `initialize` would replace this one's callbacks.
  /// Null where notifications are not drawn by the app, or could not start.
  Future<FlutterLocalNotificationsPlugin?> started() async => await _init() ? _plugin : null;

  /// Makes sure both push channels exist, so a push drawn by the system — app
  /// closed — is on a channel the reader can recognise in settings and that
  /// appears on screen. `default` pops up with sound; `updates` is the quiet one
  /// an admin's "quiet" push names. Safe to repeat: it renames, and leaves alone
  /// whatever the reader has set on them.
  Future<void> ensureChannels(String name, String quietName) async {
    if (name == _channelName && quietName == _quietChannelName) return;
    if (!await _init()) return;
    try {
      final android =
          _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      await android?.createNotificationChannel(
        AndroidNotificationChannel(PushConfig.androidChannelId, name, importance: Importance.high),
      );
      await android?.createNotificationChannel(
        AndroidNotificationChannel(PushConfig.androidQuietChannelId, quietName, importance: Importance.low),
      );
      _channelName = name;
      _quietChannelName = quietName;
    } catch (error) {
      debugPrint('Push channels could not be created: $error');
    }
  }

  /// Shows a push that arrived while the app was open, or a data-only one with
  /// buttons. [data] is the push's payload and comes back, to open what it points
  /// at, when the reader taps.
  ///
  /// `style` in the payload is `text` for the whole body with no picture;
  /// anything else draws the picture big when there is one. `importance` is
  /// `quiet` for the quiet channel. The two buttons come from `actions`.
  Future<void> show({
    required String channelName,
    String? quietChannelName,
    required Map<String, dynamic> data,
    String? title,
    String? body,
    String? imageUrl,
  }) async {
    if (!await _init()) return;
    if (quietChannelName != null) await ensureChannels(channelName, quietChannelName);

    final quiet = data[PushConfig.importanceKey]?.toString() == PushConfig.importanceQuiet;
    final bigText = data[PushConfig.styleKey]?.toString() == PushConfig.styleText;
    final channelId = quiet ? PushConfig.androidQuietChannelId : PushConfig.androidChannelId;

    try {
      final picture = imageUrl == null || bigText ? null : await _fetch(imageUrl);
      await _plugin.show(
        id: _nextId++,
        title: title,
        body: body,
        payload: jsonEncode(data),
        notificationDetails: NotificationDetails(
          android: AndroidNotificationDetails(
            channelId,
            channelName,
            icon: PushConfig.androidSmallIcon,
            color: AppColors.saffron,
            importance: quiet ? Importance.low : Importance.high,
            priority: quiet ? Priority.low : Priority.high,
            // The expanded form carries the whole body (the verse and its
            // meaning), with the picture above it when there is one.
            styleInformation: picture == null
                ? BigTextStyleInformation(body ?? '', contentTitle: title)
                : BigPictureStyleInformation(
                    ByteArrayAndroidBitmap(picture),
                    contentTitle: title,
                    summaryText: body,
                  ),
            actions: [
              for (final action in pushActions(data))
                AndroidNotificationAction(
                  action.id,
                  action.label,
                  // The button opens the app, at its own link.
                  showsUserInterface: true,
                  cancelNotification: true,
                ),
            ],
          ),
        ),
      );
    } catch (error) {
      debugPrint('Push could not be shown: $error');
    }
  }

  /// The picture's bytes, or null — a push with no picture is still a push.
  Future<Uint8List?> _fetch(String url) async {
    try {
      final response = await _dio.get<List<int>>(url, options: Options(responseType: ResponseType.bytes));
      final bytes = response.data;
      if (bytes == null || bytes.isEmpty || bytes.length > PushConfig.imageMaxBytes) return null;
      return Uint8List.fromList(bytes);
    } catch (error) {
      debugPrint('Push picture could not be fetched: $error');
      return null;
    }
  }

  void _tapped(String? payload, String? actionId) {
    if (payload == null || payload.isEmpty) return;
    try {
      final data = jsonDecode(payload);
      if (data is Map) {
        // An empty action id is the notification itself, not a button.
        PushLinks.instance.tapped(Map<String, dynamic>.from(data),
            actionId: actionId == null || actionId.isEmpty ? null : actionId);
      }
    } catch (error) {
      debugPrint('Push tap payload unreadable: $error');
    }
  }
}

/// Runs when a data-only push (one with buttons) arrives with the app closed or
/// in the background — in its own isolate, so it starts what it needs itself.
/// A push FCM draws (the usual kind) never reaches this.
///
/// The channels already exist: the app creates them whenever it is opened, and
/// no push can be sent to a phone that has not opened it. So the names here are
/// only a fallback and are the ids.
@pragma('vm:entry-point')
Future<void> pushBackgroundHandler(RemoteMessage message) async {
  final data = message.data;
  if (message.notification != null) return;
  final title = data[PushConfig.titleKey]?.toString();
  final body = data[PushConfig.bodyKey]?.toString();
  if (title == null && body == null) return;

  await LocalPushService.instance.show(
    channelName: PushConfig.androidChannelId,
    data: data,
    title: title,
    body: body,
    imageUrl: data[PushConfig.imageKey]?.toString(),
  );
}
