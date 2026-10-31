import 'package:connectivity_plus/connectivity_plus.dart';

/// Whether the phone has a connection right now, and when that changes — an
/// interface so a screen that follows it is tested without a phone.
///
/// This is only whether a network is attached, not whether the server answers:
/// a Wi-Fi with no internet behind it reads as online, and the request that
/// then fails says so itself.
abstract class ConnectionStatus {
  Future<bool> online();

  /// Emits the new state each time it changes.
  Stream<bool> get changes;
}

class DeviceConnectionStatus implements ConnectionStatus {
  DeviceConnectionStatus({Connectivity? connectivity}) : _connectivity = connectivity ?? Connectivity();

  final Connectivity _connectivity;

  /// A phone that cannot say is taken to be online: hiding something because
  /// the check failed would be worse than letting a request fail.
  @override
  Future<bool> online() async {
    try {
      return _isOnline(await _connectivity.checkConnectivity());
    } catch (_) {
      return true;
    }
  }

  @override
  Stream<bool> get changes => _connectivity.onConnectivityChanged.map(_isOnline).distinct();

  /// Bluetooth tethering is not a route to the internet.
  static bool _isOnline(List<ConnectivityResult> results) =>
      results.any((r) => r != ConnectivityResult.none && r != ConnectivityResult.bluetooth);
}
