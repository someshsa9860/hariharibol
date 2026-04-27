import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../../../core/config/endpoints.dart';
import '../models/user_model.dart';

class AuthRemoteDataSource {
  final Dio _dio;

  AuthRemoteDataSource(this._dio);

  Future<Map<String, dynamic>> signInWithGoogle(String idToken) async {
    final response = await _dio.post(
      Endpoints.googleAuth,
      data: {
        'idToken': idToken,
        'deviceId': await _getDeviceId(),
        'deviceType': _getDeviceType(),
      },
    );
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> signInWithApple(
    String identityToken,
    String userIdentifier,
  ) async {
    final response = await _dio.post(
      Endpoints.appleAuth,
      data: {
        'identityToken': identityToken,
        'userIdentifier': userIdentifier,
        'deviceId': await _getDeviceId(),
        'deviceType': _getDeviceType(),
      },
    );
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> refreshToken(String refreshToken) async {
    final response = await _dio.post(
      Endpoints.refreshToken,
      data: {'refreshToken': refreshToken},
    );
    return response.data as Map<String, dynamic>;
  }

  Future<void> logout() async {
    await _dio.post('/api/v1/auth/logout');
  }

  Future<void> deleteAccount() async {
    await _dio.delete('/api/v1/auth/account');
  }

  String _getDeviceType() {
    // TODO: Get actual device type
    return 'android';
  }

  Future<String> _getDeviceId() async {
    // TODO: Get actual device ID
    return 'device-id-placeholder';
  }
}
