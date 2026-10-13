import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/widgets.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../services/firebase_service.dart';
import '../../services/local_push_service.dart';

/// Draws a push as a notification while the app is open (Android).
///
/// Android draws a push by itself only with the app closed or in the
/// background; while it is open the message reaches the app and nothing is
/// shown. This listens for those and hands each to [LocalPushService]. It sits
/// above the router (`MaterialApp.builder`) so it is there on every screen, and
/// it is a widget, not a service call at launch, because the channel's name is
/// words and words come from the context's locale.
class PushForeground extends StatefulWidget {
  const PushForeground({required this.child, super.key});

  final Widget child;

  @override
  State<PushForeground> createState() => _PushForegroundState();
}

class _PushForegroundState extends State<PushForeground> {
  StreamSubscription<RemoteMessage>? _arrivals;
  String? _channelName;

  @override
  void initState() {
    super.initState();
    if (!LocalPushService.instance.isSupported || !FirebaseService.instance.isAvailable) return;
    _arrivals = FirebaseMessaging.onMessage.listen(_arrived);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Also when the app language changes, which renames the channel.
    _channelName = AppLocalizations.of(context).pushChannelName;
    if (_arrivals != null) unawaited(LocalPushService.instance.ensureChannel(_channelName!));
  }

  void _arrived(RemoteMessage message) {
    final notification = message.notification;
    final channelName = _channelName;
    // A message with no notification part is data for the app, not for the tray.
    if (notification == null || channelName == null) return;

    unawaited(LocalPushService.instance.show(
      channelName: channelName,
      title: notification.title,
      body: notification.body,
      imageUrl: notification.android?.imageUrl,
      data: message.data,
    ));
  }

  @override
  void dispose() {
    unawaited(_arrivals?.cancel());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
