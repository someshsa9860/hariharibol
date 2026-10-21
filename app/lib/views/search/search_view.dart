import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/book.dart';
import '../../models/mantra.dart';
import '../../models/paged.dart';
import '../../models/search_result.dart';
import '../../models/verse.dart';
import '../../providers/book_provider.dart';
import '../../providers/language_chain_provider.dart';
import '../../providers/search_provider.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/common/section_header.dart';
import '../../widgets/search/book_result_tile.dart';
import '../../widgets/search/mantra_result_tile.dart';
import '../../widgets/search/search_field.dart';
import '../../widgets/search/verse_result_tile.dart';

/// The library's one search box.
///
/// Every keystroke, debounced, goes to the server — there is no local index
/// to fall back to, so what is on screen is always what the server currently
/// holds. The server forgives spelling, spacing and a book named at the start
/// of the query ("gita karma"); a row of book chips narrows it the same way
/// with a tap, and tabs switch between everything and one kind, which pages
/// as the reader scrolls. A dotted verse id or a book's own shorthand
/// ("BG 2.47") is a direct jump rather than a search.
class SearchView extends ConsumerStatefulWidget {
  const SearchView({super.key});

  @override
  ConsumerState<SearchView> createState() => _SearchViewState();
}

class _SearchViewState extends ConsumerState<SearchView> {
  final TextEditingController _controller = TextEditingController();
  Timer? _debounce;

  /// What has been searched for, once typing paused.
  String _query = '';

  /// The book chosen with a chip (a slug); null searches every book.
  String? _book;

  /// The kind the tabs show; null is everything together.
  SearchScope? _tab;

  /// The last overview that arrived, kept on screen while the next one loads so
  /// the results do not blink away on every pause in typing.
  SearchOverview? _lastOverview;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  bool get _searching => _query.length >= 2;

  SearchRequest get _request => SearchRequest(_query, book: _book);

  void _setQuery(String value) {
    final query = value.trim();
    if (query == _query) return;
    setState(() {
      _query = query;
      if (query.length < 2) _lastOverview = null;
    });
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(AppDurations.searchDebounce, () {
      if (mounted) _setQuery(value);
    });
  }

  void _submit(String value) {
    _debounce?.cancel();
    _setQuery(value);
  }

  void _useExample(String example) {
    _controller.text = example;
    _controller.selection = TextSelection.collapsed(offset: example.length);
    _submit(example);
  }

  void _clear() {
    _debounce?.cancel();
    _controller.clear();
    setState(() {
      _query = '';
      _lastOverview = null;
      _tab = null;
    });
  }

