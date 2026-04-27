import 'package:flutter/foundation.dart';

class AppConfig {
  static const String baseUrl = kDebugMode
      ? 'https://api-dev.hariharibol.com'
      : 'https://api.hariharibol.com';

  static const String apiVersion = 'v1';

  static const int connectTimeout = 30000;
  static const int receiveTimeout = 30000;

  // Add other config values
}