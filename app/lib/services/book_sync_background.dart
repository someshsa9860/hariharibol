import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:workmanager/workmanager.dart';

import '../core/constants/book_sync_config.dart';
import '../core/session/app_session.dart';
import 'book_sync_manager.dart';
import 'device_service.dart';
import 'local_store.dart';

/// What the OS runs when the app is not. It builds just enough of the app — the
/// key-value store, the device facts and the session the HTTP client reads —
/// and lets the sync finish what it owes. The sync endpoints are public, so no
/// sign-in is needed for it to work.
@pragma('vm:entry-point')
void bookSyncCallbackDispatcher() {
  Workmanager().executeTask((task, input) async {
    if (task != BookSyncConfig.backgroundTaskName) return true;
    try {
      WidgetsFlutterBinding.ensureInitialized();
      await LocalStore.instance.init();
      await DeviceService.instance.init();
      await AppSession.instance.restore();

      final manager = BookSyncManager.instance;
      await manager.resumePending();
      await manager.idle().timeout(BookSyncConfig.backgroundBudget, onTimeout: () {});
      // Done, or out of time: either way the rest waits for the next open.
      return true;
    } catch (error) {
      debugPrint('[BookSync] background pass failed: $error');
      return false;
    }
  });
}

/// Hands unfinished downloads to the OS when the app goes to the background,
/// so a book still downloading when the reader locks the phone carries on.
///
/// Android: WorkManager, once the network is up and the battery is not low.
/// iOS: a BGProcessingTask, run when the system chooses. Both are best effort
/// by design; whatever they do not finish, the next app start picks up.
class BookSyncBackground with WidgetsBindingObserver {
  BookSyncBackground._();

  static final BookSyncBackground instance = BookSyncBackground._();

  static bool get _supported => !kIsWeb && (Platform.isAndroid || Platform.isIOS);

  bool _started = false;

  /// Called once from `main()`. Never throws — the sync works without it.
  Future<void> start() async {
    if (_started || !_supported) return;
    _started = true;
    try {
      await Workmanager().initialize(bookSyncCallbackDispatcher);
      WidgetsBinding.instance.addObserver(this);
    } catch (error) {
      debugPrint('[BookSync] background sync unavailable: $error');
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.hidden) {
      schedule();
    }
  }

  Future<void> schedule() async {
    try {
      if (!await BookSyncManager.instance.hasWork()) return;
      await Workmanager().registerOneOffTask(
        BookSyncConfig.backgroundTaskId,
        BookSyncConfig.backgroundTaskName,
        constraints: Constraints(networkType: NetworkType.connected, requiresBatteryNotLow: true),
        existingWorkPolicy: ExistingWorkPolicy.keep,
      );
    } catch (error) {
      debugPrint('[BookSync] could not schedule a background pass: $error');
    }
  }
}
