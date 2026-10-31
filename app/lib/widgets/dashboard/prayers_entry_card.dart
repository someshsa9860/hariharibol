import 'package:flutter/material.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';

/// Home's door to the prayers: a title and one line on what is inside. Nothing
/// is fetched for it — the card is a door, and stays one while the list loads,
/// is empty, or cannot be reached.
class PrayersEntryCard extends StatelessWidget {
  const PrayersEntryCard({super.key});

  /// The line under the title is a sentence; the card does not grow with a
  /// long translation of it.
  static const int _subtitleLines = 2;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => AppNavigator.instance.push(AppRoutes.prayers),
        child: Padding(
          padding: AppSpacing.card,
          child: Row(
            children: [
              Icon(Icons.self_improvement_rounded, size: AppSizes.iconLg, color: context.colors.primary),
              const SizedBox(width: AppSpacing.lg),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(text.prayersTitle, style: context.texts.titleMedium),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      text.prayersHomeSubtitle,
                      style: context.texts.bodySmall,
                      maxLines: _subtitleLines,
                      overflow: TextOverflow.ellipsis,
                    ),
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
}
