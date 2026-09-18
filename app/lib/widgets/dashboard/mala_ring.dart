import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../common/eyebrow.dart';

/// The counter's own shape: 108 beads around a ring, lighting up one at a
/// time as they are counted — the digital equivalent of the thumb moving
/// along a physical mala, not a stopwatch reading.
///
/// Tapping is not aimed at an individual bead — at phone size, 108 targets
/// around a ring would be smaller than a fingertip. The whole disc is one
/// target, and the ring is what shows where the count actually is.
class MalaRing extends StatelessWidget {
  const MalaRing({
    super.key,
    required this.beadsInRound,
    required this.roundsCompleted,
    required this.roundsLabel,
    this.beadsPerRound = 108,
    this.size = 280,
  });

  final int beadsInRound;
  final int roundsCompleted;
  final String roundsLabel;
  final int beadsPerRound;
  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _MalaRingPainter(
          beadsInRound: beadsInRound,
          beadsPerRound: beadsPerRound,
          filledColor: context.colors.primary,
          trackColor: context.colors.outlineVariant,
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('$roundsCompleted', style: AppTypography.numeral(context, size: 72)),
              const SizedBox(height: AppSpacing.xs),
              Eyebrow(roundsLabel),
              const SizedBox(height: AppSpacing.sm),
              Text(
                '$beadsInRound / $beadsPerRound',
                style: context.texts.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MalaRingPainter extends CustomPainter {
  _MalaRingPainter({
    required this.beadsInRound,
    required this.beadsPerRound,
    required this.filledColor,
    required this.trackColor,
  });

  final int beadsInRound;
  final int beadsPerRound;
  final Color filledColor;
  final Color trackColor;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final outerRadius = size.shortestSide / 2;
    final beadRadius = outerRadius * 0.026;
    final ringRadius = outerRadius - beadRadius * 3;

    for (var i = 0; i < beadsPerRound; i++) {
      final angle = (i / beadsPerRound) * 2 * math.pi - math.pi / 2;
      final offset = center + Offset(math.cos(angle), math.sin(angle)) * ringRadius;
      final filled = i < beadsInRound;

      final paint = Paint()..color = filled ? filledColor : trackColor;
      if (filled) {
        canvas.drawCircle(offset, beadRadius, paint);
      } else {
        paint
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.4;
        canvas.drawCircle(offset, beadRadius * 0.8, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _MalaRingPainter oldDelegate) =>
      oldDelegate.beadsInRound != beadsInRound ||
      oldDelegate.beadsPerRound != beadsPerRound ||
      oldDelegate.filledColor != filledColor ||
      oldDelegate.trackColor != trackColor;
}
