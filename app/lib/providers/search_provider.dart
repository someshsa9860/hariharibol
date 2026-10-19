import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/book.dart';
import '../models/mantra.dart';
import '../models/paged.dart';
import '../models/search_result.dart';
import '../models/verse.dart';
import '../services/search_service.dart';

/// The quick preview across all three kinds, with the count of each. Keyed by the
/// search itself and disposed once nothing is watching it, so typing through a
/// dozen queries does not hold a dozen result sets in memory.
final searchOverviewProvider =
    FutureProvider.family.autoDispose<SearchOverview, SearchRequest>((ref, request) {
  return SearchService.instance.overview(request);
});

/// One kind's full list for a search, a page at a time — what a results tab
/// scrolls through. The same behaviour for all three kinds; only the fetch call
/// differs, so a subclass is one method.
abstract class PagedSearchNotifier<T> extends AsyncNotifier<Paged<T>> {
  PagedSearchNotifier(this.request);

  final SearchRequest request;
  bool _loading = false;

  Future<Paged<T>> fetch(int page);

  @override
  Future<Paged<T>> build() => fetch(1);

  /// Asks for the next page. A request already under way, or nothing left to
  /// ask for, does nothing; a failure keeps what is on screen and says so
  /// ([Paged.loadMoreFailed]) so the list can offer to try again.
  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !current.hasMore || _loading) return;

    _loading = true;
    try {
      final next = await fetch(current.page + 1);
      state = AsyncData(current.merge(next));
    } catch (_) {
      state = AsyncData(current.withLoadMoreFailed(true));
    } finally {
      _loading = false;
    }
  }
}

class VerseSearchNotifier extends PagedSearchNotifier<Verse> {
  VerseSearchNotifier(super.request);

  @override
  Future<Paged<Verse>> fetch(int page) => SearchService.instance.verses(request, page: page);
}

class MantraSearchNotifier extends PagedSearchNotifier<Mantra> {
  MantraSearchNotifier(super.request);

  @override
  Future<Paged<Mantra>> fetch(int page) => SearchService.instance.mantras(request, page: page);
}

class BookSearchNotifier extends PagedSearchNotifier<Book> {
  BookSearchNotifier(super.request);

  @override
  Future<Paged<Book>> fetch(int page) => SearchService.instance.books(request, page: page);
}

final verseSearchProvider = AsyncNotifierProvider.family
    .autoDispose<VerseSearchNotifier, Paged<Verse>, SearchRequest>(VerseSearchNotifier.new);

final mantraSearchProvider = AsyncNotifierProvider.family
    .autoDispose<MantraSearchNotifier, Paged<Mantra>, SearchRequest>(MantraSearchNotifier.new);

final bookSearchProvider = AsyncNotifierProvider.family
    .autoDispose<BookSearchNotifier, Paged<Book>, SearchRequest>(BookSearchNotifier.new);
