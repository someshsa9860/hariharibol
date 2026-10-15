import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../providers/book_provider.dart';
import '../../providers/language_chain_provider.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/library/canto_header.dart';
import '../../widgets/library/section_tile.dart';

/// One canto's chapters — the Bhagavatam only. The Gita has no canto level
/// and goes straight from [BookDetailView] to the reading screen.
class ChapterListView extends ConsumerWidget {
  const ChapterListView({super.key, required this.slug, required this.canto});

  final String slug;
  final int canto;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final chain = ref.watch(readingChainProvider);
    final chapters = ref.watch(bookChaptersProvider((slug: slug, canto: canto)));
    // The canto's own title heads the list. It comes from the canto list the
    // book screen already loaded; opened without it (a link) the list simply
    // starts with its chapters.
    final cantos = ref.watch(bookCantosProvider(slug)).value;
    final header = cantos?.where((c) => c.number == canto).firstOrNull;
    final headerRows = header == null ? 0 : 1;

    return Scaffold(
      appBar: AppBar(title: Text(text.labelCanto(canto))),
      body: chapters.when(
        loading: () => const AppLoader(),
        error: (error, _) => AppErrorView(
          failure: error is ApiFailure
              ? error
              : ApiFailure(kind: FailureKind.unknown, message: text.errorGeneric),
          onRetry: () async => ref.invalidate(bookChaptersProvider((slug: slug, canto: canto))),
        ),
        data: (list) => list.isEmpty
            ? Center(
                child: EmptyState(message: text.libraryNoBooks, icon: Icons.menu_book_outlined),
              )
            : ListView.separated(
                padding: AppSpacing.page.copyWith(
                  bottom: MediaQuery.paddingOf(context).bottom + AppSpacing.xxl,
                ),
                itemCount: list.length + headerRows,
                separatorBuilder: (context, index) =>
                    SizedBox(height: headerRows == 1 && index == 0 ? AppSpacing.xl : AppSpacing.md),
                itemBuilder: (context, index) {
                  if (header != null && index == 0) return CantoHeader(canto: header);
                  final chapter = list[index - headerRows];
                  return SectionTile(
                    number: chapter.number,
                    label: text.labelChapter(chapter.number),
                    title: chapter.titleFor(chain),
                    summary: chapter.summaryFor(chain),
                    facts: [text.bookVerseCount(chapter.totalVerses)],
                    onTap: () => AppNavigator.instance.push(
                      AppRoutes.chapterPath(slug, chapter.number, canto: canto),
                    ),
                  );
                },
              ),
      ),
    );
  }
}
