import 'package:dio/dio.dart';

class DeviceIdInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    // Add device id to headers
    // final deviceId = await getDeviceId();
    // options.headers['X-Device-ID'] = deviceId;
    super.onRequest(options, handler);
  }
}