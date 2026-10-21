import 'dart:async';

import 'package:flutter/foundation.dart' show listEquals;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/home_feed.dart';
import '../services/home_service.dart';
import 'language_chain_provider.dart';

/// The service behind the dashboard. A provider so a test can hand in one that
/// talks to a scripted server.
final homeServiceProvider = Provider<HomeService>((ref) => HomeService.instance);

/// The dashboard's data, in the reader's reading languages.
///
/// It watches the reading chain, so choosing another reading (or app) language
/// builds it again at once — the verse of the day, the mantras and the books
/// come back in the new language without waiting for the account to hear of the
/// change, and the call names the languages itself (`HomeService.fetch`).
///
/// The cached copy of the last response is the initial value when there is one
/// **in these languages**, so a cold launch shows the real screen while the
/// network catches up rather than a spinner over an empty page. A copy in another
/// language is never shown as the answer; it is only what is left on screen if
/// the new one cannot be had (offline), because something true beats an error.
class HomeFeedNotifier extends AsyncNotifier<HomeFeed> {
  @override
  Future<HomeFeed> build() async {
    final languages = ref.watch(readingChainProvider);
    final service = ref.read(homeServiceProvider);

    final cached = service.cached(languages: languages);
    if (cached != null) {
      // Serve the cache now, replace it when the request lands. A failure here
      // is deliberately swallowed: the screen already has something true, and
      // an error banner over working content helps nobody.
      unawaited(_refreshQuietly(languages));
      return cached;
    }

    try {
      return await service.fetch(languages: languages);
    } catch (_) {
      final other = service.cached();
      if (other != null) return other;
      rethrow;
    }
  }

  Future<void> _refreshQuietly(List<String> languages) async {
    try {
      final fresh = await ref.read(homeServiceProvider).fetch(languages: languages);
      // The reader may have changed language while this was away; an answer in
      // the language they left must not land on top of the one they chose.
      if (!ref.mounted || !listEquals(languages, ref.read(readingChainProvider))) return;
      state = AsyncData(fresh);
    } catch (_) {
      // Keep the cached screen.
    }
  }

  /// Pull to refresh. Errors surface here, because the person asked.
  Future<void> refresh() async {
    state = await AsyncValue.guard(() {
      final languages = ref.read(readingChainProvider);
      return ref.read(homeServiceProvider).fetch(languages: languages);
    });
  }
}

final homeFeedProvider =
    AsyncNotifierProvider<HomeFeedNotifier, HomeFeed>(HomeFeedNotifier.new);
