import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';

/// A ring that fills clockwise from the top to [value] (0–1), with [child] in
/// the middle.
///
/// It fills once when it first appears and eases to a new value when the value
/// changes, unless the system's reduce-motion setting is on, when it is simply
/// there. Drawn rather than shipped, like the motifs.
class ProgressRing extends StatelessWidget {
  const ProgressRing({
    super.key,
    required this.value,
    required this.size,
    required this.strokeWidth,
    this.color,
    this.child,
  });

  final double value;
  final double size;
  final double strokeWidth;

  /// The filled part. Defaults to the theme's primary.
  final Color? color;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.maybeDisableAnimationsOf(context) ?? false;

    return SizedBox(
      width: size,
      height: size,
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: value.clamp(0.0, 1.0)),
        duration: reduceMotion ? Duration.zero : AppDurations.progress,
        curve: Curves.easeOutCubic,
        builder: (context, shown, child) => CustomPaint(
          painter: _RingPainter(
            value: shown,
            track: context.colors.outlineVariant,
            fill: color ?? context.colors.primary,
            strokeWidth: strokeWidth,
          ),
          child: child,
        ),
        child: Center(child: child),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  const _RingPainter({
    required this.value,
    required this.track,
    required this.fill,
    required this.strokeWidth,
  });

  final double value;
  final Color track;
  final Color fill;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    // Inset by half the stroke so the line sits inside the box it was given.
    final rect = (Offset.zero & size).deflate(strokeWidth / 2);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..isAntiAlias = true;

    canvas.drawArc(rect, 0, 2 * math.pi, false, paint..color = track);

    // Nothing at zero: a round cap would still leave a dot at the top.
    if (value > 0) {
      canvas.drawArc(rect, -math.pi / 2, 2 * math.pi * value, false, paint..color = fill);
    }
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.value != value ||
      old.track != track ||
      old.fill != fill ||
      old.strokeWidth != strokeWidth;
}
