import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../core/constants/api_paths.dart';
import '../core/constants/push_config.dart';
import '../core/session/app_session.dart';
import 'api_client.dart';
import 'device_service.dart';
import 'firebase_service.dart';

/// Push, for the times the app is not on screen. While it is open the websocket carries everything and the
/// server holds pushes back (it is told the app is in the foreground), so nothing here draws a banner of its own.
///
/// The backend sends ordinary notification messages — the system draws them while the app is closed or in the
/// background — so no background handler is needed. A tap arrives here and becomes a route in [onRoute].
class PushService {
  PushService._();

  static final PushService instance = PushService._();

  final ApiClient _api = ApiClient.instance;

  /// Set by the router: where a tapped push should lead (`/live`, `/chats/<id>`, `/tickets/<id>`).
  void Function(String route)? onRoute;

  String? _pendingRoute;

  Future<void> init() async {
    if (!FirebaseService.instance.isAvailable) return;
    try {
      final messaging = FirebaseMessaging.instance;
      messaging.onTokenRefresh.listen(_sendToken);
      FirebaseMessaging.onMessageOpenedApp.listen(_tapped);
      final launchedBy = await messaging.getInitialMessage();
      if (launchedBy != null) _tapped(launchedBy);
    } catch (error) {
      debugPrint('Push setup failed: $error');
    }
  }

  /// A push that opened the app before the router existed waits here until [takePendingRoute] collects it.
  String? takePendingRoute() {
    final route = _pendingRoute;
    _pendingRoute = null;
    return route;
  }

  void _tapped(RemoteMessage message) {
    final route = routeFor(message.data);
    if (route == null) return;
    final handler = onRoute;
    if (handler == null) {
      _pendingRoute = route;
    } else {
      handler(route);
    }
  }

  /// The screen a push's `data` names, or null.
  @visibleForTesting
  static String? routeFor(Map<String, dynamic> data) {
    final link = data[PushConfig.deeplinkKey]?.toString() ?? '';
    if (link.startsWith(PushConfig.chatPrefix)) {
      final id = link.substring(PushConfig.chatPrefix.length);
      return id.isEmpty ? null : '/chats/$id';
    }
    if (link.startsWith(PushConfig.ticketPrefix)) {
      final id = link.substring(PushConfig.ticketPrefix.length);
      return id.isEmpty ? null : '/tickets/$id';
    }
    if (link == PushConfig.feed) return '/live';
    return null;
  }

  Future<void> registerAfterSignIn() async {
    if (!FirebaseService.instance.isAvailable) return;
    try {
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission();
      final token = await messaging.getToken();
      if (token != null) await _sendToken(token);
    } catch (error) {
      debugPrint('FCM token fetch failed: $error');
    }
  }

  /// On sign-out: the old token is invalidated, so this phone stops receiving the developer's alerts.
  Future<void> unregister() async {
    if (!FirebaseService.instance.isAvailable) return;
    try {
      await FirebaseMessaging.instance.deleteToken();
    } catch (error) {
      debugPrint('FCM token delete failed: $error');
    }
  }

  Future<void> _sendToken(String token) async {
    if (!AppSession.instance.isSignedIn) return;
    try {
      // `app: dev` marks this installation as the companion app, so the reader's pushes never land here
      // and the developer's alerts never land on the reader's phone.
      await _api.post(ApiPaths.devices, attested: true, body: {...DeviceService.instance.fields, 'fcmToken': token, 'app': 'dev'});
    } catch (error) {
      // A failed registration costs pushes, not the app.
      debugPrint('FCM token registration failed: $error');
    }
  }
}
