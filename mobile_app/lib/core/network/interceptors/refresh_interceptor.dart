import 'package:dio/dio.dart';

class RefreshInterceptor extends Interceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      // Try to refresh token
      // If successful, retry the request
      // Else, logout
    }
    super.onError(err, handler);
  }
}