import 'dart:async';

import 'package:flutter/foundation.dart';

import '../core/constants/api_paths.dart';
import '../core/constants/app_config.dart';
import '../core/session/app_session.dart';
import '../core/session/legacy_token_store.dart';
import '../models/api_failure.dart';
import 'api_client.dart';
import 'auth_service.dart';

/// Signs in someone who updated from the previous app, without asking them to.
///
/// That app kept an access token of the old server on the phone, in a slot this
/// app can read (same bundle id). At launch, when nobody is signed in and the
/// token is there, it is sent to the API, which has the old server say who it
/// belongs to and answers with a session of this app's own — the same reply as a
/// Google sign-in. The favourite mantra comes along on the server's side; the
/// phone sends nothing but the token.
///
/// **This is the one place launch waits on the network**, because the
/// alternative is the welcome pages and a sign-in screen flashing past for
/// someone who is, in fact, signed in. The wait is capped
/// ([AppConfig.legacySignInTimeout]) and only ever happens on a phone with an
/// old token, once: success removes the token.
///
/// What each answer means for the token, judged by the API's own code
/// ([ApiCodes]) and not by the status alone:
///
///   * **Gone for good** — the old server does not know it any more (403 code
///     `UNAUTHENTICATED`) or the account has since been taken over by a Google or
///     Apple sign-in (409 code `CONFLICT`). It is removed, and the sign-in screen
///     is the way in.
///   * **Kept for the next launch** — no signal, a timeout, a busy or broken
///     server, the old server being unreachable (503 `LEGACY_UNAVAILABLE`), a
///     429, a refused attestation, a 400, a bare 401 or 409 from something in
///     front of the API. None of these says anything about the token, so a bad
///     moment must not cost someone their way in.
///
/// Nothing is shown either way: if it did not work, the person sees what a new
/// phone sees. Never throws.
class LegacySignIn {
  LegacySignIn._()
      : _auth = AuthService.instance,
        _tokens = const LegacyTokenStore(),
        _timeout = AppConfig.legacySignInTimeout;

  @visibleForTesting
  LegacySignIn.forTesting({
    required this._auth,
    this._timeout = AppConfig.legacySignInTimeout,
  }) : _tokens = const LegacyTokenStore();

  static final LegacySignIn instance = LegacySignIn._();

  final AuthService _auth;
  final LegacyTokenStore _tokens;
  final Duration _timeout;

  /// Returns whether it signed anyone in.
  ///
  /// A phone that is already signed in is left alone: it reads nothing and sends
  /// nothing, which is every launch after the first.
  Future<bool> run() async {
    if (AppSession.instance.isSignedIn) return false;

    final token = await _tokens.read();
    if (token == null) return false;

    // Cancelled rather than abandoned: a reply that landed after launch had
    // moved on could otherwise start a session over one the person has since
    // made with Google.
    final cancel = ApiCancelToken();
    final giveUp = Timer(_timeout, cancel.cancel);

    try {
      await _auth.signInWithLegacyToken(token, cancel: cancel);
      return true;
    } on ApiFailure catch (failure) {
      debugPrint('Signing in from the previous app did not work: $failure');
      if (_neverWillWork(failure)) await _tokens.clear();
      return false;
    } catch (error) {
      debugPrint('Signing in from the previous app failed unexpectedly: $error');
      return false;
    } finally {
      giveUp.cancel();
    }
  }

  /// Only the API's own answer counts, by its code: a 401 from a proxy in front
  /// of it, or a 409 from a gateway, says something about the request and
  /// nothing about the token.
  static bool _neverWillWork(ApiFailure failure) =>
      (failure.kind == FailureKind.unauthorized && failure.code == ApiCodes.unauthenticated) ||
      (failure.kind == FailureKind.conflict && failure.code == ApiCodes.conflict);
}
