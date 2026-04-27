import '../repositories/auth_repository.dart';

class SignInWithGoogle {
  final AuthRepository repository;

  SignInWithGoogle(this.repository);

  Future<AuthResult> call(String idToken) {
    return repository.signInWithGoogle(idToken);
  }
}
