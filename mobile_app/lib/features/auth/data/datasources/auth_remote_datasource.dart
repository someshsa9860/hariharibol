import 'dart:io';
import 'package:dio/dio.dart';
import 'package:device_info_plus/device_info_plus.dart';
import '../../../../core/config/endpoints.dart';

class AuthRemoteDataSource {
  final Dio _dio;
  final DeviceInfoPlugin _deviceInfo = DeviceInfoPlugin();

  AuthRemoteDataSource(this._dio);

  Future<Map<String, dynamic>> signInWithGoogle(String idToken) async {
    final response = await _dio.post(
      Endpoints.googleAuth,
      data: {
        'idToken': idToken,
        'deviceId': await _getDeviceId(),
        'deviceType': _getDeviceType(),
        'deviceModel': await _getDeviceModel(),
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
        'deviceModel': await _getDeviceModel(),
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

  Future<Map<String, dynamic>> completeOnboarding(String sampradayId) async {
    final response = await _dio.post(
      '/api/v1/users/me/onboarding',
      data: {'sampradayId': sampradayId},
    );
    return response.data as Map<String, dynamic>;
  }

  Future<List<dynamic>> getSampradayas() async {
    final response = await _dio.get('/api/v1/sampradayas?published=true&take=50');
    final data = response.data;
    if (data is Map && data['data'] != null) return data['data'] as List;
    if (data is List) return data;
    return [];
  }

  Future<void> logout() async {
    await _dio.post('/api/v1/auth/logout');
  }

  Future<void> deleteAccount() async {
    await _dio.delete('/api/v1/auth/account');
  }

  String _getDeviceType() => Platform.isIOS ? 'ios' : 'android';

  Future<String> _getDeviceId() async {
    try {
      if (Platform.isAndroid) {
        final info = await _deviceInfo.androidInfo;
        return info.id;
      } else if (Platform.isIOS) {
        final info = await _deviceInfo.iosInfo;
        return info.identifierForVendor ?? 'unknown-ios';
      }
    } catch (_) {}
    return 'unknown-device';
  }

  Future<String> _getDeviceModel() async {
    try {
      if (Platform.isAndroid) {
        final info = await _deviceInfo.androidInfo;
        return '${info.manufacturer} ${info.model}';
      } else if (Platform.isIOS) {
        final info = await _deviceInfo.iosInfo;
        return info.utsname.machine;
      }
    } catch (_) {}
    return 'unknown';
  }
}
