import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/constants/offline_config.dart';
import '../services/offline_warmer.dart';
import 'language_chain_provider.dart';
import 'language_settings_provider.dart';
import 'session_provider.dart';

/// Fetching ahead for offline use (`OfflineWarmer`).
///
/// Read once at boot (see `HariHariBolApp`). While someone is signed in it runs
/// a pass `OfflineConfig.warmDelay` after sign-in or launch, when the app comes
/// back to the front and when the connection returns — each at most every
/// `OfflineConfig.warmInterval` — and at once when the app or reading language
/// changes, because what is saved is worded in them.
final offlineWarmerProvider = Provider<void>((ref) {
  final warmer = OfflineWarmer.instance;
  Timer? delayed;

  void warm({bool force = false}) {
    if (ref.read(currentUserProvider) == null) return;
    unawaited(warmer.warm(
      appLanguage: ref.read(languageSettingsProvider).app,
      readingChain: ref.read(readingChainProvider),
      force: force,
    ));
  }

  final triggers = _WarmTriggers(warm);

  ref.listen<String?>(currentUserProvider.select((user) => user?.id), (previous, id) {
    delayed?.cancel();
    if (id == null) {
      triggers.stop();
    } else {
      triggers.start();
      delayed = Timer(OfflineConfig.warmDelay, warm);
    }
  }, fireImmediately: true);

  ref.listen(languageSettingsProvider.select((s) => (s.app, s.reading)), (previous, next) {
    if (previous != null && previous != next) warm(force: true);
  });

  ref.onDispose(() {
    delayed?.cancel();
    triggers.stop();
  });
});

/// Coming back to the front, and the connection returning.
class _WarmTriggers with WidgetsBindingObserver {
  _WarmTriggers(this._warm);

  final void Function() _warm;
  StreamSubscription<List<ConnectivityResult>>? _connection;
  bool _started = false;

  void start() {
    if (_started) return;
    _started = true;
    WidgetsBinding.instance.addObserver(this);
    _connection = Connectivity().onConnectivityChanged.listen(
      (results) {
        if (results.any((result) => result != ConnectivityResult.none)) _warm();
      },
      onError: (Object _) {},
    );
  }

  void stop() {
    if (!_started) return;
    _started = false;
    WidgetsBinding.instance.removeObserver(this);
    unawaited(_connection?.cancel());
    _connection = null;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _warm();
  }
}
