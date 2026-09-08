import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/home_feed.dart';
import '../common/app_image.dart';

/// One tap back to where the reader stopped.
class ContinueReadingCard extends StatelessWidget {
  const ContinueReadingCard({super.key, required this.progress, this.onTap});

  final ContinueReading progress;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final book = progress.book;

    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.lgAll,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Row(
            children: [
              AppImage(
                url: book.coverImageUrl,
                cacheKey: 'book-${book.id}',
                width: AppSizes.avatarMd,
                height: AppSizes.avatarLg,
                borderRadius: AppRadius.smAll,
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      book.title,
                      style: context.texts.titleSmall,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: AppSpacing.xxs),
                    Text(_position(context), style: context.texts.bodySmall),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: context.colors.onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }

  /// "Canto 2 · Chapter 10 · Verse 4", skipping the levels this book does not
  /// have — the Gita has no cantos.
  String _position(BuildContext context) {
    final text = AppLocalizations.of(context);
    final parts = <String>[
      if (progress.cantoNumber != null) text.labelCanto(progress.cantoNumber!),
      if (progress.chapterNumber != null) text.labelChapter(progress.chapterNumber!),
      if (progress.verseNumber != null) text.labelVerse(progress.verseNumber!),
    ];
    return parts.isEmpty ? (progress.verseId ?? '') : parts.join(' · ');
  }
}
