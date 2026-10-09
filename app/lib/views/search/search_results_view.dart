import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/book.dart';
import '../../models/mantra.dart';
import '../../models/paged.dart';
import '../../models/search_result.dart';
import '../../models/verse.dart';
import '../../providers/search_provider.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/search/book_result_tile.dart';
import '../../widgets/search/mantra_result_tile.dart';
import '../../widgets/search/verse_result_tile.dart';

/// The full list for one kind of a search — what "see all" opens.
///
/// Fetches a page at a time as the reader nears the bottom. Nothing is held
/// beyond what has actually scrolled past — this is a window onto the
/// server's index, not a copy of it.
class SearchResultsView extends ConsumerStatefulWidget {
  const SearchResultsView({super.key, required this.scope, required this.query});

  final SearchScope scope;
  final String query;

  @override
  ConsumerState<SearchResultsView> createState() => _SearchResultsViewState();
}

class _SearchResultsViewState extends ConsumerState<SearchResultsView> {
  final ScrollController _scroll = ScrollController();

  /// How far from the bottom the next page is asked for — early enough that
  /// scrolling never outruns the fetch and shows an empty gap.
  static const double _loadMoreAt = 400;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
  }

  void _onScroll() {
    if (!_scroll.hasClients) return;
    final remaining = _scroll.position.maxScrollExtent - _scroll.position.pixels;
    if (remaining < _loadMoreAt) _loadMore();
  }

  void _loadMore() {
    switch (widget.scope) {
      case SearchScope.verse:
        ref.read(verseSearchProvider(widget.query).notifier).loadMore();
      case SearchScope.mantra:
        ref.read(mantraSearchProvider(widget.query).notifier).loadMore();
      case SearchScope.book:
        ref.read(bookSearchProvider(widget.query).notifier).loadMore();
    }
  }

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    super.dispose();
  }

  String _kindLabel(AppLocalizations text) => switch (widget.scope) {
        SearchScope.verse => text.searchSectionVerses,
        SearchScope.mantra => text.homeMantras,
        SearchScope.book => text.homeBooks,
      };

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(text.searchResultsTitle(_kindLabel(text), widget.query))),
      body: switch (widget.scope) {
        SearchScope.verse => _VerseResults(query: widget.query, controller: _scroll),
        SearchScope.mantra => _MantraResults(query: widget.query, controller: _scroll),
        SearchScope.book => _BookResults(query: widget.query, controller: _scroll),
      },
    );
  }
}

/// One error/empty/loading shell shared by the three lists below, since a
/// [Paged] behaves the same regardless of what it holds.
class _ResultShell<T> extends StatelessWidget {
  const _ResultShell({
    required this.state,
    required this.controller,
    required this.itemBuilder,
    required this.onRetry,
  });

  final AsyncValue<Paged<T>> state;
  final ScrollController controller;
  final Widget Function(BuildContext, T) itemBuilder;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return state.when(
      loading: () => const AppLoader(),
      error: (error, _) => AppErrorView(
        failure: error is ApiFailure
            ? error
            : ApiFailure(kind: FailureKind.unknown, message: text.errorGeneric),
        onRetry: onRetry,
      ),
      data: (page) => page.items.isEmpty
          ? Center(child: EmptyState(message: text.searchNoResults, icon: Icons.search_off_rounded))
          : ListView.separated(
              controller: controller,
              padding: AppSpacing.page,
              itemCount: page.items.length,
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
              itemBuilder: (context, index) => itemBuilder(context, page.items[index]),
            ),
    );
  }
}

class _VerseResults extends ConsumerWidget {
  const _VerseResults({required this.query, required this.controller});

  final String query;
  final ScrollController controller;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _ResultShell<Verse>(
      state: ref.watch(verseSearchProvider(query)),
      controller: controller,
      onRetry: () async => ref.invalidate(verseSearchProvider(query)),
      itemBuilder: (context, verse) => VerseResultTile(
        verse: verse,
        onTap: verse.readingPath == null
            ? null
            : () => AppNavigator.instance.push(verse.readingPath!),
      ),
    );
  }
}

class _MantraResults extends ConsumerWidget {
  const _MantraResults({required this.query, required this.controller});

  final String query;
  final ScrollController controller;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _ResultShell<Mantra>(
      state: ref.watch(mantraSearchProvider(query)),
      controller: controller,
      onRetry: () async => ref.invalidate(mantraSearchProvider(query)),
      itemBuilder: (context, mantra) => MantraResultTile(
        mantra: mantra,
        onTap: () => AppNavigator.instance.push(AppRoutes.mantraPath(mantra.slug)),
      ),
    );
  }
}

class _BookResults extends ConsumerWidget {
  const _BookResults({required this.query, required this.controller});

  final String query;
  final ScrollController controller;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _ResultShell<Book>(
      state: ref.watch(bookSearchProvider(query)),
      controller: controller,
      onRetry: () async => ref.invalidate(bookSearchProvider(query)),
      itemBuilder: (context, book) => BookResultTile(
        book: book,
        onTap: () => AppNavigator.instance.push(AppRoutes.bookPath(book.slug)),
      ),
    );
  }
}
