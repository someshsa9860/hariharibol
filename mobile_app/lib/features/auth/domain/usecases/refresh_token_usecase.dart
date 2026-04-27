import '../repositories/auth_repository.dart';

class RefreshTokenUsecase {
  final AuthRepository repository;

  RefreshTokenUsecase(this.repository);

  Future<AuthResult> call(String refreshToken) {
    return repository.refreshToken(refreshToken);
  }
}
