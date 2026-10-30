import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../common/round_count_picker.dart';

/// The standing daily round target — what every new day starts at. Its stepper
/// and quick picks are the setup's rounds step's too, so a reader who has met
/// one knows the other.
Future<int?> showDailyGoalSheet(BuildContext context, {required int initial}) {
  return showModalBottomSheet<int>(
    context: context,
    useRootNavigator: true,
    showDragHandle: true,
    isScrollControlled: true,
    backgroundColor: context.colors.surface,
    builder: (context) => _DailyGoalSheet(initial: initial),
  );
}

class _DailyGoalSheet extends StatefulWidget {
  const _DailyGoalSheet({required this.initial});

  final int initial;

  @override
  State<_DailyGoalSheet> createState() => _DailyGoalSheetState();
}

class _DailyGoalSheetState extends State<_DailyGoalSheet> {
  late int _rounds = widget.initial;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.lg,
          0,
          AppSpacing.lg,
          MediaQuery.viewInsetsOf(context).bottom + AppSpacing.xl,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(text.settingsDailyGoal, style: context.texts.titleLarge),
            const SizedBox(height: AppSpacing.xs),
            Text(
              text.settingsDailyGoalSubtitle,
              style: context.texts.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
            ),
            const SizedBox(height: AppSpacing.xl),
            RoundCountStepper(
              value: _rounds,
              onChanged: (value) => setState(() => _rounds = value),
              decreaseTooltip: text.setupRoundsFewer,
              increaseTooltip: text.setupRoundsMore,
            ),
            const SizedBox(height: AppSpacing.lg),
            RoundQuickPicks(
              selected: _rounds,
              onPick: (pick) => setState(() => _rounds = pick),
            ),
            const SizedBox(height: AppSpacing.xl),
            SizedBox(
              width: double.infinity,
              height: AppSizes.buttonHeight,
              child: FilledButton(
                onPressed: () => Navigator.of(context).pop(_rounds),
                child: Text(text.settingsDailyGoalSubmit(_rounds)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
