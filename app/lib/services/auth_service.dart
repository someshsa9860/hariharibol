import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import '../core/constants/api_paths.dart';
import '../core/constants/app_config.dart';
import '../core/constants/storage_keys.dart';
import '../core/session/app_session.dart';
import '../core/session/legacy_token_store.dart';
import '../models/api_failure.dart';
import '../models/app_user.dart';
import '../models/auth_session.dart';
import 'api_client.dart';
import 'device_service.dart';
import 'fcm_service.dart';
import 'local_store.dart';

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
///
/// There is one more way in, and it is not a person's doing: a phone that
/// updated from the previous app still holds that app's token, and
/// [signInWithLegacyToken] trades it for a session (`LegacySignIn` decides when).
class AuthService {
  AuthService._() : _api = ApiClient.instance;

  /// A service whose requests go to [api], for tests that script the server.
  @visibleForTesting
  AuthService.forTesting({required this._api});

  static final AuthService instance = AuthService._();

  final ApiClient _api;
  final LegacyTokenStore _legacyToken = const LegacyTokenStore();
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
      throw const ApiFailure.signIn();
    }

    final idToken = account.authentication.idToken;
    if (idToken == null || idToken.isEmpty) {
      // Almost always a configuration problem: no serverClientId on Android, or
      // a SHA-1 that is not registered with the Firebase project.
      throw const ApiFailure.signIn();
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
      throw const ApiFailure.signIn();
    }

    final idToken = credential.identityToken;
    if (idToken == null || idToken.isEmpty) {
      throw const ApiFailure.signIn();
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

  /// Trades the previous app's access token for a session here.
  ///
  /// The API asks the old server who the token belongs to and makes (or finds)
  /// that person's account; nothing the phone says about them is trusted. A
  /// failure carries what the server answered, and which answers mean the token
  /// will never work is `LegacySignIn`'s business — this only reports. Cancel
  /// [cancel] to give up on a reply that is taking too long.
  Future<AuthSession> signInWithLegacyToken(String legacyToken, {ApiCancelToken? cancel}) {
    return _open(ApiPaths.signInLegacy, {'legacyToken': legacyToken}, cancel: cancel);
  }

  Future<AuthSession> _exchange({
    required String provider,
    required String idToken,
    String? name,
  }) {
    return _open(ApiPaths.signInSocial, {
      'provider': provider,
      'idToken': idToken,
      'name': ?name,
    });
  }

  /// Posts a sign-in and starts the session it returns.
  ///
  /// This is the one call that carries an App Check token: it is the door
  /// accounts are created through, and the backend refuses it without one. The
  /// languages and device fields are the same whichever way someone came in.
  Future<AuthSession> _open(
    String path,
    Map<String, dynamic> credentials, {
    ApiCancelToken? cancel,
  }) async {
    final device = DeviceService.instance;

    final response = await _api.post(
      path,
      attested: true,
      cancel: cancel,
      body: {
        ...credentials,
        'appLanguage': AppConfig.defaultAppLanguage,
        'mantraLanguage': AppConfig.defaultMantraLanguage,
        'readingLanguage': AppConfig.defaultReadingLanguage,
        'timezone': device.timezone,
        ...device.signInFields,
      },
    );

    final session = AuthSession.fromJson(response.json);

    // The parsers are lenient, so a 200 with the wrong shape reads as a session
    // of empty tokens. Starting one would show the dashboard to nobody.
    if (session.tokens.isEmpty) throw const ApiFailure.signIn();

    // 201 means the backend just created the account, 200 that it already
    // existed. A new account has the default languages rather than chosen
    // ones, so it is sent through the picker; a returning one never is.
    final isNewAccount = response.statusCode == 201;

    // A returning account chose its languages before — on this phone or on one
    // it no longer has — so the account's choice becomes the device's. Written
    // before the session starts: the language settings reload the moment the
    // session names someone, and read what is stored.
    if (!isNewAccount) await _keepAccountLanguages(session.user);

    await AppSession.instance.start(session);
    await LocalStore.instance.write(BoxKeys.onboardingSeen, !isNewAccount);

    // A session started here is the end of the previous app's: its token must
    // not be left to sign someone in again after they have signed out.
    await _legacyToken.clear();

    // Now there is an account for the push token to belong to. Not awaited:
    // it ends in a permission dialog, and the dashboard should not wait behind
    // one. A failure here costs notifications, not the sign-in.
    unawaited(FcmService.instance.registerAfterSignIn());

    return session;
  }

  /// Saves the account's app and reading languages as this device's own — the
  /// two the device keeps a copy of (the mantra language lives on the account,
  /// and speaking has no account field). An empty value is not a choice.
  Future<void> _keepAccountLanguages(AppUser user) async {
    final store = LocalStore.instance;
    if (user.appLanguage.isNotEmpty) await store.write(BoxKeys.languageApp, user.appLanguage);
    if (user.readingLanguage.isNotEmpty) await store.write(BoxKeys.languageReading, user.readingLanguage);
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
    await _legacyToken.clear();
    await AppSession.instance.clear();
  }

  Future<void> deleteAccount() async {
    await _api.delete(ApiPaths.deleteAccount);
    await _signOutProviders();
    await _legacyToken.clear();
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
