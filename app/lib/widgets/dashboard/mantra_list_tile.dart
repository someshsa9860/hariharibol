import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/reference_item.dart';
import '../common/app_image.dart';
import '../common/motif.dart';
import 'mantra_category_label.dart';

/// A mantra in the tab's browsable list — full width, for scanning a category
/// rather than the dashboard's horizontal row of them.
class MantraListTile extends StatelessWidget {
  const MantraListTile({
    super.key,
    required this.name,
    required this.text,
    this.category,
    this.deity,
    this.guru,
    this.imageUrl,
    this.imageCacheKey,
    this.isPrivate = false,
    this.hasAudio = false,
    this.selected,
    this.onTap,
  });

  final String name;
  final String text;

  /// The category's slug; the tile writes its name in the reader's language.
  final String? category;

  /// Whose mantra this is. Most have one; the portrait is skipped rather than
  /// shown blank when it does not.
  final ReferenceItem? deity;

  /// A saint's mantra has a guru instead of a deity.
  final ReferenceItem? guru;

  /// The mantra's own picture, which comes before the deity's and the guru's,
  /// and the key to cache it under (its address without the signature).
  final String? imageUrl;
  final String? imageCacheKey;

  /// A mantra the reader added, which only they (and readers who added the same
  /// one) can see.
  final bool isPrivate;
  final bool hasAudio;

  /// Null for a tile that opens something (it ends in a chevron). Set, the tile
  /// is one choice among several — the setup's favourite-mantra question — and
  /// is outlined and ticked when it is the one chosen.
  final bool? selected;
  final VoidCallback? onTap;

  /// Picked from the mantra's own name, so a given tile always gets the same
  /// motif and the list does not reshuffle on every rebuild.
  Motif get _motif => Motif.values[name.hashCode.abs() % Motif.values.length];

  /// The first picture there is: the mantra's own, then the deity's, then the
  /// guru's; null when there is none and the motif is drawn instead.
  (String, String)? get _picture {
    final own = imageUrl;
    if (own != null && own.isNotEmpty) return (own, imageCacheKey ?? own);
    final deityImage = deity?.imageUrl;
    if (deityImage != null && deityImage.isNotEmpty) return (deityImage, 'deity-${deity!.id}');
    final guruImage = guru?.imageUrl;
    if (guruImage != null && guruImage.isNotEmpty) return (guruImage, 'guru-${guru!.id}');
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final picture = _picture;
    final isLight = context.theme.brightness == Brightness.light;
    final chosen = selected ?? false;

    return Card(
      color: chosen ? context.colors.primaryContainer : null,
      shape: chosen
          ? RoundedRectangleBorder(
              borderRadius: AppRadius.lgAll,
              side: BorderSide(color: context.colors.primary, width: 1.5),
            )
          : null,
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
                  child: picture != null
                      ? AppImage(
                          url: picture.$1,
                          cacheKey: picture.$2,
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
                    if (isPrivate) ...[
                      const SizedBox(height: AppSpacing.xxs),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.lock_outline_rounded,
                            size: AppSizes.iconSm,
                            color: context.colors.onSurfaceVariant,
                          ),
                          const SizedBox(width: AppSpacing.xs),
                          Text(
                            AppLocalizations.of(context).ownMantraPrivate,
                            style: context.texts.bodySmall?.copyWith(
                              color: context.colors.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ],
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
                          mantraCategoryLabel(
                            AppLocalizations.of(context),
                            category!,
                          ),
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
              if (selected case final isChosen?)
                Icon(
                  isChosen
                      ? Icons.check_circle_rounded
                      : Icons.radio_button_unchecked_rounded,
                  size: AppSizes.iconMd,
                  color: isChosen
                      ? context.colors.primary
                      : context.colors.onSurfaceVariant,
                )
              else ...[
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
            ],
          ),
        ),
      ),
    );
  }
}
