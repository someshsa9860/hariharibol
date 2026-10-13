/// What a push notification's data carries, and the deeplinks it can point at.
///
/// The backend writes these (`backend/utils/sloka-push.js`, `jobs/processors/`);
/// the names here have to match what it sends. Every value arrives as a string.
abstract final class PushConfig {
  // ── A verse's place in its book (the daily sloka) ───────────────────────
  static const String bookSlugKey = 'bookSlug';
  static const String cantoNumberKey = 'cantoNumber';
  static const String chapterNumberKey = 'chapterNumber';
  static const String verseNumberKey = 'verseNumber';

  // ── The deeplink a notification names, for the ones that are not a verse ─
  static const String deeplinkKey = 'deeplink';
  static const String deeplinkScheme = 'hariharibol';
  static const String deeplinkSadhana = 'sadhana';
  static const String deeplinkPremium = 'premium';

  // ── Drawing a push while the app is open (Android) ──────────────────────
  /// The channel the backend names on every push (`backend/services/fcm.js`).
  /// Creating it here is what gives it a name in the phone's settings, and the
  /// importance that makes a push appear on screen; the notification drawn
  /// while the app is open goes to the same channel.
  static const String androidChannelId = 'default';

  /// The small icon of a notification drawn by the app: the drawable the
  /// manifest names as Firebase's default icon (`ic_stat_feather.xml`).
  static const String androidSmallIcon = 'ic_stat_feather';

  /// The push's picture is fetched by the app, so these bound that fetch. A
  /// card is a ~100 KB JPEG; Android's own limit for a picture is 1 MB.
  static const Duration imageConnectTimeout = Duration(seconds: 5);
  static const Duration imageReceiveTimeout = Duration(seconds: 10);
  static const int imageMaxBytes = 1024 * 1024;
}
