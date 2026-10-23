import 'package:flutter/material.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/etiquette.dart';
import '../common/eyebrow.dart';
import 'etiquette_category_label.dart';

/// One row of the etiquette list: its category, title and the first lines of the
/// summary. A tap opens the item in full.
class EtiquetteTile extends StatelessWidget {
  const EtiquetteTile({super.key, required this.item});

  final Etiquette item;

  /// The summary is a sentence or two; more than this is the full item's job.
  static const int _summaryLines = 3;

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
              Eyebrow(etiquetteCategoryLabel(text, item.category)),
              const SizedBox(height: AppSpacing.sm),
              Text(item.title, style: context.texts.titleMedium),
              const SizedBox(height: AppSpacing.xs),
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
