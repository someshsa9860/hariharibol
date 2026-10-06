import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/search_result.dart';
import '../../providers/search_provider.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/common/section_header.dart';
import '../../widgets/search/book_result_tile.dart';
import '../../widgets/search/mantra_result_tile.dart';
import '../../widgets/search/verse_result_tile.dart';

/// The library's one search box.
///
/// Every keystroke, debounced, goes to the server — there is no local index
/// to fall back to, so what is on screen is always what the server currently
/// holds. A dotted verse id or a book's own shorthand ("BG 2.47") is treated
/// as a direct jump rather than a search on the way back.
class SearchView extends ConsumerStatefulWidget {
  const SearchView({super.key});

  @override
  ConsumerState<SearchView> createState() => _SearchViewState();
}

class _SearchViewState extends ConsumerState<SearchView> {
  final TextEditingController _controller = TextEditingController();
  Timer? _debounce;
  String _query = '';

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(AppDurations.searchDebounce, () {
      if (mounted) setState(() => _query = value.trim());
    });
  }

  void _submit(String value) {
    _debounce?.cancel();
    setState(() => _query = value.trim());
  }

  void _useExample(String example) {
    _controller.text = example;
    _submit(example);
  }

  void _clear() {
    _debounce?.cancel();
    _controller.clear();
    setState(() => _query = '');
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _controller,
          autofocus: true,
          textInputAction: TextInputAction.search,
          decoration: InputDecoration.collapsed(hintText: text.searchHint),
          onChanged: _onChanged,
          onSubmitted: _submit,
        ),
        actions: [
          ValueListenableBuilder<TextEditingValue>(
            valueListenable: _controller,
            builder: (context, value, _) => value.text.isEmpty
                ? const SizedBox.shrink()
                : IconButton(
                    icon: const Icon(Icons.close_rounded),
                    onPressed: _clear,
                  ),
          ),
        ],
      ),
      body: SafeArea(
        child: _query.length < 2
            ? _SearchLanding(onExampleTap: _useExample)
            : _SearchOverviewBody(query: _query),
      ),
    );
  }
}

/// Shown before a query is long enough to search — the shortcuts are the
/// point of this screen, not an afterthought, since they are the fastest way
/// to reach a verse this app has.
class _SearchLanding extends StatelessWidget {
  const _SearchLanding({required this.onExampleTap});

  final ValueChanged<String> onExampleTap;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final bg = '${text.reelBookGita} 2.47';
    final sb = '${text.reelBookBhagavatam} 1.3.28';

    return Center(
      child: Padding(
        padding: AppSpacing.page,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.search_rounded,
              size: AppSizes.iconLg,
              color: context.colors.onSurfaceVariant,
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              text.searchPrompt,
              textAlign: TextAlign.center,
              style: context.texts.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
            ),
            const SizedBox(height: AppSpacing.xl),
            Text(text.searchShortcutLabel, style: context.texts.labelMedium),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.sm,
              alignment: WrapAlignment.center,
              children: [
                _ShortcutChip(label: bg, onTap: () => onExampleTap(bg)),
                _ShortcutChip(label: sb, onTap: () => onExampleTap(sb)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ShortcutChip extends StatelessWidget {
  const _ShortcutChip({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ActionChip(label: Text(label), onPressed: onTap);
  }
}

class _SearchOverviewBody extends ConsumerWidget {
  const _SearchOverviewBody({required this.query});

  final String query;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final overview = ref.watch(searchOverviewProvider(query));

    return overview.when(
      loading: () => const AppLoader(),
      error: (error, _) => AppErrorView(
        failure: error is ApiFailure
            ? error
            : ApiFailure(kind: FailureKind.unknown, message: text.errorGeneric),
        onRetry: () async => ref.invalidate(searchOverviewProvider(query)),
      ),
      data: (data) => data.isEmpty
          ? Center(child: EmptyState(message: text.searchNoResults, icon: Icons.search_off_rounded))
          : ListView(
              padding: AppSpacing.page,
              children: [
                if (data.verses.isNotEmpty)
                  _Section(
                    title: text.searchSectionVerses,
                    onViewAll: data.verseHasMore
                        ? () => AppNavigator.instance.push(
                              AppRoutes.searchResultsPath(SearchScope.verse.wire, query),
                            )
                        : null,
                    children: [
                      for (final verse in data.verses)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: VerseResultTile(
                            verse: verse,
                            onTap: verse.readingPath == null
                                ? null
                                : () => AppNavigator.instance.push(verse.readingPath!),
                          ),
                        ),
                    ],
                  ),
                if (data.mantras.isNotEmpty)
                  _Section(
                    title: text.homeMantras,
                    onViewAll: data.mantraHasMore
                        ? () => AppNavigator.instance.push(
                              AppRoutes.searchResultsPath(SearchScope.mantra.wire, query),
                            )
                        : null,
                    children: [
                      for (final mantra in data.mantras)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: MantraResultTile(
                            mantra: mantra,
                            onTap: () =>
                                AppNavigator.instance.push(AppRoutes.mantraPath(mantra.slug)),
                          ),
                        ),
                    ],
                  ),
                if (data.books.isNotEmpty)
                  _Section(
                    title: text.homeBooks,
                    onViewAll: data.bookHasMore
                        ? () => AppNavigator.instance.push(
                              AppRoutes.searchResultsPath(SearchScope.book.wire, query),
                            )
                        : null,
                    children: [
                      for (final book in data.books)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: BookResultTile(
                            book: book,
                            onTap: () => AppNavigator.instance.push(AppRoutes.bookPath(book.slug)),
                          ),
                        ),
                    ],
                  ),
              ],
            ),
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
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(title: title, onViewAll: onViewAll),
          ...children,
        ],
      ),
    );
  }
}
