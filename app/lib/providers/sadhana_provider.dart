import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/sadhana.dart';
import '../services/sadhana_service.dart';

/// Today's practice screen. Re-fetched rather than cached to disk — a round
/// chanted a minute ago, or on another device, should show — but kept alive
/// across tab switches so coming back from the counter does not reshow a
/// spinner over a screen that was already loaded.
class SadhanaTodayNotifier extends AsyncNotifier<SadhanaToday> {
  @override
  Future<SadhanaToday> build() => SadhanaService.instance.today();

  /// Pull to refresh, and every return trip from the counter or the manual
  /// log sheet — both change the day's totals server side.
  Future<void> refresh() async {
    state = await AsyncValue.guard(() => SadhanaService.instance.today());
  }
}

final sadhanaTodayProvider =
    AsyncNotifierProvider<SadhanaTodayNotifier, SadhanaToday>(SadhanaTodayNotifier.new);
