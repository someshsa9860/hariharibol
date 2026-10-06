import 'app_user.dart';
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

  /// A year out, re-issued on every use. If this passes the person really does
  /// have to sign in again — which should mean they have not opened the app in
  /// twelve months.
  final DateTime? refreshExpiresAt;

  bool get isEmpty => accessToken.isEmpty || refreshToken.isEmpty;

  bool get refreshLooksExpired {
    final expiry = refreshExpiresAt;
    return expiry != null && expiry.isBefore(DateTime.now());
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

  final AppUser user;
  final AuthTokens tokens;

  factory AuthSession.fromJson(Json json) => AuthSession(
        user: AppUser.fromJson(asJson(json['user']) ?? const {}),
        tokens: AuthTokens.fromJson(asJson(json['tokens']) ?? const {}),
      );
}
