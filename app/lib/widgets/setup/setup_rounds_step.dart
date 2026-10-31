import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../common/round_count_picker.dart';

/// How many rounds a day to aim for, and how long that takes at the mantra's own
/// pace. The same stepper and quick picks as the daily goal sheet.
class SetupRoundsStep extends StatelessWidget {
  const SetupRoundsStep({
    super.key,
    required this.rounds,
    required this.chantMinutes,
    required this.onChanged,
  });

  final int rounds;
  final int chantMinutes;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return ListView(
      children: [
        RoundCountStepper(
          value: rounds,
          onChanged: onChanged,
          decreaseTooltip: text.setupRoundsFewer,
          increaseTooltip: text.setupRoundsMore,
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          text.setupChantTime(_duration(text, chantMinutes)),
          textAlign: TextAlign.center,
          style: context.texts.bodyMedium?.copyWith(
            color: context.colors.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        RoundQuickPicks(selected: rounds, onPick: onChanged),
      ],
    );
  }
}

String _duration(AppLocalizations text, int minutes) {
  final hours = minutes ~/ Duration.minutesPerHour;
  final rest = minutes % Duration.minutesPerHour;
  if (hours == 0) return text.setupDurationMinutes(rest);
  if (rest == 0) return text.setupDurationHours(hours);
  return text.setupDurationHoursMinutes(hours, rest);
}
