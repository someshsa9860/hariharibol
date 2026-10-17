import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/api_failure.dart';
import '../models/sadhana.dart';
import '../services/sadhana_service.dart';

/// Today's practice screen. The copy saved from the last answer is shown at
/// once and replaced when the network answers, so the Jap tab opens with no
/// connection and a cold launch shows the real screen rather than a spinner. A
/// round chanted a minute ago, or on another device, still shows — the network
/// answer always replaces the copy — and it is kept alive across tab switches so
/// coming back from the counter does not reshow a spinner.
class SadhanaTodayNotifier extends AsyncNotifier<SadhanaToday> {
  /// Where the screen comes from and what was kept of it. Overridden by tests,
  /// which have no network.
  @protected
  Future<SadhanaToday> fetch() => SadhanaService.instance.today();

  @protected
  SadhanaToday? savedCopy() => SadhanaService.instance.saved();

  @override
  Future<SadhanaToday> build() async {
    final saved = savedCopy();
    if (saved != null) {
      // A failure here is deliberately swallowed: the screen already has
      // something true, and an error over working content helps nobody.
      unawaited(_refreshQuietly());
      return saved;
    }
    return fetch();
  }

  Future<void> _refreshQuietly() async {
    try {
      state = AsyncData(await fetch());
    } catch (_) {
      // Keep the saved screen.
    }
  }

  /// Pull to refresh, and every return trip from the counter or the manual
  /// log sheet — both change the day's totals server side.
  ///
  /// A refresh that fails leaves the screen as it was and returns why, for the
  /// caller to tell the person; only a screen with nothing on it turns to an
  /// error.
  Future<ApiFailure?> refresh() async {
    try {
      state = AsyncData(await fetch());
      return null;
    } on ApiFailure catch (failure, stack) {
      if (!state.hasValue) state = AsyncError(failure, stack);
      return failure;
    } catch (error, stack) {
      if (!state.hasValue) state = AsyncError(error, stack);
      return null;
    }
  }
}

final sadhanaTodayProvider =
    AsyncNotifierProvider<SadhanaTodayNotifier, SadhanaToday>(SadhanaTodayNotifier.new);
