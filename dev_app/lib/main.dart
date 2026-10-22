import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/session/app_session.dart';
import 'services/device_service.dart';
import 'services/firebase_service.dart';
import 'services/push_service.dart';

/// Boot. Only what the first frame depends on is awaited: the device facts and the stored session. Firebase and
/// push start in the background — neither is needed to draw a screen.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Future.wait([
    DeviceService.instance.init(),
    AppSession.instance.restore(),
  ]);

  unawaited(_startPush());

  runApp(const ProviderScope(child: DevApp()));
}

Future<void> _startPush() async {
  await FirebaseService.instance.init();
  await PushService.instance.init();
  if (AppSession.instance.isSignedIn) await PushService.instance.registerAfterSignIn();
}
