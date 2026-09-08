import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import '../core/constants/api_paths.dart';
import '../core/constants/app_config.dart';
import '../core/session/app_session.dart';
import '../models/api_failure.dart';
import '../models/auth_session.dart';
import 'api_client.dart';
import 'device_service.dart';
import 'fcm_service.dart';

/// Raised when the person closes the Google or Apple sheet. Not an error worth
/// a red snack bar — the caller just stops.
class SignInCancelled implements Exception {
  const SignInCancelled();
}

/// Sign-in, sign-out and account deletion.
///
/// The provider sheet is only half of it: what the backend actually trusts is
/// the ID token that comes back, which it verifies against Google's or Apple's
/// keys. This service never sees a password because there is none anywhere in
/// the system.
class AuthService {
  AuthService._();

  static final AuthService instance = AuthService._();

  final ApiClient _api = ApiClient.instance;
  bool _googleReady = false;

  /// google_sign_in 7 wants an explicit initialise before the first call.
  Future<void> _initGoogle() async {
    if (_googleReady) return;
    await GoogleSignIn.instance.initialize(
      clientId: AppConfig.googleIosClientId.isEmpty ? null : AppConfig.googleIosClientId,
      serverClientId:
          AppConfig.googleServerClientId.isEmpty ? null : AppConfig.googleServerClientId,
    );
    _googleReady = true;
  }

  Future<AuthSession> signInWithGoogle() async {
    await _initGoogle();

    final GoogleSignInAccount account;
    try {
      account = await GoogleSignIn.instance.authenticate();
    } on GoogleSignInException catch (error) {
      if (error.code == GoogleSignInExceptionCode.canceled) throw const SignInCancelled();
      debugPrint('Google sign-in failed: ${error.code} ${error.description}');
      throw const ApiFailure(
        kind: FailureKind.unknown,
        message: 'We could not sign you in. Please try again.',
      );
    }

    final idToken = account.authentication.idToken;
    if (idToken == null || idToken.isEmpty) {
      // Almost always a configuration problem: no serverClientId on Android, or
      // a SHA-1 that is not registered with the Firebase project.
      throw const ApiFailure(
        kind: FailureKind.unknown,
        message: 'We could not sign you in. Please try again.',
      );
    }

    return _exchange(provider: 'GOOGLE', idToken: idToken, name: account.displayName);
  }

  Future<AuthSession> signInWithApple() async {
    final AuthorizationCredentialAppleID credential;
    try {
      credential = await SignInWithApple.getAppleIDCredential(
        scopes: const [AppleIDAuthorizationScopes.email, AppleIDAuthorizationScopes.fullName],
      );
    } on SignInWithAppleAuthorizationException catch (error) {
      if (error.code == AuthorizationErrorCode.canceled) throw const SignInCancelled();
      debugPrint('Apple sign-in failed: ${error.code} ${error.message}');
      throw const ApiFailure(
        kind: FailureKind.unknown,
        message: 'We could not sign you in. Please try again.',
      );
    }

    final idToken = credential.identityToken;
    if (idToken == null || idToken.isEmpty) {
      throw const ApiFailure(
        kind: FailureKind.unknown,
        message: 'We could not sign you in. Please try again.',
      );
    }

    // Apple hands over the name exactly once, on the very first sign-in, and
    // only to the client. If it is not forwarded now it is gone for good.
    final name = [credential.givenName, credential.familyName]
        .where((part) => part != null && part.isNotEmpty)
        .join(' ')
        .trim();

    return _exchange(
      provider: 'APPLE',
      idToken: idToken,
      name: name.isEmpty ? null : name,
    );
  }

  bool get isAppleAvailable => Platform.isIOS || Platform.isMacOS;

  /// Trades a provider token for our own session, and starts it.
  ///
  /// This is the one call that carries an App Check token: it is the door
  /// accounts are created through, and the backend refuses it without one.
  Future<AuthSession> _exchange({
    required String provider,
    required String idToken,
    String? name,
  }) async {
    final device = DeviceService.instance;

    final response = await _api.post(
      ApiPaths.signInSocial,
      attested: true,
      body: {
        'provider': provider,
        'idToken': idToken,
        'name': ?name,
        'appLanguage': AppConfig.defaultAppLanguage,
        'mantraLanguage': AppConfig.defaultMantraLanguage,
        'readingLanguage': AppConfig.defaultReadingLanguage,
        'timezone': device.timezone,
        ...device.signInFields,
      },
    );

    final session = AuthSession.fromJson(response.json);
    await AppSession.instance.start(session);

    // Now there is an account for the push token to belong to. Not awaited:
    // it ends in a permission dialog, and the dashboard should not wait behind
    // one. A failure here costs notifications, not the sign-in.
    unawaited(FcmService.instance.registerAfterSignIn());

    return session;
  }

  /// Ends the session on this device.
  ///
  /// The local clear runs whatever the server said: if the call failed, the
  /// tokens still have to leave the phone.
  Future<void> signOut() async {
    final refreshToken = AppSession.instance.refreshToken;
    try {
      if (refreshToken != null) {
        await _api.post(ApiPaths.logout, body: {'refreshToken': refreshToken});
      }
    } on ApiFailure catch (error) {
      debugPrint('Sign-out call failed, clearing locally anyway: $error');
    }

    await _signOutProviders();
    await AppSession.instance.clear();
  }

  Future<void> deleteAccount() async {
    await _api.delete(ApiPaths.deleteAccount);
    await _signOutProviders();
    await AppSession.instance.clear();
  }

  /// Clearing the provider's own cached account matters: without it the Google
  /// sheet silently re-picks the same account and "sign in as someone else"
  /// does nothing.
  Future<void> _signOutProviders() async {
    try {
      if (_googleReady) await GoogleSignIn.instance.signOut();
    } catch (error) {
      debugPrint('Google sign-out failed: $error');
    }
  }
}
