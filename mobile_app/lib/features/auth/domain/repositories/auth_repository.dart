import '../entities/user.dart';

abstract class AuthRepository {
  Future<AuthResult> signInWithGoogle(String idToken);
  Future<AuthResult> signInWithApple(String identityToken, String userIdentifier);
  Future<AuthResult> refreshToken(String refreshToken);
  Future<AuthResult> completeOnboarding(String sampradayId);
  Future<List<Map<String, dynamic>>> getSampradayas();
  Future<void> logout();
  Future<void> deleteAccount();
}

class AuthResult {
  final String accessToken;
  final String refreshToken;
  final User user;
  final bool isNewUser;

  AuthResult({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
    this.isNewUser = false,
  });
}
