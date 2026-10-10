import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/constants/storage_keys.dart';
import '../l10n/generated/app_localizations.dart';
import '../models/language_settings.dart';
import '../services/local_store.dart';
import '../services/user_service.dart';
import 'session_provider.dart';

/// The one place any screen reads the three languages from.
///
/// Stored on the device, one key each. A setter changes exactly one slot. The
/// first time (nothing stored) a slot takes the account's choice if there is
/// one, else the phone's language, else English — and the app language only
/// ever takes a language the app is translated into.
///
/// App and reading languages are also sent to the account, best effort, because
/// the server shapes some responses by them (search, notifications). Speaking
/// has no server field and stays on the device.
class LanguageSettingsNotifier extends Notifier<LanguageSettings> {
  @override
  LanguageSettings build() {
    final store = LocalStore.instance;
    final user = ref.read(currentUserProvider);
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
            .then((_) {}, onError: (Object error) {
          if (kDebugMode) debugPrint('[Language] account not updated: $error');
        }),
      );
    }
  }
}

final languageSettingsProvider =
    NotifierProvider<LanguageSettingsNotifier, LanguageSettings>(LanguageSettingsNotifier.new);
