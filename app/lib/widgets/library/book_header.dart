import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/book.dart';
import '../common/app_image.dart';
import '../common/motif.dart';

/// A book's cover (or motif fallback), title, description and translators —
/// the same header whether what follows is a canto/chapter list or, for a
/// short work, the verses themselves.
class BookHeader extends StatelessWidget {
  const BookHeader({super.key, required this.book});

  final Book book;

  static const double _coverHeight = 160;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final description = book.description?.trim();
    final cover = book.coverImageUrl;
    final isLight = context.theme.brightness == Brightness.light;
    final motif = Motif.values[book.bookNumber.abs() % Motif.values.length];
    final translatorNames = book.translators.map((t) => t.name).where((n) => n.isNotEmpty).join(', ');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: AppRadius.lgAll,
          child: SizedBox(
            width: double.infinity,
            height: _coverHeight,
            child: cover != null && cover.isNotEmpty
                ? AppImage(
                    url: cover,
                    cacheKey: 'book-${book.id}',
                    width: double.infinity,
                    height: _coverHeight,
                  )
                : MotifPanel(
                    motif: motif,
                    from: isLight ? AppColors.panelFrom : AppColors.panelFromDark,
                    to: isLight ? AppColors.panelTo : AppColors.panelToDark,
                    lineColor: context.colors.primary,
                    lineOpacity: isLight ? 0.35 : 0.5,
                  ),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(book.title, style: context.texts.headlineMedium),
        if (description != null && description.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(description, style: context.texts.bodyMedium),
        ],
        if (translatorNames.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            text.bookByTranslators(translatorNames),
            style: context.texts.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
          ),
        ],
      ],
    );
  }
}
