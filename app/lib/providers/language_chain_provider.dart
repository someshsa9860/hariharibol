import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'language_settings_provider.dart';

List<String> _chain(Iterable<String?> codes) {
  final seen = <String>{};
  return [
    for (final code in codes)
      if (code != null && code.isNotEmpty && seen.add(code)) code,
  ];
}

/// Languages to read prose in, best first: the reading language, then the app
/// language, then English. Mirrors the server's `readingChain`, so an offline
/// read falls back the way the API would have. Reacts to the reading language
/// alone — the speaking language never changes what is shown.
final readingChainProvider = Provider<List<String>>((ref) {
  final settings = ref.watch(languageSettingsProvider);
  return _chain([settings.reading, settings.app, 'en']);
});

/// Languages to speak in, best first: the speaking language, then English.
final speakingChainProvider = Provider<List<String>>((ref) {
  return _chain([ref.watch(languageSettingsProvider.select((s) => s.speaking)), 'en']);
});
