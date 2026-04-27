import 'package:dio/dio.dart';
import '../config/app_config.dart';

class ApiClient {
  static Dio createDio() {
    final dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.baseUrl,
        connectTimeout: const Duration(milliseconds: AppConfig.connectTimeout),
        receiveTimeout: const Duration(milliseconds: AppConfig.receiveTimeout),
        headers: {
          'Content-Type': 'application/json',
        },
      ),
    );

    // Add interceptors
    // dio.interceptors.add(AuthInterceptor());
    // dio.interceptors.add(LogInterceptor());

    return dio;
  }
}