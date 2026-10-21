import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../core/constants/api_paths.dart';
import '../core/constants/app_config.dart';
import '../core/session/app_session.dart';
import 'api_client.dart';
import 'device_service.dart';
import 'firebase_service.dart';
import 'push_analytics.dart';
import 'local_push_service.dart';
import 'push_actions.dart';
import 'push_link.dart';

/// Push.
///
/// The token is sent to the backend against this device's id, which is how a
/// daily sloka reaches the right install. It is refreshed on rotation, and the
/// call is skipped entirely when nobody is signed in — there is no user row to
/// attach it to.
class FcmService {
  FcmService._();

  static final FcmService instance = FcmService._();

  final ApiClient _api = ApiClient.instance;

  /// Called at launch. Deliberately does not ask for permission.
  ///
  /// iOS gives one chance at that prompt for the life of the install, and at
  /// launch there is nobody signed in to attach a token to — the request would
  /// be spent on a person still looking at the sign-in screen, with the dialog
  /// covering it. Asking happens in [registerAfterSignIn], where there is a
  /// user and a reason. All this does is listen for rotations, and for a
  /// notification being tapped — handed to [PushLinks], which opens what it
  /// pointed at once the dashboard is up.
  ///
  /// A tap reaches the app one of two ways: while it was running in the
  /// background ([FirebaseMessaging.onMessageOpenedApp]), or it launched it from
  /// closed (`getInitialMessage`, which holds that one message). While the app
  /// is open Android shows no notification at all — `PushForeground` draws one
  /// then, and its tap is handled by [LocalPushService].
  Future<void> init() async {
    if (!FirebaseService.instance.isAvailable) return;

    try {
      final messaging = FirebaseMessaging.instance;
      // Pushes with buttons arrive as data only and are drawn by the app.
      FirebaseMessaging.onBackgroundMessage(pushBackgroundHandler);
      messaging.onTokenRefresh.listen(_sendToken);
      // iOS draws a push that arrives while the app is open only when asked to;
      // Android never does, which is what `PushForeground` is for.
      await messaging.setForegroundNotificationPresentationOptions(alert: true, badge: true, sound: true);
      FirebaseMessaging.onMessageOpenedApp.listen(_tapped);
      // The backend counts these: arrived while open, tapped, and time spent reading.
      FirebaseMessaging.onMessage.listen((message) => PushAnalytics.instance.delivered(message.data));
      PushLinks.instance.onTapped =
          (data, route) => PushAnalytics.instance.opened(data, screen: route);
      await PushActionChannel.instance.start();
      if (kDebugMode) await _logDelivery(messaging);

      final launchedBy = await messaging.getInitialMessage();
      if (launchedBy != null) _tapped(launchedBy);
    } catch (error) {
      debugPrint('Push setup failed: $error');
    }
  }

  void _tapped(RemoteMessage message) => PushLinks.instance.tapped(message.data);

  /// What `flutter run` shows about push, so "did it arrive?" has an answer.
  ///
  /// A message reaches this code only while the app is open, and Android draws
  /// nothing by itself then — a line here means it arrived (`PushForeground`
  /// then draws it). With the app in the background the system tray shows it
  /// without running any of this; `adb logcat -s FirebaseMessaging` is where
  /// that shows.
  ///
  /// The token is what `backend/scripts/sloka-push-demo.js --token` sends to.
  /// Debug builds only — a token has no business in a release build's log.
  Future<void> _logDelivery(FirebaseMessaging messaging) async {
    FirebaseMessaging.onMessage.listen((message) {
      final notification = message.notification;
      debugPrint(
        '[push] arrived while the app is open — title: ${notification?.title}, '
        'picture: ${notification?.android?.imageUrl ?? 'none'}, '
        'data: ${message.data}',
      );
    });
    messaging.onTokenRefresh.listen((token) => debugPrint('[push] token refreshed: $token'));

    try {
      debugPrint('[push] this build talks to ${AppConfig.apiBaseUrl}');
      debugPrint('[push] token: ${await messaging.getToken()}');
    } catch (error) {
      debugPrint('[push] could not read the token: $error');
    }
  }

  Future<void> _sendToken(String token) async {
    if (!AppSession.instance.isSignedIn) return;

    try {
      await _api.patch(ApiPaths.fcmToken, body: {
        'deviceId': DeviceService.instance.deviceId,
        'fcmToken': token,
      });
      if (kDebugMode) debugPrint('[push] token registered with ${AppConfig.apiBaseUrl}');
    } catch (error) {
      // A failed registration means one missed notification, not a broken app.
      debugPrint('FCM token registration failed: $error');
    }
  }

  /// Called after sign-in, when there is finally a user to attach the token to.
  ///
  /// This is the only place the permission prompt is raised, and the only place
  /// the token first reaches the backend — without this call the daily sloka
  /// never arrives, because the token fetched at launch had no account to be
  /// stored against.
  Future<void> registerAfterSignIn() async {
    if (!FirebaseService.instance.isAvailable) return;
    try {
      final messaging = FirebaseMessaging.instance;

      // iOS shows nothing without this. Android below 13 grants it silently.
      await messaging.requestPermission();

      final token = await messaging.getToken();
      if (token != null) await _sendToken(token);
    } catch (error) {
      debugPrint('FCM token fetch failed: $error');
    }
  }
}
