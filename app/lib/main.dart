import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/layout/adaptive.dart';
import 'core/session/app_session.dart';
import 'services/book_sync_background.dart';
import 'services/book_sync_manager.dart';
import 'services/deep_link_service.dart';
import 'services/device_service.dart';
import 'services/fcm_service.dart';
import 'services/firebase_service.dart';
import 'services/legacy_sign_in.dart';
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
///
/// One network call is awaited, and only on a phone that still holds the
/// previous app's token: trading it for a session (`LegacySignIn`).
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Future.wait([
    FirebaseService.instance.init(),
    _openStore(),
  ]);

  // Someone who updated from the previous app is signed in here, before the
  // first frame, so the router starts on their dashboard and not on the welcome
  // pages. It needs Firebase (the sign-in carries an App Check token) and the
  // session, which is why it follows them. On every other launch it reads
  // nothing and returns at once; on the one that matters it is capped at
  // `AppConfig.legacySignInTimeout` and never throws.
  await LegacySignIn.instance.run();

  // Links the app is opened with (shared verses, mantras, reels, invitations), cold or warm.
  unawaited(DeepLinkService.instance.start());

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

  await _detectTv();

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

/// Whether this is an Android TV, asked of the platform once. Anywhere else, or
/// if the platform does not answer, it is not.
Future<void> _detectTv() async {
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
  try {
    final tv = await const MethodChannel('hariharibol/device').invokeMethod<bool>('isTv');
    AdaptiveLayout.markAsTv(tv ?? false);
    // With a remote there is no pointer to say "the keyboard is in use", so the
    // focus ring is always drawn.
    if (tv ?? false) FocusManager.instance.highlightStrategy = FocusHighlightStrategy.alwaysTraditional;
  } on PlatformException {
    // Not a television as far as anyone can tell.
  } on MissingPluginException {
    // A test or an older host without the channel.
  }
}
