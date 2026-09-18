import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/book.dart';

/// One book in a search result list — full width, unlike [BookCard]'s
/// fixed-width row, since a "see all" list scrolls vertically.
class BookResultTile extends StatelessWidget {
  const BookResultTile({super.key, required this.book, this.onTap});

  final Book book;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final subtitle = book.totalChapters > 0
        ? text.bookChapterCount(book.totalChapters)
        : book.totalVerses > 0
            ? text.bookVerseCount(book.totalVerses)
            : null;

    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.mdAll,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(book.title, style: context.texts.titleSmall),
              if (subtitle != null) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(subtitle, style: context.texts.bodySmall),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
