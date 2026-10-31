import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/widgets.dart';

/// The moments, other than a change, that are worth a sync with the account: the
/// app coming back to the front (to pick up what another phone did), going to the
/// back (so a change made a moment ago is not stranded), and the connection
/// returning.
///
/// Started while someone is signed in and stopped when nobody is, so a phone that
/// has nobody to sync for listens to nothing. What a trigger does is the caller's
/// ([onTrigger]); the routine and the chant record each have their own.
class SyncTriggers with WidgetsBindingObserver {
  SyncTriggers(this._onTrigger);

  final void Function() _onTrigger;
  StreamSubscription<List<ConnectivityResult>>? _connection;
  bool _started = false;

  void start() {
    if (_started) return;
    _started = true;
    WidgetsBinding.instance.addObserver(this);
    _connection = Connectivity().onConnectivityChanged.listen((results) {
      if (results.any((result) => result != ConnectivityResult.none)) _onTrigger();
    }, onError: (Object _) {});
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
    if (state == AppLifecycleState.resumed ||
        state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden) {
      _onTrigger();
    }
  }
}
