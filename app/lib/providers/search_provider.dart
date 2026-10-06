import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/book.dart';
import '../models/mantra.dart';
import '../models/paged.dart';
import '../models/search_result.dart';
import '../models/verse.dart';
import '../services/search_service.dart';

/// The quick preview across all three kinds. Keyed by the query itself and
/// disposed once nothing is watching it, so typing through a dozen queries
/// does not hold a dozen result sets in memory.
final searchOverviewProvider =
    FutureProvider.family.autoDispose<SearchOverview, String>((ref, query) {
  return SearchService.instance.overview(query);
});

/// One kind's full, lazy-loaded list for a query — what a "see all" screen
/// pages through. Same shape for all three kinds; only the fetch call
/// differs, so this is one small notifier per kind rather than a shared
/// abstraction fighting Riverpod's family typing.
class VerseSearchNotifier extends AsyncNotifier<Paged<Verse>> {
  VerseSearchNotifier(this._query);

  final String _query;
  int _page = 1;
  bool _hasMore = true;

  @override
  Future<Paged<Verse>> build() async {
    final page = await SearchService.instance.verses(_query);
    _page = page.page;
    _hasMore = page.hasMore;
    return page;
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !_hasMore) return;

    final next = await SearchService.instance.verses(_query, page: _page + 1);
    _page = next.page;
    _hasMore = next.hasMore;
    state = AsyncData(current.merge(next));
  }
}

class MantraSearchNotifier extends AsyncNotifier<Paged<Mantra>> {
  MantraSearchNotifier(this._query);

  final String _query;
  int _page = 1;
  bool _hasMore = true;

  @override
  Future<Paged<Mantra>> build() async {
    final page = await SearchService.instance.mantras(_query);
    _page = page.page;
    _hasMore = page.hasMore;
    return page;
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !_hasMore) return;

    final next = await SearchService.instance.mantras(_query, page: _page + 1);
    _page = next.page;
    _hasMore = next.hasMore;
    state = AsyncData(current.merge(next));
  }
}

class BookSearchNotifier extends AsyncNotifier<Paged<Book>> {
  BookSearchNotifier(this._query);

  final String _query;
  int _page = 1;
  bool _hasMore = true;

  @override
  Future<Paged<Book>> build() async {
    final page = await SearchService.instance.books(_query);
    _page = page.page;
    _hasMore = page.hasMore;
    return page;
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !_hasMore) return;

    final next = await SearchService.instance.books(_query, page: _page + 1);
    _page = next.page;
    _hasMore = next.hasMore;
    state = AsyncData(current.merge(next));
  }
}

final verseSearchProvider =
    AsyncNotifierProvider.family.autoDispose<VerseSearchNotifier, Paged<Verse>, String>(
  VerseSearchNotifier.new,
);

final mantraSearchProvider =
    AsyncNotifierProvider.family.autoDispose<MantraSearchNotifier, Paged<Mantra>, String>(
  MantraSearchNotifier.new,
);

final bookSearchProvider =
    AsyncNotifierProvider.family.autoDispose<BookSearchNotifier, Paged<Book>, String>(
  BookSearchNotifier.new,
);
