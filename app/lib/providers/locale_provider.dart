import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import 'session_provider.dart';

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

/// The language the interface is written in: the one the account chose.
///
/// Null until someone is signed in — sign-in and the language picker are the
/// first screens anyone sees, and they follow the phone. Changing the language
/// in settings updates the session's user, which lands here and redraws the
/// app without a restart.
final appLocaleProvider = Provider<Locale?>((ref) {
  return shippedLocaleFor(ref.watch(currentUserProvider)?.appLanguage);
});
