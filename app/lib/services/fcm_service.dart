import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../core/constants/api_paths.dart';
import '../core/session/app_session.dart';
import 'api_client.dart';
import 'device_service.dart';
import 'firebase_service.dart';

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
  /// user and a reason. All this does is listen for rotations.
  Future<void> init() async {
    if (!FirebaseService.instance.isAvailable) return;

    try {
      FirebaseMessaging.instance.onTokenRefresh.listen(_sendToken);
    } catch (error) {
      debugPrint('Push setup failed: $error');
    }
  }

  Future<void> _sendToken(String token) async {
    if (!AppSession.instance.isSignedIn) return;

    try {
      await _api.patch(ApiPaths.fcmToken, body: {
        'deviceId': DeviceService.instance.deviceId,
        'fcmToken': token,
      });
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
