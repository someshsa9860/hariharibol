import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/book.dart';
import '../../providers/language_chain_provider.dart';
import '../common/app_image.dart';
import '../common/motif.dart';
import 'section_counts.dart';

/// A book's cover (or motif fallback), title, description, size and
/// translators — the same header whether what follows is a canto/chapter list
/// or, for a short work, the verses themselves.
///
/// The title and description are picked here, from the reader's reading
/// languages, so they change the moment the reading language does.
///
/// [titleKey] marks the heading so the screen can tell when it has scrolled
/// under the app bar and show the title there instead.
class BookHeader extends ConsumerWidget {
  const BookHeader({super.key, required this.book, this.titleKey});

  final Book book;
  final Key? titleKey;

  static const double _coverHeight = 160;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final chain = ref.watch(readingChainProvider);
    final description = book.descriptionFor(chain)?.trim();
    final cover = book.coverImageUrl;
    final isLight = context.theme.brightness == Brightness.light;
    final motif = Motif.values[book.bookNumber.abs() % Motif.values.length];
    final translatorNames = book.translators
        .map((t) => t.creditName)
        .whereType<String>()
        .join(', ');

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
                    from: isLight
                        ? AppColors.panelFrom
                        : AppColors.panelFromDark,
                    to: isLight ? AppColors.panelTo : AppColors.panelToDark,
                    lineColor: context.colors.primary,
                    lineOpacity: isLight ? 0.35 : 0.5,
                  ),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(
          book.titleFor(chain),
          key: titleKey,
          style: context.texts.headlineMedium,
        ),
        if (description != null && description.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(description, style: context.texts.bodyMedium),
        ],
        const SizedBox(height: AppSpacing.lg),
        SectionCounts(
          cantos: book.totalCantos,
          chapters: book.totalChapters,
          verses: book.totalVerses,
        ),
        if (translatorNames.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            text.bookByTranslators(translatorNames),
            style: context.texts.bodySmall?.copyWith(
              color: context.colors.onSurfaceVariant,
            ),
          ),
        ],
      ],
    );
  }
}
