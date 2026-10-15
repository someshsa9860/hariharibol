import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../common/eyebrow.dart';

/// The count, on one line under a ring that has a picture in it: the day's
/// rounds, what they are called, and how far into this round the beads are.
///
/// It wraps rather than clips, so a long label or a large text size drops the
/// bead count to a second line instead of overflowing.
class ChantDiscCount extends StatelessWidget {
  const ChantDiscCount({
    super.key,
    required this.roundsCompleted,
    required this.roundsLabel,
    required this.beadsInRound,
    required this.beadsPerRound,
  });

  final int roundsCompleted;
  final String roundsLabel;
  final int beadsInRound;
  final int beadsPerRound;

  static const double _dividerHeight = 16;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      alignment: WrapAlignment.center,
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: AppSpacing.md,
      runSpacing: AppSpacing.xs,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text('$roundsCompleted', style: AppTypography.numeral(context, size: 36)),
            const SizedBox(width: AppSpacing.sm),
            Flexible(child: Eyebrow(roundsLabel)),
          ],
        ),
        SizedBox(
          height: _dividerHeight,
          child: VerticalDivider(width: 1, color: context.colors.outlineVariant),
        ),
        Text(
          '$beadsInRound / $beadsPerRound',
          style: context.texts.titleMedium?.copyWith(color: context.colors.onSurfaceVariant),
        ),
      ],
    );
  }
}
