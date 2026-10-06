import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../providers/book_provider.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/common/empty_state.dart';

/// One canto's chapters — the Bhagavatam only. The Gita has no canto level
/// and goes straight from [BookDetailView] to the reading screen.
class ChapterListView extends ConsumerWidget {
  const ChapterListView({super.key, required this.slug, required this.canto});

  final String slug;
  final int canto;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final chapters = ref.watch(bookChaptersProvider((slug: slug, canto: canto)));

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
                itemCount: list.length,
                separatorBuilder: (context, index) => const Divider(),
                itemBuilder: (context, index) {
                  final chapter = list[index];
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(chapter.title, style: context.texts.titleSmall),
                    subtitle: Text(text.bookVerseCount(chapter.totalVerses)),
                    trailing: Text(text.labelChapter(chapter.number), style: context.texts.bodySmall),
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
