import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../network/api_client.dart';

// NOTE: flutter_local_notifications is NOT in pubspec.yaml.
// To enable daily 6 AM Verse of Day local notifications (Task D), first run:
//   flutter pub add flutter_local_notifications
// then implement scheduleVerseOfDayNotification() below.

final scaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();

@pragma('vm:entry-point')
Future<void> _onBackgroundMessage(RemoteMessage message) async {
  await Firebase.initializeApp();
}

class NotificationService {
  static final NotificationService instance = NotificationService._();
  NotificationService._();

  final _messaging = FirebaseMessaging.instance;
  GoRouter? _router;

  Future<void> initialize(GoRouter router) async {
    _router = router;

    FirebaseMessaging.onBackgroundMessage(_onBackgroundMessage);

    await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    await _registerTokenAndTopics();

    FirebaseMessaging.onMessage.listen(_handleForeground);
    FirebaseMessaging.onMessageOpenedApp.listen(_handleTap);

    final initial = await _messaging.getInitialMessage();
    if (initial != null) _handleTap(initial);
  }

  Future<void> _registerTokenAndTopics() async {
    try {
      final token = await _messaging.getToken();
      if (token == null) return;
      final platform = Platform.isIOS ? 'ios' : 'android';
      await ApiClient.createDio().post(
        '/api/v1/users/me/fcm-token',
        data: {'token': token, 'platform': platform},
      );
    } catch (_) {}

    try {
      await _messaging.subscribeToTopic('verse-of-day');
      await _messaging.subscribeToTopic('announcements');
    } catch (_) {}
  }

  void _handleForeground(RemoteMessage message) {
    final n = message.notification;
    if (n == null) return;
    scaffoldMessengerKey.currentState?.showSnackBar(
      SnackBar(
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              n.title ?? 'HariHariBol',
              style: const TextStyle(
                  fontWeight: FontWeight.bold, color: Colors.white),
            ),
            if (n.body != null)
              Text(
                n.body!,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style:
                    const TextStyle(color: Colors.white70, fontSize: 13),
              ),
          ],
        ),
        behavior: SnackBarBehavior.floating,
        backgroundColor: const Color(0xFF7B1C1C),
        duration: const Duration(seconds: 4),
        action: SnackBarAction(
          label: 'View',
          textColor: const Color(0xFFD4A055),
          onPressed: () => _handleTap(message),
        ),
      ),
    );
  }

  void _handleTap(RemoteMessage message) {
    if (_router == null) return;
    final data = message.data;
    final type = data['type'] as String? ?? '';
    switch (type) {
      case 'verse':
        final id = data['id'] as String?;
        if (id != null) _router!.push('/verse/$id');
        break;
      case 'verse_of_day':
        _router!.push('/verse-of-day');
        break;
      case 'mantra':
        final id = data['id'] as String?;
        if (id != null) _router!.push('/mantra/$id');
        break;
      default:
        _router!.push('/notifications');
    }
  }

  // Placeholder for daily local notification — requires flutter_local_notifications.
  Future<void> scheduleVerseOfDayNotification({
    required String versePreview,
  }) async {
    // TODO: implement after: flutter pub add flutter_local_notifications
  }
}
