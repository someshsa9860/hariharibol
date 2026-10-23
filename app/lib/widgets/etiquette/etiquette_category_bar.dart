import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/etiquette.dart';
import 'etiquette_category_label.dart';

/// "All" and one chip for each category that has anything. The chips wrap onto
/// as many lines as they need, so every category is in view without scrolling
/// sideways. A null [selected] is "All".
class EtiquetteCategoryBar extends StatelessWidget {
  const EtiquetteCategoryBar({
    super.key,
    required this.categories,
    required this.selected,
    required this.onSelected,
  });

  final List<EtiquetteCategoryCount> categories;
  final String? selected;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: [
        ChoiceChip(
          label: Text(text.etiquetteAll),
          selected: selected == null,
          onSelected: (_) => onSelected(null),
        ),
        for (final category in categories)
          ChoiceChip(
            label: Text(etiquetteCategoryLabel(text, category.id, fallback: category.name)),
            selected: selected == category.id,
            onSelected: (_) => onSelected(category.id),
          ),
      ],
    );
  }
}
