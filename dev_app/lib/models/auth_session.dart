import 'dart:convert';

import 'dev_user.dart';
import 'json.dart';

/// The token pair. Both `/auth/social` and `/auth/refresh` return this shape,
/// which is why there is one parser and not two.
class AuthTokens {
  const AuthTokens({
    required this.accessToken,
    required this.refreshToken,
    required this.refreshExpiresAt,
  });

  final String accessToken;
  final String refreshToken;

  /// A year out, re-issued on every use. Only the server decides whether it is
  /// still good: a phone whose clock says it has passed is not signed out for
  /// that — the next call asks, and a 403 is what ends the session.
  final DateTime? refreshExpiresAt;

  bool get isEmpty => accessToken.isEmpty || refreshToken.isEmpty;

  /// When the server signed the access token, and when it lapses, read from the
  /// token's own payload. Nothing here checks the signature — the server is the
  /// judge of whether a token is good; this only decides when to ask for a new
  /// one. Null for anything that is not a JWT with those claims.
  DateTime? get accessIssuedAt => _claim('iat');
  DateTime? get accessExpiresAt => _claim('exp');

  /// True once the access token is [after] old, so it is swapped long before it
  /// lapses. A token with a shorter life than twice [after] is renewed at half
  /// of it, and one that cannot be read is left alone — the 403 path covers it.
  bool accessDueForRenewal(DateTime now, Duration after) {
    final issued = accessIssuedAt;
    if (issued == null) return false;

    final expires = accessExpiresAt;
    var wait = after;
    if (expires != null) {
      final half = expires.difference(issued) ~/ 2;
      if (half > Duration.zero && half < wait) wait = half;
    }
    return !now.isBefore(issued.add(wait));
  }

  DateTime? _claim(String name) {
    try {
      final parts = accessToken.split('.');
      if (parts.length != 3) return null;
      final payload = jsonDecode(utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))));
      final value = payload is Map ? payload[name] : null;
      if (value is! num) return null;
      return DateTime.fromMillisecondsSinceEpoch(value.toInt() * 1000);
    } catch (_) {
      return null;
    }
  }

  factory AuthTokens.fromJson(Json json) => AuthTokens(
        accessToken: asString(json['accessToken']),
        refreshToken: asString(json['refreshToken']),
        refreshExpiresAt: asDate(json['refreshExpiresAt']),
      );
}

/// A whole sign-in result: who, plus the tokens.
class AuthSession {
  const AuthSession({required this.user, required this.tokens});

  final DevUser user;
  final AuthTokens tokens;

  factory AuthSession.fromJson(Json json) => AuthSession(
        user: DevUser.fromJson(asJson(json['user']) ?? const {}),
        tokens: AuthTokens.fromJson(asJson(json['tokens']) ?? const {}),
      );
}
