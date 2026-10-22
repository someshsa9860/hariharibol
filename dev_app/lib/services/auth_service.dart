import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../core/constants/api_paths.dart';
import '../core/constants/app_config.dart';
import '../core/session/app_session.dart';
import '../models/api_failure.dart';
import '../models/auth_session.dart';
import '../models/dev_user.dart';
import 'api_client.dart';
import 'device_service.dart';
import 'push_service.dart';

/// The person closed the Google sheet. Not an error worth showing.
class SignInCancelled implements Exception {
  const SignInCancelled();
}

/// Sign-in is Google only, through the same endpoint the reader's app and the admin panel use. After it, the
/// account's permissions are read: without `dev.access` the session is dropped again and the sign-in fails with
/// [ApiFailure.notAllowed] — the backend refuses such an account on every route anyway, this just says so.
class AuthService {
  AuthService._() : _api = ApiClient.instance;

  @visibleForTesting
  AuthService.forTesting({required this._api});

  static final AuthService instance = AuthService._();

  final ApiClient _api;
  bool _googleReady = false;

  Future<void> _initGoogle() async {
    if (_googleReady) return;
    await GoogleSignIn.instance.initialize(
      clientId: AppConfig.googleIosClientId.isEmpty ? null : AppConfig.googleIosClientId,
      serverClientId: AppConfig.googleServerClientId.isEmpty ? null : AppConfig.googleServerClientId,
    );
    _googleReady = true;
  }

  Future<DevUser> signInWithGoogle() async {
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
    if (idToken == null || idToken.isEmpty) throw const ApiFailure.signIn();
    return exchange(idToken: idToken, name: account.displayName);
  }

  /// Trades a provider token for a session. Separate from the Google sheet so a test can drive it.
  Future<DevUser> exchange({required String idToken, String? name}) async {
    final device = DeviceService.instance;
    final response = await _api.post(
      ApiPaths.signInSocial,
      attested: true,
      body: {
        'provider': 'GOOGLE',
        'idToken': idToken,
        'name': ?name,
        'appLanguage': AppConfig.defaultLanguage,
        'timezone': device.timezone,
        ...device.fields,
      },
    );

    final session = AuthSession.fromJson(response.json);
    if (session.tokens.isEmpty) throw const ApiFailure.signIn();
    await AppSession.instance.start(session);

    final DevUser user;
    try {
      user = await loadProfile();
    } on ApiFailure {
      await AppSession.instance.clear();
      rethrow;
    }
    if (!user.canUseDevApp) {
      await signOut();
      throw const ApiFailure.notAllowed();
    }

    unawaited(PushService.instance.registerAfterSignIn());
    return user;
  }

  /// Reads who this is and what they may do, and keeps it on the session.
  Future<DevUser> loadProfile() async {
    final response = await _api.get(ApiPaths.me);
    final user = DevUser.fromJson(response.json);
    await AppSession.instance.updateUser(user);
    return user;
  }

  Future<void> signOut() async {
    final refreshToken = AppSession.instance.refreshToken;
    try {
      await PushService.instance.unregister();
      if (refreshToken != null) await _api.post(ApiPaths.logout, body: {'refreshToken': refreshToken});
    } on ApiFailure catch (error) {
      debugPrint('Sign-out call failed, clearing locally anyway: $error');
    }
    try {
      if (_googleReady) await GoogleSignIn.instance.signOut();
    } catch (error) {
      debugPrint('Google sign-out failed: $error');
    }
    await AppSession.instance.clear();
  }
}
