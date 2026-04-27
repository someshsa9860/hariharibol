import '../entities/user.dart';

abstract class AuthRepository {
  Future<AuthResult> signInWithGoogle(String idToken);
  Future<AuthResult> signInWithApple(String identityToken, String userIdentifier);
  Future<AuthResult> refreshToken(String refreshToken);
  Future<void> logout();
  Future<void> deleteAccount();
}

class AuthResult {
  final String accessToken;
  final String refreshToken;
  final User user;

  AuthResult({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
  });
}
