import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/book.dart';
import '../../providers/book_provider.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/library/book_download_action.dart';
import '../../widgets/library/book_header.dart';
import '../../widgets/library/short_work_verses.dart';

/// A book: its cantos (Srimad Bhagavatam), chapters (everything else with
/// them), or — for a stotra, aarti, prayer or poem — its verses directly.
/// The backend splits chaptered books into their own two levels
/// (`GET /books/:slug/cantos` vs `/chapters`), so this screen follows the same
/// split; a short work has neither, so it reads straight from
/// `GET /books/:slug/verses` instead.
class BookDetailView extends ConsumerWidget {
  const BookDetailView({super.key, required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final book = ref.watch(bookDetailProvider(slug));

    return Scaffold(
      appBar: AppBar(actions: [BookDownloadAction(slug: slug)]),
      body: book.when(
        loading: () => const AppLoader(),
        error: (error, _) => AppErrorView(
          failure: error is ApiFailure
              ? error
              : ApiFailure(kind: FailureKind.unknown, message: text.errorGeneric),
          onRetry: () async => ref.invalidate(bookDetailProvider(slug)),
        ),
        data: (data) => _BookDetailBody(book: data),
      ),
    );
  }
}

class _BookDetailBody extends ConsumerWidget {
  const _BookDetailBody({required this.book});

  final Book book;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!book.hasCantos && book.totalChapters == 0) {
      return ShortWorkVerses(book: book);
    }

    final text = AppLocalizations.of(context);
    final isCanto = book.hasCantos;
    final sections = isCanto
        ? ref.watch(bookCantosProvider(book.slug))
        : ref.watch(bookChaptersProvider((slug: book.slug, canto: null)));

    void retry() => isCanto
        ? ref.invalidate(bookCantosProvider(book.slug))
        : ref.invalidate(bookChaptersProvider((slug: book.slug, canto: null)));

    return sections.when(
      loading: () => const AppLoader(),
      error: (error, _) => AppErrorView(
        failure: error is ApiFailure
            ? error
            : ApiFailure(kind: FailureKind.unknown, message: text.errorGeneric),
        onRetry: () async => retry(),
      ),
      data: (list) => ListView.separated(
        padding: AppSpacing.page.copyWith(
          bottom: MediaQuery.paddingOf(context).bottom + AppSpacing.xxl,
        ),
        itemCount: list.length + 1,
        separatorBuilder: (context, index) =>
            index == 0 ? const SizedBox(height: AppSpacing.lg) : const Divider(),
        itemBuilder: (context, index) {
          if (index == 0) return BookHeader(book: book);

          final section = list[index - 1];
          return ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(section.title, style: context.texts.titleSmall),
            subtitle: Text(
              isCanto
                  ? text.bookChapterCount(section.totalChapters ?? 0)
                  : text.bookVerseCount(section.totalVerses),
            ),
            trailing: Text(
              isCanto ? text.labelCanto(section.number) : text.labelChapter(section.number),
              style: context.texts.bodySmall,
            ),
            onTap: () => AppNavigator.instance.push(
              isCanto
                  ? AppRoutes.bookCantoPath(book.slug, section.number)
                  : AppRoutes.chapterPath(book.slug, section.number),
            ),
          );
        },
      ),
    );
  }
}
