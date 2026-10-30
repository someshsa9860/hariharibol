import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/constants/storage_keys.dart';
import '../l10n/generated/app_localizations.dart';
import '../models/app_user.dart';
import '../models/language_settings.dart';
import '../services/local_store.dart';
import '../services/user_service.dart';
import 'mantra_provider.dart';
import 'session_provider.dart';

/// The one place any screen reads the three languages from.
///
/// Stored on the device, one key each. A setter changes exactly one slot. The
/// first time (nothing stored) a slot takes the account's choice if there is
/// one, else the phone's language, else English — and the app language only
/// ever takes a language the app is translated into. Signing in to an account
/// that already exists (a reinstall, a new phone) writes its app and reading
/// languages to the device, and they are read again here.
///
/// App and reading languages are also sent to the account, best effort, because
/// the server shapes some responses by them (search, notifications). Speaking
/// has no server field and stays on the device.
class LanguageSettingsNotifier extends Notifier<LanguageSettings> {
  @override
  LanguageSettings build() {
    // These are built at launch, before anyone has signed in. Someone who then
    // signs in as a returning account has had their languages written to the
    // device by `AuthService`, so they are read again when the session names a
    // different person. Without the account's fallback: a brand-new account has
    // only the defaults, and must not turn a Hindi phone's screens to English
    // before it has chosen.
    ref.listen(currentUserProvider.select((user) => user?.id), (previous, next) {
      if (next != null && next != previous) state = _read(null);
    });

    return _read(ref.read(currentUserProvider));
  }

  LanguageSettings _read(AppUser? user) {
    final store = LocalStore.instance;
    final device = LanguageDefaults.languageOf(PlatformDispatcher.instance.locale.toLanguageTag());
    final shipped = AppLocalizations.supportedLocales.map((l) => l.languageCode).toSet();

    return LanguageSettings(
      app: LanguageDefaults.resolve(
        stored: store.read<String>(BoxKeys.languageApp),
        account: user?.appLanguage,
        device: device,
        supported: shipped,
      ),
      reading: LanguageDefaults.resolve(
        stored: store.read<String>(BoxKeys.languageReading),
        account: user?.readingLanguage,
        device: device,
      ),
      speaking: LanguageDefaults.resolve(
        stored: store.read<String>(BoxKeys.languageSpeaking),
        device: device,
      ),
    );
  }

  Future<void> setApp(String code) => _set(BoxKeys.languageApp, state.copyWith(app: code), code, syncApp: true);

  Future<void> setReading(String code) =>
      _set(BoxKeys.languageReading, state.copyWith(reading: code), code, syncReading: true);

  Future<void> setSpeaking(String code) => _set(BoxKeys.languageSpeaking, state.copyWith(speaking: code), code);

  /// Takes the account's app and reading languages as the device's own — used
  /// once, right after onboarding saved them to the account.
  Future<void> adopt({required String app, required String reading}) async {
    await LocalStore.instance.write(BoxKeys.languageApp, app);
    await LocalStore.instance.write(BoxKeys.languageReading, reading);
    state = state.copyWith(app: app, reading: reading);
  }

  Future<void> _set(
    String key,
    LanguageSettings next,
    String code, {
    bool syncApp = false,
    bool syncReading = false,
  }) async {
    if (next == state) return;
    state = next;
    await LocalStore.instance.write(key, code);

    if ((syncApp || syncReading) && ref.read(currentUserProvider) != null) {
      unawaited(
        UserService.instance
            .updateLanguages(
              appLanguage: syncApp ? code : null,
              readingLanguage: syncReading ? code : null,
            )
            .then((_) async {
          // The server shapes these by the language it now has on the account, so
          // what is already on screen (a mantra's title and script) is asked for
          // again. The Home feed is not among them: it names the languages itself
          // and rebuilds the moment they change (`homeFeedProvider`).
          await _refetchServerShaped();
        }, onError: (Object error) {
          if (kDebugMode) debugPrint('[Language] account not updated: $error');
        }),
      );
    }
  }

  Future<void> _refetchServerShaped() async {
    // The mantras saved for offline are in the old language; showing one while
    // the new one loads would flash it, and offline they would keep it.
    await LocalStore.instance.deleteWithPrefix(BoxKeys.mantraCachePrefix);
    if (!ref.mounted) return;

    ref
      ..invalidate(mantraListProvider)
      ..invalidate(mantraDetailProvider);
  }
}

final languageSettingsProvider =
    NotifierProvider<LanguageSettingsNotifier, LanguageSettings>(LanguageSettingsNotifier.new);
