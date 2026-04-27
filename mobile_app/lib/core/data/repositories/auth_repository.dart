import 'package:hari_hari_bol/core/config/endpoints.dart';
import 'package:hari_hari_bol/core/data/models/auth_model.dart';
import 'package:hari_hari_bol/core/data/repositories/base_repository.dart';

abstract class AuthRepository {
  Future<AuthModel> login(String email, String password);
  Future<AuthModel> googleSignIn(String idToken);
  Future<AuthModel> appleSignIn(String authorizationCode);
  Future<AuthModel> refreshToken(String refreshToken);
}

class AuthRepositoryImpl extends BaseRepository implements AuthRepository {
  @override
  Future<AuthModel> login(String email, String password) async {
    return handleRequest(
      () => dio.post(Endpoints.login, data: {
        'email': email,
        'password': password,
      }),
      (data) => AuthModel.fromJson(data),
    );
  }

  @override
  Future<AuthModel> googleSignIn(String idToken) async {
    return handleRequest(
      () => dio.post(Endpoints.googleAuth, data: {'idToken': idToken}),
      (data) => AuthModel.fromJson(data),
    );
  }

  @override
  Future<AuthModel> appleSignIn(String authorizationCode) async {
    return handleRequest(
      () => dio.post(Endpoints.appleAuth, data: {'authorizationCode': authorizationCode}),
      (data) => AuthModel.fromJson(data),
    );
  }

  @override
  Future<AuthModel> refreshToken(String refreshToken) async {
    return handleRequest(
      () => dio.post(Endpoints.refreshToken, data: {'refreshToken': refreshToken}),
      (data) => AuthModel.fromJson(data),
    );
  }
}