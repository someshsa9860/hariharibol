import 'dart:async';

import 'package:flutter/foundation.dart';

import '../core/constants/legacy_config.dart';
import '../core/session/app_session.dart';
import '../models/auth_session.dart';
import '../models/api_failure.dart';
import 'auth_service.dart';
import 'legacy_token_store.dart';

/// Someone who used the previous app and has just updated to this one is signed in without being asked to.
///
/// The previous app's token is read from the phone ([LegacyTokenStore]) and sent to this app's server, which checks
/// it with the previous server and answers with a session of this server's own (`POST /auth/legacy`) — stored under
/// this app's own keys, never the old ones. The old token is then deleted.
///
/// Called once at launch (`main.dart`), before the first screen, so a person who is carried over never sees the
/// sign-in screen. It never throws and never shows anything: any failure leaves the app on its sign-in screen, which
/// is where it would have been anyway.
class LegacyMigration {
  LegacyMigration({
    LegacyTokenStore tokens = const LegacyTokenStore(),
    Future<AuthSession> Function(String legacyToken)? signIn,
  })  : _tokens = tokens,
        _signIn = signIn ?? AuthService.instance.signInWithLegacyToken;

  static final LegacyMigration instance = LegacyMigration();

  /// The server's answer to a token it does not recognise: the previous server said no, so waiting will not help.
  static const String _notRecognised = 'UNAUTHENTICATED';

  final LegacyTokenStore _tokens;
  final Future<AuthSession> Function(String legacyToken) _signIn;

  bool _tried = false;

  /// True when the person was signed in by it.
  ///
  /// What happens to the old token depends on why it did not work:
  ///  - carried over: deleted, so signing out later does not sign them straight back in;
  ///  - the previous server does not recognise it (expired, revoked): deleted, it will never work;
  ///  - anything else (no signal, the previous server down, a failed attestation, a timeout): **kept**, and tried
  ///    again at the next launch.
  Future<bool> attempt() async {
    // Once per launch, and never over a session that is already there.
    if (_tried || AppSession.instance.isSignedIn) return false;
    _tried = true;

    final token = await _tokens.read();
    if (token == null) return false;

    try {
      await _signIn(token).timeout(LegacyConfig.attemptTimeout);
    } on TimeoutException {
      debugPrint('Carrying the previous sign-in over timed out; will try again next launch.');
      return false;
    } on ApiFailure catch (failure) {
      if (failure.kind == FailureKind.unauthorized || failure.code == _notRecognised) {
        await _tokens.clear();
      }
      debugPrint('Carrying the previous sign-in over failed: $failure');
      return false;
    } catch (error) {
      debugPrint('Carrying the previous sign-in over failed: $error');
      return false;
    }

    await _tokens.clear();
    return true;
  }
}
