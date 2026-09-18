import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../models/mantra.dart';

/// One mantra in a search result list — full width, unlike [MantraCard]'s
/// fixed-width row, since a "see all" list scrolls vertically.
class MantraResultTile extends StatelessWidget {
  const MantraResultTile({super.key, required this.mantra, this.onTap});

  final Mantra mantra;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.mdAll,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(mantra.name, style: context.texts.titleSmall),
              const SizedBox(height: AppSpacing.xs),
              Text(
                mantra.text,
                style: context.texts.bodyMedium,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
