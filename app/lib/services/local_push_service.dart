import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../core/constants/push_config.dart';
import '../core/theme/app_colors.dart';
import 'push_link.dart';

/// Draws a push as a notification while the app is open.
///
/// Android shows a push by itself only when the app is closed or in the
/// background; with the app on screen it hands the message to the app and draws
/// nothing. This draws it then, so a daily sloka that arrives while someone is
/// reading is still seen, with its picture, and can be tapped. iOS does not need
/// this — `setForegroundNotificationPresentationOptions` (in `FcmService`) makes
/// the system draw it.
///
/// **Writes no words.** The channel's name is passed in by a widget that has a
/// `BuildContext` ([ensureChannel], [show]); the title and body are the push's.
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
        onDidReceiveNotificationResponse: (response) => _tapped(response.payload),
      );

      // A notification drawn here and tapped after the app was closed starts it
      // with the tap as the launch reason.
      final launch = await _plugin.getNotificationAppLaunchDetails();
      if (launch?.didNotificationLaunchApp ?? false) {
        _tapped(launch?.notificationResponse?.payload);
      }
      return true;
    } catch (error) {
      debugPrint('Local notifications could not start: $error');
      return false;
    }
  }

  /// Makes sure the push channel exists under [name], so a push drawn by the
  /// system — app closed — is on a channel the reader can recognise in settings
  /// and that appears on screen. Safe to repeat: it renames, and leaves alone
  /// whatever the reader has set on it.
  Future<void> ensureChannel(String name) async {
    if (name == _channelName || !await _init()) return;
    try {
      await _plugin
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(
            AndroidNotificationChannel(PushConfig.androidChannelId, name, importance: Importance.high),
          );
      _channelName = name;
    } catch (error) {
      debugPrint('Push channel could not be created: $error');
    }
  }

  /// Shows a push that arrived while the app was open. [data] is the push's
  /// payload and comes back, to open what it points at, when the reader taps.
  Future<void> show({
    required String channelName,
    required Map<String, dynamic> data,
    String? title,
    String? body,
    String? imageUrl,
  }) async {
    if (!await _init()) return;
    await ensureChannel(channelName);

    try {
      final picture = imageUrl == null ? null : await _fetch(imageUrl);
      await _plugin.show(
        id: _nextId++,
        title: title,
        body: body,
        payload: jsonEncode(data),
        notificationDetails: NotificationDetails(
          android: AndroidNotificationDetails(
            PushConfig.androidChannelId,
            channelName,
            icon: PushConfig.androidSmallIcon,
            color: AppColors.saffron,
            importance: Importance.high,
            priority: Priority.high,
            // The expanded form carries the whole body (the verse and its
            // meaning), with the picture above it when there is one.
            styleInformation: picture == null
                ? BigTextStyleInformation(body ?? '', contentTitle: title)
                : BigPictureStyleInformation(
                    ByteArrayAndroidBitmap(picture),
                    contentTitle: title,
                    summaryText: body,
                  ),
          ),
        ),
      );
    } catch (error) {
      debugPrint('Push could not be shown while the app is open: $error');
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

  void _tapped(String? payload) {
    if (payload == null || payload.isEmpty) return;
    try {
      final data = jsonDecode(payload);
      if (data is Map) PushLinks.instance.tapped(Map<String, dynamic>.from(data));
    } catch (error) {
      debugPrint('Push tap payload unreadable: $error');
    }
  }
}
