import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/prayer.dart';
import '../services/prayer_service.dart';
import 'language_chain_provider.dart';
import 'saved_then_fresh.dart';

/// Every published prayer and the categories that have any. One request: the
/// screen narrows by category on the phone. Watches the reading chain, so
/// choosing another reading language words it again at once.
final prayerListProvider = StreamProvider.autoDispose<PrayerList>((ref) {
  final languages = ref.watch(readingChainProvider);
  final service = PrayerService.instance;
  return savedThenFresh(() => service.savedList(languages), () => service.list(languages));
});

/// One prayer in full, by id.
final prayerProvider = StreamProvider.autoDispose.family<Prayer, String>((ref, id) {
  final languages = ref.watch(readingChainProvider);
  final service = PrayerService.instance;
  return savedThenFresh(() => service.savedPrayer(id, languages), () => service.prayer(id, languages));
});
