import 'package:flutter/material.dart';

import '../../core/constants/routine_plan_config.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_typography.dart';

/// A round count as a number with − and + either side. The buttons stop at the
/// limits, so the value never leaves the range the routine is worked out for.
class RoundCountStepper extends StatelessWidget {
  const RoundCountStepper({
    super.key,
    required this.value,
    required this.onChanged,
    this.decreaseTooltip,
    this.increaseTooltip,
  });

  final int value;
  final ValueChanged<int> onChanged;
  final String? decreaseTooltip;
  final String? increaseTooltip;

  @override
  Widget build(BuildContext context) {
    final canDecrease = value > RoutinePlanConfig.minRounds;
    final canIncrease = value < RoutinePlanConfig.maxRounds;

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        IconButton.filledTonal(
          tooltip: decreaseTooltip,
          onPressed: canDecrease ? () => onChanged(value - 1) : null,
          icon: const Icon(Icons.remove_rounded),
        ),
        SizedBox(
          width: 96,
          child: Text(
            '$value',
            textAlign: TextAlign.center,
            style: AppTypography.numeral(context, size: 48),
          ),
        ),
        IconButton.filledTonal(
          tooltip: increaseTooltip,
          onPressed: canIncrease ? () => onChanged(value + 1) : null,
          icon: const Icon(Icons.add_rounded),
        ),
      ],
    );
  }
}

/// The common round counts as one tap each; the one matching [selected] is
/// chosen.
class RoundQuickPicks extends StatelessWidget {
  const RoundQuickPicks({
    super.key,
    required this.selected,
    required this.onPick,
  });

  final int selected;
  final ValueChanged<int> onPick;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      alignment: WrapAlignment.center,
      spacing: AppSpacing.sm,
      children: [
        for (final pick in RoutinePlanConfig.roundQuickPicks)
          ChoiceChip(
            label: Text('$pick'),
            selected: selected == pick,
            onSelected: (_) => onPick(pick),
          ),
      ],
    );
  }
}
