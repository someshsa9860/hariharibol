import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../models/auth_session.dart';
import '../constants/storage_keys.dart';

/// The tokens, in the iOS Keychain and, on Android, AES-GCM encrypted with a
/// key wrapped by the hardware Keystore — which is what `AndroidOptions()`
/// gives by default in flutter_secure_storage 11. Nothing outside [AppSession]
/// talks to this class.
class TokenStore {
  const TokenStore();

  static const FlutterSecureStorage _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(),
    // Readable after the first unlock following a reboot, so a background
    // refresh triggered by a push can still reach the token.
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  Future<AuthTokens?> read() async {
    final access = await _storage.read(key: SecureKeys.accessToken);
    final refresh = await _storage.read(key: SecureKeys.refreshToken);
    if (access == null || refresh == null) return null;

    final expiry = await _storage.read(key: SecureKeys.refreshExpiresAt);
    return AuthTokens(
      accessToken: access,
      refreshToken: refresh,
      refreshExpiresAt: expiry == null ? null : DateTime.tryParse(expiry),
    );
  }

  Future<void> write(AuthTokens tokens) async {
    await Future.wait([
      _storage.write(key: SecureKeys.accessToken, value: tokens.accessToken),
      _storage.write(key: SecureKeys.refreshToken, value: tokens.refreshToken),
      _storage.write(
        key: SecureKeys.refreshExpiresAt,
        value: tokens.refreshExpiresAt?.toUtc().toIso8601String(),
      ),
    ]);
  }

  Future<void> clear() async {
    await Future.wait([
      _storage.delete(key: SecureKeys.accessToken),
      _storage.delete(key: SecureKeys.refreshToken),
      _storage.delete(key: SecureKeys.refreshExpiresAt),
    ]);
  }
}
