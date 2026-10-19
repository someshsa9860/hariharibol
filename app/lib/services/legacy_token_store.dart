import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/constants/legacy_config.dart';

/// A token as the previous app stored it, made fit to send: surrounding quotes and a `Bearer ` prefix taken off,
/// whitespace trimmed. Null when nothing usable is left (too short to be a credential).
String? cleanLegacyToken(Object? raw) {
  if (raw is! String) return null;

  var value = raw.trim();
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    value = value.substring(1, value.length - 1).trim();
  }
  if (value.toLowerCase().startsWith('bearer ')) value = value.substring(7).trim();

  return value.length < LegacyConfig.minTokenLength ? null : value;
}

/// Reads — and afterwards deletes — the sign-in the previous app left on this phone.
///
/// Both places a token is usually kept are looked in: the Keychain / Keystore (`flutter_secure_storage`) and
/// plain `shared_preferences`. Nothing here ever throws: a platform error, or a value the new plugin cannot
/// decrypt, is the same as no token, and the person is simply shown the sign-in screen.
class LegacyTokenStore {
  const LegacyTokenStore({FlutterSecureStorage? secure})
      : _secure = secure ?? const FlutterSecureStorage(aOptions: AndroidOptions());

  final FlutterSecureStorage _secure;

  Future<String?> read() async {
    for (final key in LegacyConfig.secureTokenKeys) {
      try {
        final token = cleanLegacyToken(await _secure.read(key: key));
        if (token != null) return token;
      } catch (error) {
        debugPrint('Previous app token ($key) not readable from secure storage: $error');
      }
    }

    try {
      final prefs = await SharedPreferences.getInstance();
      for (final key in LegacyConfig.prefsTokenKeys) {
        // `get`, not `getString`: a key holding a number or a list must not throw.
        final token = cleanLegacyToken(prefs.get(key));
        if (token != null) return token;
      }
    } catch (error) {
      debugPrint('Previous app token not readable from shared preferences: $error');
    }
    return null;
  }

  /// Once the account has been carried over (or the old server has said it does not know the token) the old
  /// credential has no further use, and it should not outlive its purpose on the phone.
  Future<void> clear() async {
    for (final key in LegacyConfig.secureTokenKeys) {
      try {
        await _secure.delete(key: key);
      } catch (error) {
        debugPrint('Could not delete previous app token ($key): $error');
      }
    }
    try {
      final prefs = await SharedPreferences.getInstance();
      for (final key in LegacyConfig.prefsTokenKeys) {
        await prefs.remove(key);
      }
    } catch (error) {
      debugPrint('Could not delete previous app token from shared preferences: $error');
    }
  }
}
