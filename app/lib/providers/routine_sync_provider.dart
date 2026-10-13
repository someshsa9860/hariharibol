import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/routine_service.dart';
import '../services/routine_syncer.dart';
import 'routine_provider.dart';
import 'session_provider.dart';

/// The routine's sync with the account.
///
/// Read once at boot (see `HariHariBolApp`) so it starts as soon as someone is
/// signed in, and read by the routine itself to ask for a sync after a change.
/// While signed in it also syncs when the app comes back to the front (to pick
/// up what another phone did), when it goes to the back (so a change made a
/// moment ago is not stranded), and when the connection returns.
final routineSyncerProvider = Provider<RoutineSyncer>((ref) {
  final syncer = RoutineSyncer(
    remote: RoutineService.instance,
    read: () => ref.read(routineProvider),
    write: (data) => ref.read(routineProvider.notifier).adopt(data),
    userId: () => ref.read(currentUserProvider)?.id,
  );
  final triggers = _SyncTriggers(syncer);

  // Only while signed in: nothing is listened to, and no timer is set, for a
  // phone that has nobody to sync for.
  ref.listen<String?>(currentUserProvider.select((user) => user?.id), (previous, id) {
    if (id == null) {
      triggers.stop();
    } else {
      triggers.start();
      syncer.schedule(after: Duration.zero);
    }
  }, fireImmediately: true);

  ref.onDispose(() {
    triggers.stop();
    syncer.dispose();
  });
  return syncer;
});

/// The moments worth a sync that are not a change to the routine.
class _SyncTriggers with WidgetsBindingObserver {
  _SyncTriggers(this._syncer);

  final RoutineSyncer _syncer;
  StreamSubscription<List<ConnectivityResult>>? _connection;
  bool _started = false;

  void start() {
    if (_started) return;
    _started = true;
    WidgetsBinding.instance.addObserver(this);
    _connection = Connectivity().onConnectivityChanged.listen(
      (results) {
        if (results.any((result) => result != ConnectivityResult.none)) {
          unawaited(_syncer.syncNow());
        }
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
    if (state == AppLifecycleState.resumed ||
        state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden) {
      unawaited(_syncer.syncNow());
    }
  }
}
