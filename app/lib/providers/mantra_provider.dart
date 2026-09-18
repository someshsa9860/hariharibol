import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/mantra.dart';
import '../models/mantra_category.dart';
import '../services/mantra_service.dart';

/// Every category in use, with counts. Fetched once and kept — the list
/// changes about as often as the content does, not on every tab visit.
final mantraCategoriesProvider = FutureProvider<List<MantraCategory>>((ref) {
  return MantraService.instance.categories();
});

/// Mantras in one category, or everything when [category] is null. A family
/// so switching the filter chip does not lose the previous list's cache.
final mantraListProvider =
    FutureProvider.family<List<Mantra>, String?>((ref, category) {
  return MantraService.instance.list(category: category);
});

/// One mantra, by slug — the detail screen and the counter's "chant this"
/// entry point both read it here rather than carrying the whole object
/// through navigation, so a deep link into a mantra works the same way.
final mantraDetailProvider =
    FutureProvider.family.autoDispose<Mantra, String>((ref, slug) {
  return MantraService.instance.get(slug);
});
