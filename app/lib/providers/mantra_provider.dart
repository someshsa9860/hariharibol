import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/mantra.dart';
import '../models/mantra_category.dart';
import '../services/mantra_service.dart';

/// What the phone last saved, at once, then what the network says.
///
/// This is what lets the Jap tab work with no connection: the saved copy draws
/// the screen and a failed request leaves it standing — no error is shown over
/// something true. With nothing saved yet (a first launch) the request's own
/// answer, or failure, is all there is.
///
/// The request is started before the saved copy is handed over, so the cache is
/// refreshed even when a reader takes the first value and lets go.
Stream<T> savedThenFresh<T>(T? Function() saved, Future<T> Function() fetch) async* {
  final fresh = fetch()..ignore();
  final copy = saved();

  if (copy == null) {
    yield await fresh;
    return;
  }

  yield copy;
  try {
    yield await fresh;
  } catch (_) {
    // Offline or the server is down: the saved copy stays.
  }
}

/// Every category in use, with counts. Fetched once and kept — the list
/// changes about as often as the content does, not on every tab visit.
final mantraCategoriesProvider = StreamProvider<List<MantraCategory>>((ref) {
  final service = MantraService.instance;
  return savedThenFresh(service.savedCategories, service.categories);
});

/// Mantras in one category, or everything when [category] is null. A family
/// so switching the filter chip does not lose the previous list's cache.
final mantraListProvider = StreamProvider.family<List<Mantra>, String?>((ref, category) {
  final service = MantraService.instance;
  return savedThenFresh(
    () => service.savedList(category: category),
    () => service.list(category: category),
  );
});

/// One mantra, by slug — the detail screen and the counter's "chant this"
/// entry point both read it here rather than carrying the whole object
/// through navigation, so a deep link into a mantra works the same way.
final mantraDetailProvider = StreamProvider.family.autoDispose<Mantra, String>((ref, slug) {
  final service = MantraService.instance;
  return savedThenFresh(() => service.savedMantra(slug), () => service.get(slug));
});
