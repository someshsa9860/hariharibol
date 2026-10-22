import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../../models/auth_session.dart';
import '../../models/dev_user.dart';
import '../../models/json.dart';
import 'token_store.dart';

enum SessionStatus {
  /// Storage has not been read yet — the splash screen is showing.
  unknown,
  signedOut,
  signedIn,
}

/// The one place the tokens and the signed-in developer live. The API client asks it for the access token and
/// hands it a new pair after a refresh; the router listens to it to decide which screen to show.
class AppSession extends ChangeNotifier {
  AppSession._();

  static final AppSession instance = AppSession._();

  final TokenStore _tokens = const TokenStore();

  SessionStatus _status = SessionStatus.unknown;
  AuthTokens? _pair;
  DevUser? _user;

  SessionStatus get status => _status;
  bool get isSignedIn => _status == SessionStatus.signedIn;
  DevUser? get user => _user;
  String? get accessToken => _pair?.accessToken;
  String? get refreshToken => _pair?.refreshToken;
  AuthTokens? get tokens => _pair;

  /// Reads what was persisted. A stored pair is trusted without a network call; the first request refreshes it
  /// if it has aged out. Only the server refusing a refresh signs anyone out.
  /// For tests: a signed-in session in memory, with nothing written to secure storage.
  @visibleForTesting
  void debugSignIn(AuthSession session) {
    _pair = session.tokens;
    _user = session.user;
    _status = SessionStatus.signedIn;
    notifyListeners();
  }

  Future<void> restore() async {
    final stored = await _tokens.read();
    if (stored == null || stored.isEmpty) {
      if (stored != null) await _tokens.clear();
      _setSignedOut();
      return;
    }
    _pair = stored;
    _user = await _readUser();
    _status = SessionStatus.signedIn;
    notifyListeners();
  }

  Future<void> start(AuthSession session) async {
    _pair = session.tokens;
    _user = session.user;
    _status = SessionStatus.signedIn;
    await _tokens.write(session.tokens);
    notifyListeners();
  }

  Future<void> updateTokens(AuthTokens tokens) async {
    _pair = tokens;
    await _tokens.write(tokens);
  }

  Future<void> updateUser(DevUser user) async {
    _user = user;
    await _tokens.writeUser(jsonEncode(user.toJson()));
    notifyListeners();
  }

  Future<void> clear() async {
    await _tokens.clear();
    _setSignedOut();
  }

  Future<DevUser?> _readUser() async {
    try {
      final raw = await _tokens.readUser();
      if (raw == null) return null;
      final json = asJson(jsonDecode(raw));
      return json == null ? null : DevUser.fromJson(json);
    } catch (_) {
      return null;
    }
  }

  void _setSignedOut() {
    _pair = null;
    _user = null;
    _status = SessionStatus.signedOut;
    notifyListeners();
  }
}
