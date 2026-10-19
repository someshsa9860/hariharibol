import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/session/app_session.dart';
import 'services/book_sync_background.dart';
import 'services/book_sync_manager.dart';
import 'services/device_service.dart';
import 'services/fcm_service.dart';
import 'services/firebase_service.dart';
import 'services/legacy_migration.dart';
import 'services/local_store.dart';
import 'services/purchase_service.dart';
import 'services/tracking_service.dart';

/// Boot.
///
/// Only the work the first frame genuinely depends on is awaited: the local
/// store, the device facts every request carries, and the session. Push and
/// analytics start in the background — neither is needed to draw a screen, and
/// waiting on them would put a network call in front of the splash.
///
/// Those steps overlap rather than queue: each is a round trip to the platform,
/// and the blank native launch screen is on show until the last one returns.
/// Firebase needs nothing from the store, and the device facts and the session
/// need only the store.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Future.wait([
    FirebaseService.instance.init(),
    _openStore(),
  ]);

  // Someone updating from the previous app is carried over to an account here before the first screen, so they are
  // never asked to sign in again. Does nothing (and no network call) unless the previous app left a token behind.
  await LegacyMigration.instance.attempt();

  unawaited(TrackingService.instance.init());
  unawaited(FcmService.instance.init());

  // Purchases finish on their own schedule — pending approvals, ones made while
  // the app was closed — so the store's stream is listened to from boot.
  PurchaseService.instance.start();

  // Pick up any book downloads a previous run left unfinished, ask the server
  // whether the books on the phone have new text, and let the OS finish the
  // downloads if the app goes to the background. None of it shows anything.
  unawaited(BookSyncBackground.instance.start());
  unawaited(BookSyncManager.instance.onAppStart());

  runApp(const ProviderScope(child: HariHariBolApp()));
}

/// The store first — the other two read it — then the device facts and the
/// session together.
Future<void> _openStore() async {
  await LocalStore.instance.init();
  await Future.wait([
    DeviceService.instance.init(),
    AppSession.instance.restore(),
  ]);
}