  /// A book chip was tapped ([slug] null is "All books"). When the book had been
  /// named in the typed query, its name comes out of the box so the chip is what
  /// decides.
  void _chooseBook(String? slug, SearchBookScope? named) {
    _debounce?.cancel();
    if (named != null && named.fromQuery) {
      _controller.text = named.text;
      _controller.selection = TextSelection.collapsed(offset: named.text.length);
    }
    setState(() {
      _book = slug;
      if (named != null && named.fromQuery) _query = named.text.trim();
      if (_query.length < 2) _lastOverview = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    SearchOverview? overview;
    AsyncValue<SearchOverview>? overviewState;
    if (_searching) {
      final state = ref.watch(searchOverviewProvider(_request));
      if (state.hasValue) _lastOverview = state.value;
      overview = state.value ?? _lastOverview;
      overviewState = state;
    }

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: SearchField(
          controller: _controller,
          hint: text.searchHint,
          onChanged: _onChanged,
          onSubmitted: _submit,
          onClear: _clear,
        ),
        actions: const [SizedBox(width: AppSpacing.lg)],
      ),
      body: SafeArea(
        child: Column(
          children: [
            _BookChips(
              selected: _book ?? overview?.scope?.slug,
              named: overview?.scope,
              onChoose: _chooseBook,
            ),
            if (_searching && overview != null)
              _KindTabs(overview: overview, selected: _tab, onSelect: (tab) => setState(() => _tab = tab)),
            if (overview?.corrected != null)
              _CorrectedNote(corrected: overview!.corrected!),
            Expanded(
              child: !_searching
                  ? _SearchLanding(onExampleTap: _useExample)
                  : _SearchResults(
                      request: _request,
                      overview: overview,
                      state: overviewState!,
                      tab: _tab,
                      onSeeAll: (tab) => setState(() => _tab = tab),
                      onAllBooks: () => _chooseBook(null, overview?.scope),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── the chips and tabs above the results ────────────────────────────────────

/// "All books" and one chip per book. A book named in the query shows as chosen.
class _BookChips extends ConsumerWidget {
  const _BookChips({required this.selected, required this.named, required this.onChoose});

  final String? selected;
  final SearchBookScope? named;
  final void Function(String? slug, SearchBookScope? named) onChoose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final books = ref.watch(booksProvider).value ?? const <Book>[];
    if (books.isEmpty) return const SizedBox.shrink();

    final chain = ref.watch(readingChainProvider);
    final text = AppLocalizations.of(context);

    return SizedBox(
      height: 52,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
        children: [
          _Choice(
            label: text.searchAllBooks,
            selected: selected == null,
            onTap: () => onChoose(null, named),
          ),
          for (final book in books)
            _Choice(
              label: book.titleFor(chain),
              selected: selected == book.slug,
              onTap: () => onChoose(book.slug, named),
            ),
        ],
      ),
    );
  }
}

class _Choice extends StatelessWidget {
  const _Choice({required this.label, required this.selected, required this.onTap, this.count});

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final int? count;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final style = context.texts.labelLarge?.copyWith(
      color: selected ? colors.onPrimaryContainer : colors.onSurface,
    );

    return Padding(
      padding: const EdgeInsets.only(right: AppSpacing.sm),
      child: ChoiceChip(
        selected: selected,
        onSelected: (_) => onTap(),
        showCheckmark: false,
        label: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(label, style: style),
            if (count != null && count! > 0) ...[
              const SizedBox(width: AppSpacing.xs + 2),
              Text(
                '$count',
                style: context.texts.labelSmall?.copyWith(
                  color: selected ? colors.onPrimaryContainer : colors.onSurfaceVariant,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Everything, or one kind. A kind with nothing found is not offered.
class _KindTabs extends StatelessWidget {
  const _KindTabs({required this.overview, required this.selected, required this.onSelect});

  final SearchOverview overview;
  final SearchScope? selected;
  final ValueChanged<SearchScope?> onSelect;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return SizedBox(
      height: 44,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
        children: [
          _Choice(label: text.searchTabAll, selected: selected == null, onTap: () => onSelect(null)),
          _Choice(
            label: text.searchSectionVerses,
            count: overview.verseTotal,
            selected: selected == SearchScope.verse,
            onTap: () => onSelect(SearchScope.verse),
          ),
          if (overview.mantraTotal > 0)
            _Choice(
              label: text.homeMantras,
              count: overview.mantraTotal,
              selected: selected == SearchScope.mantra,
              onTap: () => onSelect(SearchScope.mantra),
            ),
          if (overview.bookTotal > 0)
            _Choice(
              label: text.homeBooks,
              count: overview.bookTotal,
              selected: selected == SearchScope.book,
              onTap: () => onSelect(SearchScope.book),
            ),
        ],
      ),
    );
  }
}

/// Said when the words typed were read as a nearby spelling.
class _CorrectedNote extends StatelessWidget {
  const _CorrectedNote({required this.corrected});

  final String corrected;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.xs, AppSpacing.lg, AppSpacing.xs),
      child: Row(
        children: [
          Icon(Icons.auto_fix_high_rounded, size: AppSizes.iconSm, color: context.colors.primary),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              text.searchShowingFor(corrected),
              style: context.texts.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── before there is anything to search for ──────────────────────────────────

/// Shown before a query is long enough to search: what the box understands, and
/// the shortcuts, which are the fastest way to a verse this app has.
class _SearchLanding extends StatelessWidget {
  const _SearchLanding({required this.onExampleTap});

  final ValueChanged<String> onExampleTap;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final bg = '${text.reelBookGita} 2.47';
    final sb = '${text.reelBookBhagavatam} 1.3.28';

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(AppSpacing.xl, AppSpacing.xl, AppSpacing.xl, AppSpacing.xxxl),
      child: Column(
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(color: context.colors.primaryContainer, shape: BoxShape.circle),
            child: Icon(Icons.search_rounded, size: AppSizes.iconLg, color: context.colors.onPrimaryContainer),
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(
            text.searchPrompt,
            textAlign: TextAlign.center,
            style: context.texts.bodyLarge?.copyWith(color: context.colors.onSurfaceVariant),
          ),
          const SizedBox(height: AppSpacing.xl),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: Text(text.searchTipsTitle, style: context.texts.titleSmall),
          ),
          const SizedBox(height: AppSpacing.md),
          _Tip(icon: Icons.spellcheck_rounded, text: text.searchTipSpelling),
          _Tip(icon: Icons.menu_book_outlined, text: text.searchTipBook),
          _Tip(icon: Icons.manage_search_rounded, text: text.searchTipPartial),
          const SizedBox(height: AppSpacing.xl),
          Text(text.searchShortcutLabel, style: context.texts.labelLarge),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            alignment: WrapAlignment.center,
            children: [
              ActionChip(label: Text(bg), onPressed: () => onExampleTap(bg)),
              ActionChip(label: Text(sb), onPressed: () => onExampleTap(sb)),
            ],
          ),
        ],
      ),
    );
  }
}

class _Tip extends StatelessWidget {
  const _Tip({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: context.colors.surfaceContainerHighest,
              borderRadius: AppRadius.smAll,
            ),
            child: Icon(icon, size: AppSizes.iconSm + 2, color: context.colors.primary),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: AppSpacing.xs),
              child: Text(
                text,
                style: context.texts.bodyMedium?.copyWith(
                  color: context.colors.onSurfaceVariant,
                  height: 1.4,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── the results ─────────────────────────────────────────────────────────────

class _SearchResults extends ConsumerWidget {
  const _SearchResults({
    required this.request,
    required this.overview,
    required this.state,
    required this.tab,
    required this.onSeeAll,
    required this.onAllBooks,
  });

  final SearchRequest request;
  final SearchOverview? overview;
  final AsyncValue<SearchOverview> state;
  final SearchScope? tab;
  final ValueChanged<SearchScope> onSeeAll;
  final VoidCallback onAllBooks;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final data = overview;

    if (data == null || (state.hasError && !state.hasValue)) {
      return state.when(
        loading: () => const AppLoader(),
        error: (error, _) => AppErrorView(
          failure: error is ApiFailure
              ? error
              : ApiFailure(kind: FailureKind.unknown, message: text.errorGeneric),
          onRetry: () async => ref.invalidate(searchOverviewProvider(request)),
        ),
        data: (_) => const SizedBox.shrink(),
      );
    }

    if (data.isEmpty) {
      return Center(
        child: SingleChildScrollView(
          child: EmptyState(
            message: data.scope != null
                ? text.searchNoResultsInBook(data.scope!.title)
                : text.searchNoResults,
            icon: Icons.search_off_rounded,
            action: data.scope != null
                ? OutlinedButton(onPressed: onAllBooks, child: Text(text.searchAllBooks))
                : null,
          ),
        ),
      );
    }

    // The previous results stay, dimmed, while the next ones load.
    final loading = state.isLoading && !state.hasValue;
    final body = switch (tab) {
      SearchScope.verse => _VerseList(request: request),
      SearchScope.mantra => _MantraList(request: request),
      SearchScope.book => _BookList(request: request),
      null => _Overview(overview: data, onSeeAll: onSeeAll),
    };

    return Stack(
      children: [
        AnimatedOpacity(duration: AppDurations.fast, opacity: loading ? 0.45 : 1, child: body),
        if (loading) const Positioned(top: 0, left: 0, right: 0, child: LinearProgressIndicator(minHeight: 2)),
      ],
    );
  }
}

/// The first few of each kind, each with a way to see all of them.
class _Overview extends StatelessWidget {
  const _Overview({required this.overview, required this.onSeeAll});

  final SearchOverview overview;
  final ValueChanged<SearchScope> onSeeAll;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return ListView(
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.xxxl),
      children: [
        if (overview.verses.isNotEmpty)
          _Section(
            title: text.searchSectionVerses,
            onViewAll: overview.verseHasMore ? () => onSeeAll(SearchScope.verse) : null,
            children: [for (final verse in overview.verses) _verseTile(verse)],
          ),
        if (overview.mantras.isNotEmpty)
          _Section(
            title: text.homeMantras,
            onViewAll: overview.mantraHasMore ? () => onSeeAll(SearchScope.mantra) : null,
            children: [for (final mantra in overview.mantras) _mantraTile(mantra)],
          ),
        if (overview.books.isNotEmpty)
          _Section(
            title: text.homeBooks,
            onViewAll: overview.bookHasMore ? () => onSeeAll(SearchScope.book) : null,
            children: [for (final book in overview.books) _bookTile(book)],
          ),
      ],
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children, this.onViewAll});

  final String title;
  final List<Widget> children;
  final VoidCallback? onViewAll;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(title: title, onViewAll: onViewAll),
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) const SizedBox(height: AppSpacing.md),
            children[i],
          ],
        ],
      ),
    );
  }
}

Widget _verseTile(Verse verse) => VerseResultTile(
      verse: verse,
      onTap: verse.readingPath == null ? null : () => AppNavigator.instance.push(verse.readingPath!),
    );

Widget _mantraTile(Mantra mantra) => MantraResultTile(
      mantra: mantra,
      onTap: () => AppNavigator.instance.push(AppRoutes.mantraPath(mantra.slug)),
    );

Widget _bookTile(Book book) => BookResultTile(
      book: book,
      onTap: () => AppNavigator.instance.push(AppRoutes.bookPath(book.slug)),
    );

// ─── one kind, a page at a time ──────────────────────────────────────────────

class _VerseList extends StatelessWidget {
  const _VerseList({required this.request});

