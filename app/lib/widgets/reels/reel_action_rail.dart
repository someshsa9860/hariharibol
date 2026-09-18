import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/reel.dart';
import 'reel_counts.dart';

/// The column of actions down the right-hand edge — like, comment, share,
/// save, more.
///
/// **State is carried by the icon, never by a hue.** A liked reel is a filled
/// heart, not a red one. That is the app's colour rule applied to a surface
/// that has no palette of its own: light mode's orange would fight the video
/// and dark mode has no accent to spend, so both themes get the same white
/// iconography and the fill does the talking. It is also simply more legible
/// over an unknown frame than any colour would be.
class ReelActionRail extends StatelessWidget {
  const ReelActionRail({
    super.key,
    required this.reel,
    required this.onLike,
    required this.onComment,
    required this.onShare,
    required this.onSave,
    required this.onMore,
  });

  final Reel reel;
  final VoidCallback onLike;
  final VoidCallback onComment;
  final VoidCallback onShare;
  final VoidCallback onSave;
  final VoidCallback onMore;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        _RailButton(
          icon: reel.isLiked ? Icons.favorite_rounded : Icons.favorite_border_rounded,
          label: text.reelLike,
          semanticLabel: reel.isLiked ? text.reelUnlike : text.reelLike,
          count: reel.likeCount,
          isOn: reel.isLiked,
          onTap: onLike,
        ),
        _RailButton(
          icon: Icons.mode_comment_outlined,
          label: text.reelComment,
          count: reel.commentCount,
          onTap: onComment,
        ),
        _RailButton(
          icon: Icons.reply_rounded,
          label: text.reelShare,
          count: reel.shareCount,
          // Mirrored so it points away rather than back — the same glyph
          // Material uses for "share" in RTL is "reply" in LTR.
          flipped: true,
          onTap: onShare,
        ),
        _RailButton(
          icon: reel.isSaved ? Icons.bookmark_rounded : Icons.bookmark_border_rounded,
          label: text.reelSave,
          semanticLabel: reel.isSaved ? text.reelUnsave : text.reelSave,
          isOn: reel.isSaved,
          onTap: onSave,
        ),
        _RailButton(
          icon: Icons.more_horiz_rounded,
          label: text.reelMore,
          onTap: onMore,
        ),
      ],
    );
  }
}

class _RailButton extends StatelessWidget {
  const _RailButton({
    required this.icon,
    required this.label,
    required this.onTap,
    this.semanticLabel,
    this.count,
    this.isOn = false,
    this.flipped = false,
  });

  final IconData icon;

  /// Not drawn — the rail shows counts, not words. This is the accessible name.
  final String label;
  final String? semanticLabel;

  /// Omitted where a count is meaningless, like "save" or "more".
  final int? count;

  final bool isOn;
  final bool flipped;
  final VoidCallback onTap;

  static const double _tap = 52;
  static const double _countSize = 13;

  @override
  Widget build(BuildContext context) {
    final glyph = Icon(
      icon,
      size: AppSizes.iconLg,
      color: AppColors.reelInk,
      // A hairline shadow is what keeps white iconography readable over a
      // white frame — a scrim behind the whole rail would darken the video.
      shadows: const [Shadow(color: AppColors.reelScrimStrong, blurRadius: 8)],
    );

    return Semantics(
      button: true,
      selected: isOn,
      label: semanticLabel ?? label,
      child: ExcludeSemantics(
        // GestureDetector, not InkWell: an ink ripple would draw a Material
        // splash over someone's footage, and the rail has no Material ancestor
        // of its own to draw it on. Every other control on this surface is a
        // GestureDetector for the same two reasons.
        child: GestureDetector(
          onTap: onTap,
          behavior: HitTestBehavior.opaque,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
            child: SizedBox(
              width: _tap,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // The fill/outline swap is the state change, so it gets the
                  // transition rather than being an instant redraw.
                  AnimatedSwitcher(
                    duration: AppDurations.fast,
                    transitionBuilder: (child, animation) =>
                        ScaleTransition(scale: animation, child: child),
                    child: KeyedSubtree(
                      key: ValueKey('$icon-$isOn'),
                      child: flipped
                          ? Transform.flip(flipX: true, child: glyph)
                          : glyph,
                    ),
                  ),
                  if (count != null && count! > 0) ...[
                    const SizedBox(height: AppSpacing.xxs),
                    Text(
                      compactCount(context, count!),
                      style: AppTypography.numeral(context, size: _countSize)
                          .copyWith(color: AppColors.reelInk),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

}
