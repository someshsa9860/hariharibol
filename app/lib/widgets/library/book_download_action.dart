import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../providers/book_provider.dart';
import '../../providers/book_sync_provider.dart';
import '../../repositories/book_repository.dart';

/// The book detail app bar's quiet indicator of the silent offline sync: a
/// spinner while chapters are arriving, a check once the whole book is on the
/// phone. Before that it is a download icon — tapping it just asks the sync to
/// run now (it already runs when the book opens), which is how a failed chapter
/// is retried without leaving the screen.
class BookDownloadAction extends ConsumerWidget {
  const BookDownloadAction({super.key, required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final bookId = ref.watch(bookDetailProvider(slug)).value?.id;
    final summary = bookId == null ? null : ref.watch(bookSyncSummaryProvider(bookId)).value;

    if (summary != null && summary.isWorking) {
      return Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: SizedBox(
          width: AppSizes.iconMd,
          height: AppSizes.iconMd,
          child: CircularProgressIndicator(strokeWidth: 2, value: summary.downloaded > 0 ? summary.fraction : null),
        ),
      );
    }

    final isDone = summary?.isComplete ?? false;
    return IconButton(
      icon: Icon(isDone ? Icons.download_done_rounded : Icons.download_rounded),
      tooltip: isDone ? text.libraryDownloaded : text.libraryDownloadBook,
      onPressed: isDone ? null : () => BookRepository.instance.bookOpened(slug),
    );
  }
}
