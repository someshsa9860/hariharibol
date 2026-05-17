import 'package:flutter/foundation.dart';

class AppConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: kIsWeb ? 'http://localhost:3001' : 'http://10.0.2.2:3001',
  );

  static const String apiVersion = 'v1';

  static const int connectTimeout = 30000;
  static const int receiveTimeout = 30000;
}
