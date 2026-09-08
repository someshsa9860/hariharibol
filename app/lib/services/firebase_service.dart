import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

/// Firebase, and whether it is actually configured on this machine.
///
/// The config files (`google-services.json`, `GoogleService-Info.plist`,
/// `firebase_options.dart`) are secrets and are not in the repository, so a
/// fresh clone has none of them. Rather than crash on launch, initialisation is
/// attempted and its failure recorded: push and analytics go quiet, App Check
/// returns no token, and everything else works. The backend's
/// `APP_CHECK_ENABLED=false` in development is the other half of that deal.
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

    await _activateAppCheck();
  }

  /// App Check is what proves to the backend that a sign-up came from our own
  /// app and not from curl. Play Integrity on Android, App Attest on iOS; debug
  /// providers in a debug build so a simulator still gets a token.
  Future<void> _activateAppCheck() async {
    try {
      await FirebaseAppCheck.instance.activate(
        providerAndroid: kDebugMode
            ? const AndroidDebugProvider()
            : const AndroidPlayIntegrityProvider(),
        providerApple: kDebugMode ? const AppleDebugProvider() : const AppleAppAttestProvider(),
      );
    } catch (error) {
      debugPrint('App Check could not be activated: $error');
    }
  }

  /// The attestation token for the few endpoints that demand one. Null is a
  /// valid answer — the request still goes out, and the server decides.
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
