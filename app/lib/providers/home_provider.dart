import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/home_feed.dart';
import '../services/home_service.dart';

/// The dashboard's data.
///
/// The cached copy of the last response is used as the initial value when there
/// is one, so a cold launch shows the real screen while the network catches up
/// rather than a spinner over an empty page.
class HomeFeedNotifier extends AsyncNotifier<HomeFeed> {
  @override
  Future<HomeFeed> build() async {
    final cached = HomeService.instance.cached();
    if (cached != null) {
      // Serve the cache now, replace it when the request lands. A failure here
      // is deliberately swallowed: the screen already has something true, and
      // an error banner over working content helps nobody.
      unawaited(_refreshQuietly());
      return cached;
    }
    return HomeService.instance.fetch();
  }

  Future<void> _refreshQuietly() async {
    try {
      final fresh = await HomeService.instance.fetch();
      state = AsyncData(fresh);
    } catch (_) {
      // Keep the cached screen.
    }
  }

  /// Pull to refresh. Errors surface here, because the person asked.
  Future<void> refresh() async {
    state = await AsyncValue.guard(() => HomeService.instance.fetch());
  }
}

final homeFeedProvider =
    AsyncNotifierProvider<HomeFeedNotifier, HomeFeed>(HomeFeedNotifier.new);
