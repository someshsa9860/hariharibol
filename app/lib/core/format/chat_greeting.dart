import 'dart:ui';

import '../../l10n/generated/app_localizations.dart';

/// The line an empty chat opens with: "Hari Bol Asha, how is your heart today?",
/// or "Hari Bol, how is your heart today?" when the account has no name.
///
/// It is written in the reader's *reading* language ([readingChain], best
/// first, as `readingChainProvider` gives it), and it is the app's own text:
/// it is never sent to Sakha, so the first name stays out of every prompt (the
/// server's `{name}` placeholder is how a reply greets, this is the empty screen).
String chatGreeting(List<String> readingChain, String? firstName) {
  final text = lookupAppLocalizations(_greetingLocale(readingChain));
  final name = firstName?.trim() ?? '';
  return name.isEmpty ? text.chatGreeting : text.chatGreetingNamed(name);
}

/// The first language in the chain the app has words for, else English.
Locale _greetingLocale(List<String> readingChain) {
  for (final code in readingChain) {
    for (final locale in AppLocalizations.supportedLocales) {
      if (locale.languageCode == code) return locale;
    }
  }
  return const Locale('en');
}
