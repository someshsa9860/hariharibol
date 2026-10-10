import 'package:connectivity_plus/connectivity_plus.dart';

import '../core/constants/storage_keys.dart';
import 'local_store.dart';

/// Whether the silent sync may use the network right now, and when that
/// changes. An interface so the queue is tested without a phone.
abstract class SyncConditions {
  Future<bool> allowed();

  /// Emits whenever [allowed] may have changed.
  Stream<void> get changes;
}

/// No connection, or — if the reader chose Wi-Fi only — no Wi-Fi, pauses the
/// sync. Low battery is handled by the OS for the background pass
/// (`requiresBatteryNotLow` in `BookSyncBackground`); while the app is open
/// the downloads are a few megabytes and the reader is already using the phone.
class DeviceSyncConditions implements SyncConditions {
  DeviceSyncConditions({Connectivity? connectivity}) : _connectivity = connectivity ?? Connectivity();

  final Connectivity _connectivity;

  @override
  Future<bool> allowed() async => _permits(await _connectivity.checkConnectivity());

  @override
  Stream<void> get changes => _connectivity.onConnectivityChanged;

  bool _permits(List<ConnectivityResult> results) {
    final online = results.where((r) => r != ConnectivityResult.none && r != ConnectivityResult.bluetooth);
    if (online.isEmpty) return false;
    final wifiOnly = LocalStore.instance.read<bool>(BoxKeys.syncWifiOnly) ?? false;
    if (!wifiOnly) return true;
    return online.any((r) => r == ConnectivityResult.wifi || r == ConnectivityResult.ethernet);
  }
}
