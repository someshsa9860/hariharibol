import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/book.dart';
import '../../providers/book_provider.dart';
import '../../providers/reading_place_provider.dart';
import '../../widgets/common/animations.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/common/section_header.dart';
import '../../widgets/dashboard/book_card.dart';
import '../../widgets/library/last_read_tile.dart';
import '../../widgets/library/open_book.dart';

/// Books, chapters and verses — with how far the reader is in each book at the
/// top, since the next thing most people want here is to carry on.
///
/// One request lists what is published; a cover speaks for a book better than
/// a title alone, so this is a grid of them rather than a plain list. Where the
/// reader had got to is read from the phone, so it needs no request of its own
/// and arrives with the books rather than a moment after them.
class LibraryTab extends ConsumerWidget {
  const LibraryTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final books = ref.watch(booksProvider);
    final text = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(text.tabLibrary),
        actions: [
          IconButton(
            icon: const Icon(Icons.search_rounded),
            tooltip: text.tabSearch,
            onPressed: () => AppNavigator.instance.push(AppRoutes.search),
          ),
        ],
      ),
      body: books.when(
        loading: () => const AppLoader(),
        error: (error, _) => AppErrorView(
          failure: error is ApiFailure
              ? error
              : ApiFailure(
                  kind: FailureKind.unknown,
                  message: text.errorGeneric,
                ),
          onRetry: () async => ref.invalidate(booksProvider),
        ),
        data: (list) => list.isEmpty
            ? Center(
                child: EmptyState(
                  message: text.libraryNoBooks,
                  icon: Icons.menu_book_outlined,
                ),
              )
            : RefreshIndicator(
                onRefresh: () async {
                  final _ = await ref.refresh(booksProvider.future);
                },
                child: CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    SliverPadding(
                      padding: AppSpacing.page.copyWith(
                        bottom:
                            MediaQuery.paddingOf(context).bottom +
                            AppSpacing.xxl,
                      ),
                      sliver: SliverToBoxAdapter(
                        child: _LibraryContent(books: list),
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}

/// Both sections, built together so they come in together: the books are few
/// enough that nothing needs to be built lazily, and a section that appears
/// after the one above it is the pop-in this replaced.
class _LibraryContent extends ConsumerWidget {
  const _LibraryContent({required this.books});

  final List<Book> books;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final places = ref.watch(readingPlacesProvider);
    // A book with nothing in it cannot be read, so it has no place to be
    // "not started" at.
    final readable = books
        .where((book) => book.totalVerses > 0 || book.totalChapters > 0)
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (readable.isNotEmpty)
          FadeSlideIn(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SectionHeader(title: text.homeContinueReading),
                for (final book in readable) ...[
                  LastReadTile(
                    book: book,
                    place: places[book.slug],
                    onTap: () => openBook(ref, book.slug),
                  ),
                  if (book != readable.last)
                    const SizedBox(height: AppSpacing.sm),
                ],
                const SizedBox(height: AppSpacing.xl),
              ],
            ),
          ),
        FadeSlideIn(index: 1, child: SectionHeader(title: text.homeBooks)),
        GridView.builder(
          shrinkWrap: true,
          padding: EdgeInsets.zero,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(
            maxCrossAxisExtent: AppSizes.coverWidth,
            mainAxisExtent: BookCard.rowHeight,
            crossAxisSpacing: AppSpacing.md,
            mainAxisSpacing: AppSpacing.lg,
          ),
          itemCount: books.length,
          itemBuilder: (context, index) => FadeSlideIn(
            index: index + 2,
            child: BookCard(
              book: books[index],
              onTap: () => openBook(ref, books[index].slug),
            ),
          ),
        ),
      ],
    );
  }
}
