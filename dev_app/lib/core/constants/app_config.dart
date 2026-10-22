/// Everything that would otherwise be typed into a widget or a service.
///
/// The addresses are compile-time constants so a debug build can be pointed at a laptop:
///   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000 --dart-define=WS_URL=ws://10.0.2.2:4001/ws
/// Behind the production proxy the websocket is the API host's `/ws`, so `WS_URL` is only needed locally.
abstract final class AppConfig {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.hariharibol.com',
  );

  static const String _wsOverride = String.fromEnvironment('WS_URL');

  /// `https://host` → `wss://host/ws`, unless `WS_URL` says otherwise.
  static String get wsUrl {
    if (_wsOverride.isNotEmpty) return _wsOverride;
    final uri = Uri.parse(apiBaseUrl);
    return uri.replace(scheme: uri.scheme == 'https' ? 'wss' : 'ws', path: '/ws').toString();
  }

  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 30);

  /// The access token lasts a week; it is swapped for a new one once it is this old.
  static const Duration accessRenewAfter = Duration(days: 1);
  static const Duration renewRetryAfter = Duration(minutes: 15);

  static const int pageSize = 30;

  /// Google sign-in client ids. Android needs the *web* client id as `serverClientId`; both differ per
  /// Firebase project, so they are supplied at build time rather than committed.
  static const String googleServerClientId = String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');
  static const String googleIosClientId = String.fromEnvironment('GOOGLE_IOS_CLIENT_ID');

  /// Fallbacks the sign-in body carries (the server needs them to create an account; the owner's exists already).
  static const String defaultLanguage = 'en';
  static const String fallbackTimezone = 'Asia/Kolkata';
}

/// Tunables of the live connection.
abstract final class SocketConfig {
  /// The backend holds the developer's pushes back while the app says it is on screen; it says so this often
  /// (the server forgets after ~75 s of silence).
  static const Duration heartbeat = Duration(seconds: 30);

  static const Duration reconnectMin = Duration(seconds: 2);
  static const Duration reconnectMax = Duration(seconds: 60);

  /// Closed by the server because the account may not use this app (no `dev.access`) or the token is bad.
  static const Set<int> fatalCloseCodes = {4001, 4003};
}

/// Names of the events the backend sends over the socket.
abstract final class SocketEvents {
  static const String event = 'dev.event';
  static const String chatMessage = 'dev.chat.message';
  static const String connected = 'connected';
}
