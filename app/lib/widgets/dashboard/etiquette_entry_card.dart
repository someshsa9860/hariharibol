import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../providers/etiquette_provider.dart';

/// Home's door to devotee etiquette: names today's item when it is known, and
/// says what the section is until then (or when nothing is published, or the
/// request failed — the card is a door, not a place to report errors).
class EtiquetteEntryCard extends ConsumerWidget {
  const EtiquetteEntryCard({super.key});

  /// A title is a line or two; the card does not grow with a long one.
  static const int _subtitleLines = 2;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final today = ref.watch(etiquetteTodayProvider).asData?.value.item;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => AppNavigator.instance.push(AppRoutes.etiquette),
        child: Padding(
          padding: AppSpacing.card,
          child: Row(
            children: [
              Icon(Icons.spa_rounded, size: AppSizes.iconLg, color: context.colors.primary),
              const SizedBox(width: AppSpacing.lg),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(text.etiquetteTitle, style: context.texts.titleMedium),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      today?.title ?? text.etiquetteHomeSubtitle,
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
