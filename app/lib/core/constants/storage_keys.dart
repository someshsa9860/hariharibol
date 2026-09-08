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
  static const String onboardingSeen = 'onboarding.seen';
  static const String lastHomePayload = 'cache.home';
  static const String lastHomeFetchedAt = 'cache.home_at';
}
