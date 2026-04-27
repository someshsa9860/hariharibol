import '../repositories/auth_repository.dart';

class SignInWithApple {
  final AuthRepository repository;

  SignInWithApple(this.repository);

  Future<AuthResult> call(String identityToken, String userIdentifier) {
    return repository.signInWithApple(identityToken, userIdentifier);
  }
}
