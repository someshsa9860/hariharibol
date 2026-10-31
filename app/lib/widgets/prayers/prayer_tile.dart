import 'package:flutter/material.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/prayer.dart';
import 'prayer_category_label.dart';

/// One row of the prayers list: its title, the first lines of the summary, and
/// its category and length. A tap opens the prayer.
class PrayerTile extends StatelessWidget {
  const PrayerTile({super.key, required this.prayer, this.categoryName});

  final Prayer prayer;

  /// The English name the server sends for the category, for an id the app has
  /// no words for yet.
  final String? categoryName;

  /// The title and the summary are each a line or two; the row does not grow
  /// with a long one.
  static const int _titleLines = 2;
  static const int _summaryLines = 2;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final meta = [
      prayerCategoryLabel(text, prayer.category, fallback: categoryName),
      if (prayer.verseCount > 0) text.prayersVerseCount(prayer.verseCount),
    ].join(' · ');
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => AppNavigator.instance.push(AppRoutes.prayerPath(prayer.id)),
        child: Padding(
          padding: AppSpacing.card,
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      prayer.title,
                      style: context.texts.titleMedium,
                      maxLines: _titleLines,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (prayer.summary.trim().isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        prayer.summary,
                        style: context.texts.bodySmall,
                        maxLines: _summaryLines,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      meta,
                      style: context.texts.labelMedium?.copyWith(color: context.colors.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Icon(Icons.chevron_right_rounded, color: context.colors.onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }
}