  final SearchRequest request;

  @override
  Widget build(BuildContext context) => _PagedList<Verse>(
        key: ValueKey(('verse', request)),
        watch: (ref) => ref.watch(verseSearchProvider(request)),
        loadMore: (ref) => ref.read(verseSearchProvider(request).notifier).loadMore(),
        reload: (ref) => ref.invalidate(verseSearchProvider(request)),
        itemBuilder: _verseTile,
      );
}

class _MantraList extends StatelessWidget {
  const _MantraList({required this.request});

  final SearchRequest request;

  @override
  Widget build(BuildContext context) => _PagedList<Mantra>(
        key: ValueKey(('mantra', request)),
        watch: (ref) => ref.watch(mantraSearchProvider(request)),
        loadMore: (ref) => ref.read(mantraSearchProvider(request).notifier).loadMore(),
        reload: (ref) => ref.invalidate(mantraSearchProvider(request)),
        itemBuilder: _mantraTile,
      );
}

class _BookList extends StatelessWidget {
  const _BookList({required this.request});

  final SearchRequest request;

  @override
  Widget build(BuildContext context) => _PagedList<Book>(
        key: ValueKey(('book', request)),
        watch: (ref) => ref.watch(bookSearchProvider(request)),
        loadMore: (ref) => ref.read(bookSearchProvider(request).notifier).loadMore(),
        reload: (ref) => ref.invalidate(bookSearchProvider(request)),
        itemBuilder: _bookTile,
      );
}

/// A list that asks for its next page as the reader nears the bottom. Nothing is
/// held beyond what has scrolled in — this is a window onto the server's index,
/// not a copy of it. A short first page that does not fill the screen asks for
/// the next straight away, since there is nothing to scroll to trigger it.
class _PagedList<T> extends ConsumerStatefulWidget {
  const _PagedList({
    super.key,
    required this.watch,
    required this.loadMore,
    required this.reload,
    required this.itemBuilder,
  });

