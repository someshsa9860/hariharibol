import 'package:dio/dio.dart';

class AuthInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    // Add auth token to headers
    // final token = await secureStorage.read(key: 'access_token');
    // if (token != null) {
    //   options.headers['Authorization'] = 'Bearer $token';
    // }
    super.onRequest(options, handler);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 401) {
      // Handle token refresh or logout
    }
    super.onError(err, handler);
  }
}