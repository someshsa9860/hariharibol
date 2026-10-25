import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/book.dart';
import '../common/eyebrow.dart';
import '../common/motif.dart';

/// "Canto 1 · Chapter 1", or just "Chapter 1" for a book with no cantos —
/// shared by the header card and the app bar title so the two never drift.
String chapterNumbering(AppLocalizations text, BookSection chapter) =>
    chapter.cantoNumber != null
    ? text.labelCantoChapter(chapter.cantoNumber!, chapter.number)
    : text.labelChapter(chapter.number);

/// The app bar title while a chapter is loaded: the book name as an eyebrow
/// over "Canto N · Chapter N", so the reader still knows where they are once
/// the header card below has scrolled out of view. With [onTap] it is also a
/// button, with a small arrow, that opens the book's contents.
class ChapterAppBarTitle extends StatelessWidget {
  const ChapterAppBarTitle({
    super.key,
    required this.chapter,
    required this.bookTitle,
    this.onTap,
  });

  final BookSection chapter;
  final String bookTitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final title = Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (bookTitle.isNotEmpty) ...[
          Eyebrow(bookTitle, color: context.colors.primary),
          const SizedBox(height: AppSpacing.xs),
        ],
        Text(chapterNumbering(text, chapter), style: context.texts.titleMedium),
      ],
    );
    if (onTap == null) return title;

    return Semantics(
      button: true,
      hint: text.readingContents,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.smAll,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(child: title),
              const SizedBox(width: AppSpacing.xs),
              Icon(Icons.expand_more_rounded, size: AppSizes.iconSm, color: context.colors.onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }
}

/// The gradient-panel banner at the top of the chapter — the same
/// `MotifPanel` treatment `VerseHeroCard` and a coverless `BookCard` use, not
/// a new one.
class ChapterHeader extends StatelessWidget {
  const ChapterHeader({
    super.key,
    required this.chapter,
    required this.bookTitle,
  });

  final BookSection chapter;
  final String bookTitle;

  static const double _panelWidth = 96;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final isLight = context.theme.brightness == Brightness.light;
    final motif = Motif.values[chapter.number.abs() % Motif.values.length];
    final summary = chapter.summary?.trim();
    final numbering = chapterNumbering(text, chapter);

    return Card(
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (bookTitle.isNotEmpty)
                      Eyebrow(bookTitle, color: context.colors.primary),
                    const SizedBox(height: AppSpacing.sm),
                    Text(numbering, style: context.texts.bodySmall),
                    const SizedBox(height: AppSpacing.xs),
                    Text(chapter.title, style: context.texts.headlineSmall),
                    if (summary != null && summary.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        summary,
                        style: context.texts.bodyMedium,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
            ),
            SizedBox(
              width: _panelWidth,
              child: MotifPanel(
                motif: motif,
                from: isLight ? AppColors.panelFrom : AppColors.panelFromDark,
                to: isLight ? AppColors.panelTo : AppColors.panelToDark,
                lineColor: context.colors.primary,
                lineOpacity: isLight ? 0.45 : 0.60,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
