import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/book.dart';
import '../../models/reading_place.dart';
import '../common/app_image.dart';

/// One book and how far the reader is in it: "Canto 2 · Chapter 10 · Verse 4",
/// or a plain line saying it has not been started. A tap carries on from there.
class LastReadTile extends StatelessWidget {
  const LastReadTile({
    super.key,
    required this.book,
    required this.place,
    this.onTap,
  });

  final Book book;

  /// Null for a book the reader has never opened.
  final ReadingPlace? place;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final started = place != null;

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
                    Text(
                      started
                          ? _position(context, place!)
                          : AppLocalizations.of(context).libraryBookNotStarted,
                      style: context.texts.bodySmall?.copyWith(
                        color: started ? null : context.colors.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                color: context.colors.onSurfaceVariant,
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Skips the levels the book does not have — the Gita has no cantos.
  String _position(BuildContext context, ReadingPlace place) {
    final text = AppLocalizations.of(context);
    return [
      if (place.canto != null) text.labelCanto(place.canto!),
      text.labelChapter(place.chapter),
      text.labelVerse(place.verse),
    ].join(' · ');
  }
}
