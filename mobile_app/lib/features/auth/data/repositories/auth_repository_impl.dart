import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../domain/repositories/auth_repository.dart';
import '../../domain/entities/user.dart';
import '../models/user_model.dart';
import '../datasources/auth_remote_datasource.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource _remoteDataSource;
  final FlutterSecureStorage _secureStorage;

  AuthRepositoryImpl(this._remoteDataSource, this._secureStorage);

  @override
  Future<AuthResult> signInWithGoogle(String idToken) async {
    final data = await _remoteDataSource.signInWithGoogle(idToken);
    return _handleAuthResponse(data);
  }

  @override
  Future<AuthResult> signInWithApple(
    String identityToken,
    String userIdentifier,
  ) async {
    final data = await _remoteDataSource.signInWithApple(
      identityToken,
      userIdentifier,
    );
    return _handleAuthResponse(data);
  }

  @override
  Future<AuthResult> refreshToken(String refreshToken) async {
    final data = await _remoteDataSource.refreshToken(refreshToken);
    return _handleAuthResponse(data);
  }

  @override
  Future<void> logout() async {
    await _remoteDataSource.logout();
    await _secureStorage.deleteAll();
  }

  @override
  Future<void> deleteAccount() async {
    await _remoteDataSource.deleteAccount();
    await _secureStorage.deleteAll();
  }

  Future<AuthResult> _handleAuthResponse(Map<String, dynamic> data) async {
    final accessToken = data['accessToken'] as String;
    final refreshToken = data['refreshToken'] as String;
    final userJson = data['user'] as Map<String, dynamic>;

    final user = UserModel.fromJson(userJson);

    // Store tokens securely
    await _secureStorage.write(key: 'access_token', value: accessToken);
    await _secureStorage.write(key: 'refresh_token', value: refreshToken);

    return AuthResult(
      accessToken: accessToken,
      refreshToken: refreshToken,
      user: user,
    );
  }
}
