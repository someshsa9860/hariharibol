import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../models/reel_overlay.dart';

/// The text an admin laid over a reel, drawn in the same place it was placed.
///
/// A box is positioned and sized as a share of *this widget's* box — the whole
/// reel page — so the layout follows the screen instead of the media. That is
/// the point of storing percentages: a video that is cropped to fill a taller
/// phone still has its verse where the editor put it.
///
/// Font sizes are a share of the width too, and deliberately ignore the
/// system text scale: scaling one box's type without moving the next is how
/// two lines of a verse end up on top of each other.
///
/// Wrapped in [IgnorePointer] so a tap on a line of text still reaches the
/// player underneath — pausing a reel should not depend on missing the words.
class ReelOverlays extends StatelessWidget {
  const ReelOverlays({super.key, required this.overlays});

  final List<ReelOverlay> overlays;

  /// Fractions are stored as percentages.
  static const double _percent = 100;

  /// The shadow behind every box. Fixed in logical pixels rather than scaled
  /// with the type: it exists to separate glyph edges from footage, and that
  /// job does not get bigger with the letters.
  static const double _shadowBlur = 6;
  static const Offset _shadowOffset = Offset(0, 1);

  @override
  Widget build(BuildContext context) {
    if (overlays.isEmpty) return const SizedBox.shrink();

    return IgnorePointer(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final frame = constraints.biggest;
          return Stack(
            children: [
              for (final overlay in overlays)
                Positioned(
                  left: frame.width * overlay.x / _percent,
                  top: frame.height * overlay.y / _percent,
                  width: frame.width * overlay.width / _percent,
                  child: Text(
                    overlay.text,
                    textAlign: _align(overlay.align),
                    textScaler: TextScaler.noScaling,
                    style: _style(context, overlay, frame.width * overlay.size / _percent),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  TextStyle _style(BuildContext context, ReelOverlay overlay, double fontSize) {
    final theme = Theme.of(context).textTheme;
    final ink = _ink(overlay.color);

    final base = switch (overlay.style) {
      // The app's heading face, same as every other heading in it.
      ReelOverlayStyle.heading => theme.headlineSmall!.copyWith(height: 1.2),
      // Sanskrit stays on the platform font and keeps room for its matras.
      ReelOverlayStyle.verse => AppTypography.verse(context).copyWith(height: 1.55),
      ReelOverlayStyle.body => theme.bodyMedium!.copyWith(fontWeight: FontWeight.w500, height: 1.35),
    };

    return base.copyWith(
      fontSize: fontSize,
      color: ink,
      shadows: [
        Shadow(
          color: overlay.color == ReelOverlayColor.dark ? AppColors.reelTextGlow : AppColors.reelTextShadow,
          blurRadius: _shadowBlur,
          offset: _shadowOffset,
        ),
      ],
    );
  }

  static Color _ink(ReelOverlayColor color) => switch (color) {
        ReelOverlayColor.light => AppColors.reelOverlayLight,
        ReelOverlayColor.dark => AppColors.reelOverlayDark,
        ReelOverlayColor.accent => AppColors.reelOverlayAccent,
      };

  static TextAlign _align(ReelOverlayAlign align) => switch (align) {
        ReelOverlayAlign.left => TextAlign.left,
        ReelOverlayAlign.center => TextAlign.center,
        ReelOverlayAlign.right => TextAlign.right,
      };
}
