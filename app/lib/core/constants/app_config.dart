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

  /// The realtime socket (`backend/websocket/`). Left unset it is the API's own
  /// host at `/ws` — behind the proxy — or port 4001 when the API is on a laptop.
  static const String _wsUrlOverride = String.fromEnvironment('WS_URL');

  static String get wsUrl {
    if (_wsUrlOverride.isNotEmpty) return _wsUrlOverride;
    final api = Uri.parse(apiBaseUrl);
    final local = api.host == 'localhost' || api.host == '127.0.0.1' || api.host == '10.0.2.2';
    return Uri(
      scheme: api.scheme == 'https' ? 'wss' : 'ws',
      host: api.host,
      port: local ? 4001 : api.port,
      path: '/ws',
    ).toString();
  }

  /// Deep links arrive as `hariharibol://…` — the backend signs them with the
  /// same scheme (`APP_SCHEME` in its environment).
  static const String appScheme = 'hariharibol';

  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 30);

  /// How long a Server-Sent Events reply may go without a byte. The chat's
  /// server pings every 15 seconds, so this only trips when the line is dead.
  static const Duration streamReceiveTimeout = Duration(seconds: 45);

  /// A picture going up is the one request that sends far more than it gets
  /// back, on whatever signal the phone has.
  static const Duration uploadTimeout = Duration(seconds: 60);

  /// One retry, and only for a request that failed because the access token had
  /// expired. Anything else surfaces to the caller.
  static const int authRetryLimit = 1;

  /// The access token lasts a week; the app swaps it for a new one once it is
  /// this old (on launch, on coming back to the app, and while it is open), so
  /// a person who opens the app now and then never holds an expired one.
  static const Duration accessRenewAfter = Duration(days: 1);

  /// After a renewal that could not be completed — offline, the server busy —
  /// the next try waits this long. The token in hand is still good meanwhile.
  static const Duration renewRetryAfter = Duration(minutes: 15);

  /// Signing in someone from the previous app happens at launch, with the first
  /// screen waiting, so it is given this long in all and then let go: the token
  /// stays on the phone and the next launch tries again. A little longer than
  /// the API's own wait on the old server (8 seconds).
  static const Duration legacySignInTimeout = Duration(seconds: 12);

  /// How long an access token of the previous app can be, and still be sent. The
  /// API refuses anything outside this (`legacyToken` in `routes/app/auth.js`),
  /// so a stray value in that slot is never posted.
  static const int legacyTokenMinLength = 10;
  static const int legacyTokenMaxLength = 300;

  static const int defaultPageSize = 20;

  /// Śrīla Prabhupāda's name is not shown beside his translations and purports
  /// until permission to name him has been given. When it has, set this to true
  /// — that is the whole change. Only the credit goes: his texts are still
  /// shown, and every other translator is still named. The website has the same
  /// switch (`SHOW_AUTHOR_NAME` in `website/src/lib/config.ts`).
  static const bool showAuthorName = false;

  /// The translator [showAuthorName] is about, by the slug both the API and the
  /// offline book copies carry.
  static const String authorSlug = 'prabhupada';

  /// Where readers write about rights in a text or a mistake in one — named on
  /// Settings → Sources & disclaimer; the address the terms page gives too.
  static const String supportEmail = 'support@hariharibol.com';

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
