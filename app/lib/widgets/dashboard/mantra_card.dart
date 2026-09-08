import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../models/mantra.dart';

/// A mantra in the dashboard's horizontal row.
///
/// The text shown is whatever script the reader chose — the API has already
/// resolved it, so nothing here decides between Devanagari and roman.
class MantraCard extends StatelessWidget {
  const MantraCard({super.key, required this.mantra, this.onTap});

  final Mantra mantra;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: AppSizes.coverWidth * 1.6,
      child: Card(
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadius.lgAll,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  mantra.name,
                  style: context.texts.titleSmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  mantra.text,
                  style: context.texts.bodySmall?.copyWith(height: 1.7),
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
                if (mantra.hasAudio) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Icon(
                    Icons.play_circle_outline_rounded,
                    size: AppSizes.iconSm,
                    color: context.colors.primary,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
