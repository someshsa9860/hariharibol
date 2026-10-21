import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../constants/app_config.dart';
import '../constants/storage_keys.dart';

/// The previous app's access token, where that app left it.
///
/// Nothing in this app writes a token here. It is read at launch by
/// `LegacySignIn` and removed as soon as it has been traded for a session (or
/// the server has said it never will be); this app's own tokens live in the
/// secure store, under names of their own ([SecureKeys]). The previous app's
/// sign-out wipes this slot, so a token that is still here belongs to someone
/// who was signed in when they updated.
///
/// Neither method throws. A phone whose preferences cannot be read has no old
/// session to carry over, and that is never a reason to fail a launch.
class LegacyTokenStore {
  const LegacyTokenStore();

  /// The token, or null when there is none or what is there cannot be one — the
  /// API takes [AppConfig.legacyTokenMinLength] to [AppConfig.legacyTokenMaxLength]
  /// characters and refuses the request outright otherwise.
  Future<String?> read() async {
    try {
      final preferences = await SharedPreferences.getInstance();
      final token = preferences.getString(LegacyKeys.token)?.trim();
      if (token == null) return null;

      final fits = token.length >= AppConfig.legacyTokenMinLength &&
          token.length <= AppConfig.legacyTokenMaxLength;
      return fits ? token : null;
    } catch (error) {
      debugPrint('Could not read the previous app\'s token: $error');
      return null;
    }
  }

  Future<void> clear() async {
    try {
      final preferences = await SharedPreferences.getInstance();
      if (preferences.containsKey(LegacyKeys.token)) {
        await preferences.remove(LegacyKeys.token);
      }
    } catch (error) {
      debugPrint('Could not remove the previous app\'s token: $error');
    }
  }
}
