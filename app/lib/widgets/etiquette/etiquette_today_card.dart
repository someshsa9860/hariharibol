import 'package:flutter/material.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/etiquette.dart';
import '../common/eyebrow.dart';

/// Today's etiquette, at the head of the list: the one the 7:15 push names.
/// A tap opens it in full.
class EtiquetteTodayCard extends StatelessWidget {
  const EtiquetteTodayCard({super.key, required this.item});

  final Etiquette item;

  /// Longer than a list row's summary: this is the card the reader came for.
  static const int _summaryLines = 5;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => AppNavigator.instance.push(AppRoutes.etiquettePath(item.id)),
        child: Padding(
          padding: AppSpacing.card,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Eyebrow(text.etiquetteTodayEyebrow),
              const SizedBox(height: AppSpacing.md),
              Text(item.title, style: context.texts.headlineSmall),
              const SizedBox(height: AppSpacing.sm),
              Text(
                item.summary,
                style: context.texts.bodyMedium,
                maxLines: _summaryLines,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
