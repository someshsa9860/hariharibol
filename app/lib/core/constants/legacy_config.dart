/// Where the previous app kept its sign-in, and how long the new one waits to carry it over.
///
/// The previous app's tokens belong to the previous (Laravel) server. They are read once, on the first launch of
/// this app, traded with this app's own server for a session of its own (`LegacyMigration`), and then deleted.
/// **None of these keys may equal one of `SecureKeys`**: the two apps' tokens are different things and must never
/// overwrite each other (`test/legacy_migration_test.dart` checks).
///
/// The key names are what the previous app used — they could not be read from this repository, so they are the
/// likely names, tried in this order. If the old app used another one, add it here; nothing else changes.
abstract final class LegacyConfig {
  /// Keys in `flutter_secure_storage` (Keychain / Keystore), most likely first.
  static const List<String> secureTokenKeys = ['access_token', 'token', 'accessToken', 'auth_token'];

  /// Keys in `shared_preferences` (the plugin adds its own `flutter.` prefix on Android).
  static const List<String> prefsTokenKeys = ['access_token', 'token', 'accessToken', 'auth_token', 'api_token'];

  /// Shortest value taken for a token; anything shorter is an empty marker, not a credential.
  static const int minTokenLength = 10;

  /// The whole carry-over is given this long before the app opens on its sign-in screen instead. The token is kept,
  /// so the next launch tries again.
  static const Duration attemptTimeout = Duration(seconds: 8);
}
