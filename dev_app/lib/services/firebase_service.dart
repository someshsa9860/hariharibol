import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

/// Firebase for push and App Check. The configuration files are secrets and are not in the repository
/// (see dev_app/README.md), so on a build without them every call here is a quiet no-op: the app still runs
/// and signs in against a backend that does not ask for App Check, it just gets no pushes.
class FirebaseService {
  FirebaseService._();

  static final FirebaseService instance = FirebaseService._();

  bool _available = false;
  bool get isAvailable => _available;

  Future<void> init() async {
    try {
      await Firebase.initializeApp();
      _available = true;
    } catch (error) {
      _available = false;
      debugPrint('Firebase is not configured on this build: $error');
      return;
    }
    try {
      await FirebaseAppCheck.instance.activate(
        providerAndroid: kDebugMode ? const AndroidDebugProvider() : const AndroidPlayIntegrityProvider(),
        providerApple: kDebugMode ? const AppleDebugProvider() : const AppleAppAttestProvider(),
      );
    } catch (error) {
      debugPrint('App Check could not be activated: $error');
    }
  }

  Future<String?> appCheckToken() async {
    if (!_available) return null;
    try {
      return await FirebaseAppCheck.instance.getToken();
    } catch (error) {
      debugPrint('App Check token unavailable: $error');
      return null;
    }
  }
}
