import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../models/reference_item.dart';
import '../common/app_image.dart';
import '../common/motif.dart';

/// A mantra in the tab's browsable list — full width, for scanning a category
/// rather than the dashboard's horizontal row of them.
class MantraListTile extends StatelessWidget {
  const MantraListTile({
    super.key,
    required this.name,
    required this.text,
    this.category,
    this.deity,
    this.hasAudio = false,
    this.onTap,
  });

  final String name;
  final String text;
  final String? category;

  /// Whose mantra this is. Most have one; the portrait is skipped rather than
  /// shown blank when it does not.
  final ReferenceItem? deity;
  final bool hasAudio;
  final VoidCallback? onTap;

  /// Picked from the mantra's own name, so a given tile always gets the same
  /// motif and the list does not reshuffle on every rebuild.
  Motif get _motif => Motif.values[name.hashCode.abs() % Motif.values.length];

  @override
  Widget build(BuildContext context) {
    final image = deity?.imageUrl;
    final isLight = context.theme.brightness == Brightness.light;

    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.lgAll,
        child: Padding(
          padding: AppSpacing.card,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              ClipOval(
                child: SizedBox(
                  width: AppSizes.avatarMd,
                  height: AppSizes.avatarMd,
                  child: image != null && image.isNotEmpty
                      ? AppImage(
                          url: image,
                          cacheKey: 'deity-${deity!.id}',
                          width: AppSizes.avatarMd,
                          height: AppSizes.avatarMd,
                          borderRadius: BorderRadius.zero,
                        )
                      : MotifPanel(
                          motif: _motif,
                          from: isLight
                              ? AppColors.panelFrom
                              : AppColors.panelFromDark,
                          to: isLight
                              ? AppColors.panelTo
                              : AppColors.panelToDark,
                          lineColor: context.colors.primary,
                          lineOpacity: isLight ? 0.40 : 0.55,
                        ),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: context.texts.titleSmall),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      text,
                      style: context.texts.bodyMedium?.copyWith(height: 1.7),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (category != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.sm,
                          vertical: AppSpacing.xxs,
                        ),
                        decoration: BoxDecoration(
                          color: context.colors.primaryContainer,
                          borderRadius: AppRadius.smAll,
                        ),
                        child: Text(
                          category!,
                          style: context.texts.bodySmall?.copyWith(
                            color: context.colors.onPrimaryContainer,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              if (hasAudio)
                Icon(
                  Icons.play_circle_outline_rounded,
                  size: AppSizes.iconMd,
                  color: context.colors.onSurfaceVariant,
                ),
              Icon(
                Icons.chevron_right_rounded,
                size: AppSizes.iconMd,
                color: context.colors.onSurfaceVariant,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
