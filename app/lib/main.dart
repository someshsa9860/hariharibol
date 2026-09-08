import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/session/app_session.dart';
import 'services/device_service.dart';
import 'services/fcm_service.dart';
import 'services/firebase_service.dart';
import 'services/local_store.dart';
import 'services/tracking_service.dart';

/// Boot.
///
/// Only the work the first frame genuinely depends on is awaited: the local
/// store, the device facts every request carries, and the session. Push and
/// analytics start in the background — neither is needed to draw a screen, and
/// waiting on them would put a network call in front of the splash.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await LocalStore.instance.init();
  await DeviceService.instance.init();
  await FirebaseService.instance.init();
  await AppSession.instance.restore();

  unawaited(TrackingService.instance.init());
  unawaited(FcmService.instance.init());

  runApp(const ProviderScope(child: HariHariBolApp()));
}
