import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/book.dart';
import '../../providers/book_provider.dart';
import '../../providers/language_chain_provider.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/library/book_download_action.dart';
import '../../widgets/library/book_header.dart';
import '../../widgets/library/section_tile.dart';
import '../../widgets/library/short_work_verses.dart';

/// A book: its cantos (Srimad Bhagavatam), chapters (everything else with
/// them), or — for a stotra, aarti, prayer or poem — its verses directly.
/// The backend splits chaptered books into their own two levels
/// (`GET /books/:slug/cantos` vs `/chapters`), so this screen follows the same
/// split; a short work has neither, so it reads straight from
/// `GET /books/:slug/verses` instead.
class BookDetailView extends ConsumerStatefulWidget {
  const BookDetailView({super.key, required this.slug});

  final String slug;

  @override
  ConsumerState<BookDetailView> createState() => _BookDetailViewState();
}

class _BookDetailViewState extends ConsumerState<BookDetailView> {
  /// The big heading in the book's header. Once it has scrolled under the app
  /// bar the bar carries the title instead, so the reader still knows which
  /// book this is.
  final _headingKey = GlobalKey();
  final _titleInBar = ValueNotifier<bool>(false);

  @override
  void dispose() {
    _titleInBar.dispose();
    super.dispose();
  }

  bool _onScroll(ScrollNotification notification) {
    if (notification.depth == 0 && notification.metrics.axis == Axis.vertical) {
      _titleInBar.value = _headingIsUnderBar(notification.metrics.pixels);
    }
    return false;
  }

  /// True once the list has scrolled far enough that the heading's bottom edge
  /// is above the top of the list, which is the bottom of the app bar.
  ///
  /// Worked out in scroll offsets, not from where the heading was last drawn:
  /// a scroll notification arrives before the list is laid out again, so the
  /// heading's position on screen is a frame behind and, after a fling, stays
  /// behind. The heading's offset within the list does not move as it scrolls.
  bool _headingIsUnderBar(double scrolled) {
    final heading = _headingKey.currentContext?.findRenderObject();
    // The header is the list's first row: scrolled far enough, it is not built
    // at all, which is as far under the bar as it gets.
    if (heading is! RenderBox) return scrolled > 0;
    if (!heading.attached || !heading.hasSize) return false;

    final list = RenderAbstractViewport.maybeOf(heading);
    if (list == null) return false;

    final headingBottom = list.getOffsetToReveal(heading, 0).offset + heading.size.height;
    return scrolled >= headingBottom;
  }

  @override
  Widget build(BuildContext context) {
    final slug = widget.slug;
    final text = AppLocalizations.of(context);
    final book = ref.watch(bookDetailProvider(slug));
    final chain = ref.watch(readingChainProvider);
    final title = book.value?.titleFor(chain);

    return Scaffold(
      appBar: AppBar(
        centerTitle: true,
        title: title == null
            ? null
            : ValueListenableBuilder<bool>(
                valueListenable: _titleInBar,
                // Not built at all until the heading is under the bar, so the
                // title is never on screen (or read out) twice.
                builder: (context, shown, _) => AnimatedSwitcher(
                  duration: AppDurations.fast,
                  child: shown
                      ? Text(title, key: const ValueKey('book-title'), maxLines: 1, overflow: TextOverflow.ellipsis)
                      : const SizedBox.shrink(),
                ),
              ),
        actions: [BookDownloadAction(slug: slug)],
      ),
      body: NotificationListener<ScrollNotification>(
        onNotification: _onScroll,
        child: book.when(
          loading: () => const AppLoader(),
          error: (error, _) => AppErrorView(
            failure: error is ApiFailure
                ? error
                : ApiFailure(kind: FailureKind.unknown, message: text.errorGeneric),
            onRetry: () async => ref.invalidate(bookDetailProvider(slug)),
          ),
          data: (data) => _BookDetailBody(book: data, headingKey: _headingKey),
        ),
      ),
    );
  }
}

class _BookDetailBody extends ConsumerWidget {
  const _BookDetailBody({required this.book, required this.headingKey});

  final Book book;
  final Key headingKey;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!book.hasCantos && book.totalChapters == 0) {
      return ShortWorkVerses(book: book, titleKey: headingKey);
    }

    final text = AppLocalizations.of(context);
    final chain = ref.watch(readingChainProvider);
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
            SizedBox(height: index == 0 ? AppSpacing.xl : AppSpacing.md),
        itemBuilder: (context, index) {
          if (index == 0) return BookHeader(book: book, titleKey: headingKey);

          final section = list[index - 1];
          return SectionTile(
            number: section.number,
            label: isCanto ? text.labelCanto(section.number) : text.labelChapter(section.number),
            title: section.titleFor(chain),
            summary: section.summaryFor(chain),
            facts: [
              if (isCanto) text.bookChapterCount(section.totalChapters ?? 0),
              text.bookVerseCount(section.totalVerses),
            ],
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
