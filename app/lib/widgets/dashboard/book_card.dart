import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/book.dart';
import '../common/app_image.dart';
import '../common/motif.dart';

/// A book in the dashboard's horizontal row.
///
/// Covers are optional and often absent — the library is scripture, not a
/// bookshop, and most of it has never had one. So the fallback is a drawn
/// motif rather than a grey rectangle: a book with no artwork should look
/// deliberate, not broken.
class BookCard extends StatelessWidget {
  const BookCard({super.key, required this.book, this.onTap});

  final Book book;
  final VoidCallback? onTap;

  /// The motif is picked from the book's own number, so a given book always
  /// gets the same one and the row does not reshuffle on every rebuild.
  Motif get _motif => Motif.values[book.bookNumber.abs() % Motif.values.length];

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final cover = book.coverImageUrl;
    final isLight = context.theme.brightness == Brightness.light;

    final subtitle = book.totalChapters > 0
        ? text.bookChapterCount(book.totalChapters)
        : book.totalVerses > 0
            ? text.bookVerseCount(book.totalVerses)
            : null;

    return SizedBox(
      width: AppSizes.coverWidth,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.mdAll,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: AppSizes.coverWidth,
              height: AppSizes.coverHeight,
              child: cover != null && cover.isNotEmpty
                  ? AppImage(
                      url: cover,
                      // Covers are presigned and the URL changes on every
                      // response, so the cache is keyed on the book instead.
                      cacheKey: 'book-${book.id}',
                      width: AppSizes.coverWidth,
                      height: AppSizes.coverHeight,
                    )
                  : ClipRRect(
                      borderRadius: AppRadius.mdAll,
                      child: MotifPanel(
                        motif: _motif,
                        from: isLight ? AppColors.panelFrom : AppColors.panelFromDark,
                        to: isLight ? AppColors.panelTo : AppColors.panelToDark,
                        lineColor: context.colors.primary,
                        lineOpacity: isLight ? 0.35 : 0.5,
                      ),
                    ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              book.title,
              style: context.texts.titleSmall,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            if (subtitle != null)
              Text(subtitle, style: context.texts.bodySmall, maxLines: 1),
          ],
        ),
      ),
    );
  }
}
