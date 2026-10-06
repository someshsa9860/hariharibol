import 'package:flutter/material.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/reel.dart';
import '../common/app_image.dart';
import 'reel_counts.dart';

/// One reel in a grid — a creator's profile, or the saved list.
///
/// Shows the thumbnail, the view count and a glyph for what kind of media it
/// is. The kind matters at this size: a slideshow and a video look identical
/// as a still, and knowing which one is about to open is the difference
/// between a tap and a mis-tap.
class ReelGridTile extends StatelessWidget {
  const ReelGridTile({super.key, required this.reel, this.onTap});

  final Reel reel;

  /// Defaults to opening the reel on its own screen.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return GestureDetector(
      onTap: onTap ?? () => AppNavigator.instance.push(AppRoutes.reelPath(reel.id)),
      child: Semantics(
        button: true,
        label: reel.caption ?? reel.creator.displayName,
        child: ExcludeSemantics(
          child: ClipRRect(
            borderRadius: AppRadius.smAll,
            child: Stack(
              fit: StackFit.expand,
              children: [
                AppImage(
                  url: reel.thumbnailUrl,
                  cacheKey: reel.id,
                  borderRadius: BorderRadius.zero,
                  fit: BoxFit.cover,
                ),
                // Only over the bottom strip, where the count sits — a full
                // wash would dull every thumbnail in the grid.
                const Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: _scrimHeight,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                        colors: [AppColors.reelScrimStrong, Color(0x00000000)],
                      ),
                    ),
                  ),
                ),
                Positioned(
                  top: AppSpacing.xs,
                  right: AppSpacing.xs,
                  child: Icon(
                    reel.isVideo
                        ? Icons.play_arrow_rounded
                        : reel.isAudio
                            ? Icons.graphic_eq_rounded
                            : Icons.collections_rounded,
                    size: AppSizes.iconSm,
                    color: AppColors.reelInk,
                    shadows: const [
                      Shadow(color: AppColors.reelScrimStrong, blurRadius: 6),
                    ],
                  ),
                ),
                if (reel.viewCount > 0)
                  Positioned(
                    left: AppSpacing.xs,
                    bottom: AppSpacing.xs,
                    child: Row(
                      children: [
                        const Icon(
                          Icons.visibility_outlined,
                          size: AppSizes.iconSm,
                          color: AppColors.reelInk,
                        ),
                        const SizedBox(width: AppSpacing.xxs),
                        Text(
                          compactCount(context, reel.viewCount),
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(color: AppColors.reelInk),
                        ),
                      ],
                    ),
                  ),
                // A reel still awaiting review, on the creator's own profile.
                // Nobody else ever sees one, so the badge is not a state the
                // grid has to explain twice.
                if (reel.isMine && reel.publishedAt == null)
                  Positioned(
                    top: AppSpacing.xs,
                    left: AppSpacing.xs,
                    child: Tooltip(
                      message: text.reelVideoUnavailable,
                      child: const Icon(
                        Icons.hourglass_empty_rounded,
                        size: AppSizes.iconSm,
                        color: AppColors.reelInk,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static const double _scrimHeight = 48;
}
