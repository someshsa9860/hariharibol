/// Keys for the two stores, so a typo cannot silently orphan saved state.
///
/// Tokens live in `flutter_secure_storage` (Keychain / Keystore) because they
/// are credentials. Everything else lives in a `hive_ce` box.
abstract final class SecureKeys {
  static const String accessToken = 'auth.access_token';
  static const String refreshToken = 'auth.refresh_token';
  static const String refreshExpiresAt = 'auth.refresh_expires_at';
}

abstract final class BoxNames {
  static const String app = 'app';
}

abstract final class BoxKeys {
  /// The signed-in user, as returned by the API. Kept so the app can draw the
  /// first frame without waiting on the network.
  static const String user = 'user';

  /// A stable per-install id sent as `X-Device-Id`. Generated once.
  static const String deviceId = 'device.id';

  static const String themeMode = 'settings.theme_mode';
  static const String locale = 'settings.locale';

  /// The three independent language settings (LanguageSettings). Each is its
  /// own key so changing one cannot touch the others.
  static const String languageApp = 'settings.language.app';
  static const String languageReading = 'settings.language.reading';
  static const String languageSpeaking = 'settings.language.speaking';
  static const String readingFontSize = 'settings.reading_font_size';

  /// Chapter → the verse the audio last played there.
  static const String readingLastPlayed = 'reading.last_played';

  /// Hold the silent book sync to Wi-Fi. Off by default: it is small, and
  /// the point is that the reader never has to think about it.
  static const String syncWifiOnly = 'settings.sync_wifi_only';
  static const String onboardingSeen = 'onboarding.seen';
  static const String lastHomePayload = 'cache.home';
  static const String lastHomeFetchedAt = 'cache.home_at';

  /// The tasks added for a particular day, device-only until a backend model
  /// exists for them. Each carries the day it belongs to.
  static const String routineTasks = 'routine.tasks';

  /// The optional daily routine: items that repeat every day from the day they
  /// were added.
  static const String routineDaily = 'routine.daily';

  /// Which daily items were checked on which day: `{ '2026-10-11': [id, …] }`.
  static const String routineChecks = 'routine.checks';

  /// Legacy. Before tasks carried their own day this held the one day the list
  /// belonged to; it is read once, to date tasks saved by that version.
  static const String routineDate = 'routine.date';
}
