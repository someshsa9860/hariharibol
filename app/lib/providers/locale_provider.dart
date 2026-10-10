import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import 'language_settings_provider.dart';

/// The shipped locale that matches an account's app language, or null.
///
/// Only a language with an ARB file counts. `MaterialApp.locale` is used as
/// given, without being checked against `supportedLocales`, so passing it
/// "hi" before `app_hi.arb` exists would leave `AppLocalizations.of(context)`
/// with nothing to return. Null hands the choice back to the phone, which
/// resolves to the nearest language that does ship.
Locale? shippedLocaleFor(String? languageCode) {
  for (final locale in AppLocalizations.supportedLocales) {
    if (locale.languageCode == languageCode) return locale;
  }
  return null;
}

/// The language the interface is written in: the app language setting
/// (`languageSettingsProvider`), which defaults to the phone's language when it
/// has an ARB file and English when it does not. Changing it redraws the app
/// without a restart, and touches neither the reading nor the speaking language.
final appLocaleProvider = Provider<Locale?>((ref) {
  return shippedLocaleFor(ref.watch(languageSettingsProvider.select((s) => s.app)));
});