  final AsyncValue<Paged<T>> Function(WidgetRef ref) watch;
  final Future<void> Function(WidgetRef ref) loadMore;
  final void Function(WidgetRef ref) reload;
  final Widget Function(T item) itemBuilder;

  @override
  ConsumerState<_PagedList<T>> createState() => _PagedListState<T>();
}

class _PagedListState<T> extends ConsumerState<_PagedList<T>> {
  final ScrollController _scroll = ScrollController();

  /// How far from the bottom the next page is asked for — early enough that
  /// scrolling never outruns the fetch and shows an empty gap.
  static const double _loadMoreAt = 400;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scroll.hasClients) return;
    if (_scroll.position.maxScrollExtent - _scroll.position.pixels < _loadMoreAt) {
      widget.loadMore(ref);
    }
  }

  /// After a frame, a list too short to scroll asks for more.
  void _fillScreen(Paged<T> page) {
    if (!page.hasMore || page.loadMoreFailed) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scroll.hasClients) return;
      if (_scroll.position.maxScrollExtent <= 0) widget.loadMore(ref);
    });
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final state = widget.watch(ref);

    return state.when(
      loading: () => const AppLoader(),
      error: (error, _) => AppErrorView(
        failure: error is ApiFailure
            ? error
            : ApiFailure(kind: FailureKind.unknown, message: text.errorGeneric),
        onRetry: () async => widget.reload(ref),
      ),
      data: (page) {
        if (page.items.isEmpty) {
          return Center(child: EmptyState(message: text.searchNoResults, icon: Icons.search_off_rounded));
        }
        _fillScreen(page);

        return ListView.separated(
          controller: _scroll,
          padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.xxxl),
          itemCount: page.items.length + (page.hasMore ? 1 : 0),
          separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
          itemBuilder: (context, index) {
            if (index < page.items.length) return widget.itemBuilder(page.items[index]);
            return _ListFooter(
              failed: page.loadMoreFailed,
              onRetry: () => widget.loadMore(ref),
            );
          },
        );
      },
    );
  }
}

/// The end of a list that has more: a spinner, or a way to try again.
class _ListFooter extends StatelessWidget {
  const _ListFooter({required this.failed, required this.onRetry});

  final bool failed;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      child: Center(
        child: failed
            ? TextButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded),
                label: Text(AppLocalizations.of(context).actionRetry),
              )
            : const SizedBox.square(
                dimension: 24,
                child: CircularProgressIndicator(strokeWidth: 2.5),
              ),
      ),
    );
  }
}
