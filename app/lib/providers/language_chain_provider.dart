import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'session_provider.dart';

List<String> _chain(Iterable<String?> codes) {
  final seen = <String>{};
  return [
    for (final code in codes)
      if (code != null && code.isNotEmpty && seen.add(code)) code,
  ];
}

/// Languages to read prose in, best first: the reading language, then the app
/// language, then English. Mirrors the server's `readingChain`, so an offline
/// read falls back the way the API would have.
final readingChainProvider = Provider<List<String>>((ref) {
  final user = ref.watch(currentUserProvider);
  return _chain([user?.readingLanguage, user?.appLanguage, 'en']);
});
