/// Everything that would otherwise be typed into a widget or a service.
///
/// The base URL is a compile-time constant so a debug build can be pointed at a
/// laptop without editing source:
///
///   flutter run --dart-define=API_BASE_URL=http://192.168.1.5:4000
///
/// On Android an emulator reaches the host machine at 10.0.2.2, not localhost.
abstract final class AppConfig {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.hariharibol.com',
  );

  /// Deep links arrive as `hariharibol://…` — the backend signs them with the
  /// same scheme (`APP_SCHEME` in its environment).
  static const String appScheme = 'hariharibol';

  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 30);

  /// One retry, and only for a request that failed because the access token had
  /// expired. Anything else surfaces to the caller.
  static const int authRetryLimit = 1;

  static const int defaultPageSize = 20;

  /// Fallbacks for the three language settings until the account says otherwise.
  static const String defaultAppLanguage = 'en';
  static const String defaultMantraLanguage = 'sa';
  static const String defaultReadingLanguage = 'en';

  /// Used only if the device will not tell us its zone.
  static const String fallbackTimezone = 'Asia/Kolkata';

  /// Google sign-in client ids.
  ///
  /// Android needs the *web* client id as `serverClientId` — that is what makes
  /// Google mint an ID token the backend can verify. iOS normally reads its own
  /// id from `GoogleService-Info.plist`; this override exists because that file
  /// is a secret and is not in the repository.
  ///
  /// Both are ids, not secrets, but they differ per Firebase project, so they
  /// are supplied at build time rather than committed.
  static const String googleServerClientId = String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');
  static const String googleIosClientId = String.fromEnvironment('GOOGLE_IOS_CLIENT_ID');
}
