import 'package:flutter/foundation.dart';

import '../../models/app_user.dart';
import '../../models/auth_session.dart';
import '../../services/local_store.dart';
import '../constants/storage_keys.dart';
import 'token_store.dart';

/// Where the app is, as far as the router is concerned.
enum SessionStatus {
  /// Storage has not been read yet — the splash screen is showing.
  unknown,

  signedOut,
  signedIn,
}

/// The one place tokens and the current user live.
///
/// Nothing else reads or writes them: the API client asks this class for the
/// access token and hands it a new pair after a refresh; sign-in hands it a
/// whole [AuthSession]; the router listens to it to decide which screen to
/// show. Being a [ChangeNotifier] is what makes that last part work — go_router
/// takes it as its `refreshListenable`.
class AppSession extends ChangeNotifier {
  AppSession._();

  static final AppSession instance = AppSession._();

  final TokenStore _tokens = const TokenStore();

  SessionStatus _status = SessionStatus.unknown;
  AuthTokens? _pair;
  AppUser? _user;

  SessionStatus get status => _status;
  bool get isSignedIn => _status == SessionStatus.signedIn;
  AppUser? get user => _user;
  String? get accessToken => _pair?.accessToken;
  String? get refreshToken => _pair?.refreshToken;

  /// Reads what was persisted. Called once from `main()`.
  ///
  /// A stored pair is trusted without a network round trip — the first API call
  /// will refresh it if the access token has aged out. Launch is not the place
  /// to block on the network.
  Future<void> restore() async {
    final stored = await _tokens.read();
    final cached = LocalStore.instance.readJson(BoxKeys.user);

    if (stored == null || stored.isEmpty || stored.refreshLooksExpired) {
      if (stored != null) await _tokens.clear();
      _setSignedOut();
      return;
    }

    _pair = stored;
    _user = cached == null ? null : AppUser.fromJson(cached);
    _status = SessionStatus.signedIn;
    notifyListeners();
  }

  /// A completed sign-in, or a refresh that also returned the user.
  Future<void> start(AuthSession session) async {
    _pair = session.tokens;
    _user = session.user;
    _status = SessionStatus.signedIn;

    await _tokens.write(session.tokens);
    await LocalStore.instance.write(BoxKeys.user, session.user.toJson());
    notifyListeners();
  }

  /// A fresh pair from a silent rotation. The user is unchanged, so no listener
  /// needs waking — the whole point of a silent refresh is that nothing on
  /// screen reacts to it.
  Future<void> updateTokens(AuthTokens tokens) async {
    _pair = tokens;
    await _tokens.write(tokens);
  }

  /// The profile changed — a language setting, a name, going premium.
  Future<void> updateUser(AppUser user) async {
    _user = user;
    await LocalStore.instance.write(BoxKeys.user, user.toJson());
    notifyListeners();
  }

  /// Sign-out, and what a dead refresh token forces.
  ///
  /// Clearing storage is deliberately not conditional on the network call that
  /// preceded it having worked: if the server could not be told, the tokens
  /// still have to leave this device.
  Future<void> clear() async {
    await _tokens.clear();
    await LocalStore.instance.delete(BoxKeys.user);
    _setSignedOut();
  }

  void _setSignedOut() {
    _pair = null;
    _user = null;
    _status = SessionStatus.signedOut;
    notifyListeners();
  }
}
