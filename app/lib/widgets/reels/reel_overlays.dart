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
/// A box is also kept on the screen: held inside [margin] on the sides, above
/// [bottomReserve] (the author row, buttons and nav drawn over the reel), and
/// shrunk — never below [_minScale] of its size — until its longest word fits
/// the width and the whole text fits the height. A Sanskrit compound has no
/// spaces to wrap at, so without this it runs off both edges.
///
/// Wrapped in [IgnorePointer] so a tap on a line of text still reaches the
/// player underneath — pausing a reel should not depend on missing the words.
class ReelOverlays extends StatelessWidget {
  const ReelOverlays({
    super.key,
    required this.overlays,
    this.margin = 16,
    this.bottomReserve = 0,
    this.topReserve = 0,
  });

  final List<ReelOverlay> overlays;

  /// The gap kept free on the left and right of the frame.
  final double margin;

  /// How much of the bottom is covered by the caption, the buttons and the nav.
  final double bottomReserve;

  /// How much of the top is covered by the back and mute buttons.
  final double topReserve;

  /// The smallest a box is shrunk to, as a share of the size it was set at.
  static const double _minScale = 0.4;
  static const int _fitSteps = 12;

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
              for (final overlay in overlays) _box(context, overlay, frame),
            ],
          );
        },
      ),
    );
  }

  Widget _box(BuildContext context, ReelOverlay overlay, Size frame) {
    final wanted = frame.width * overlay.x / _percent;
    final left = wanted.clamp(margin, frame.width - margin - 1).toDouble();
    final right = (wanted + frame.width * overlay.width / _percent).clamp(left + 1, frame.width - margin).toDouble();
    final width = right - left;
    final floor = frame.height - bottomReserve;
    final fontSize = frame.width * overlay.size / _percent;

    // Height of the text at a given scale; the longest word's width alongside.
    ({double height, double word}) measure(double scale) {
      final painter = TextPainter(
        text: TextSpan(text: overlay.text, style: _style(context, overlay, fontSize * scale)),
        textAlign: _align(overlay.align),
        textDirection: Directionality.of(context),
        textScaler: TextScaler.noScaling,
      )..layout(maxWidth: width);
      final result = (height: painter.height, word: painter.minIntrinsicWidth);
      painter.dispose();
      return result;
    }

    final top = (frame.height * overlay.y / _percent).clamp(topReserve, floor).toDouble();
    var scale = 1.0;
    for (var i = 0; i < _fitSteps; i++) {
      final m = measure(scale);
      final fitsWidth = m.word <= width + 0.5;
      // The box is lifted if it sits low, so it only has to fit the safe area.
      final fitsHeight = m.height <= floor - topReserve;
      if (fitsWidth && fitsHeight) break;
      scale = (scale * 0.92).clamp(_minScale, 1.0).toDouble();
    }
    final height = measure(scale).height;
    final placed = top + height > floor ? (floor - height).clamp(topReserve, floor).toDouble() : top;

    return Positioned(
      left: left,
      top: placed,
      width: width,
      child: Text(
        overlay.text,
        textAlign: _align(overlay.align),
        textScaler: TextScaler.noScaling,
        style: _style(context, overlay, fontSize * scale),
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
