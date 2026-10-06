import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/favorite.dart';
import '../../providers/book_provider.dart';
import '../../providers/profile_provider.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/common/section_header.dart';
import '../../widgets/dashboard/book_card.dart';
import '../../widgets/dashboard/favorite_tile.dart';

/// Books, chapters and verses — with what has already been bookmarked from
/// them at the top, since a saved verse is something to come back and read.
///
/// One request lists what is published; a cover speaks for a book better than
/// a title alone, so this is a grid of them rather than a plain list.
class LibraryTab extends ConsumerWidget {
  const LibraryTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final books = ref.watch(booksProvider);
    final favorites = ref.watch(favoritesProvider).value ?? const <Favorite>[];
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
                  ref.invalidate(favoritesProvider);
                },
                child: CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    SliverPadding(
                      padding: AppSpacing.page.copyWith(bottom: 0),
                      sliver: SliverToBoxAdapter(
                        child: _RecentFavorites(favorites: favorites),
                      ),
                    ),
                    SliverPadding(
                      padding: AppSpacing.page.copyWith(
                        top: AppSpacing.xl,
                        bottom:
                            MediaQuery.paddingOf(context).bottom +
                            AppSpacing.xxl,
                      ),
                      sliver: SliverGrid(
                        gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(
                          maxCrossAxisExtent: AppSizes.coverWidth,
                          mainAxisExtent: BookCard.rowHeight,
                          crossAxisSpacing: AppSpacing.md,
                          mainAxisSpacing: AppSpacing.lg,
                        ),
                        delegate: SliverChildBuilderDelegate(
                          (context, index) => BookCard(
                            book: list[index],
                            onTap: () => AppNavigator.instance.push(
                              AppRoutes.bookPath(list[index].slug),
                            ),
                          ),
                          childCount: list.length,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}

class _RecentFavorites extends StatelessWidget {
  const _RecentFavorites({required this.favorites});

  final List<Favorite> favorites;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(title: text.profileRecentFavorites),
        if (favorites.isEmpty)
          Center(
            child: EmptyState(
              message: text.profileNoFavorites,
              icon: Icons.bookmark_border_rounded,
            ),
          )
        else
          for (final favorite in favorites.take(5)) ...[
            FavoriteTile(favorite: favorite),
            const SizedBox(height: AppSpacing.sm),
          ],
      ],
    );
  }
}
