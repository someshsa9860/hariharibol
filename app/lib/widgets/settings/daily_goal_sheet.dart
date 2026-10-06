import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';

/// The standing daily round target — what every new day starts at. Shares its
/// stepper-plus-quick-picks shape with the log-rounds sheet, since both are
/// "pick a round count" and a reader who has used one already knows the other.
Future<int?> showDailyGoalSheet(BuildContext context, {required int initial}) {
  return showModalBottomSheet<int>(
    context: context,
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
  static const List<int> _quickPicks = [4, 8, 16, 32, 64];

  late int _rounds = widget.initial;

  void _adjust(int delta) {
    setState(() => _rounds = (_rounds + delta).clamp(1, 200));
  }

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
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                IconButton.filledTonal(
                  onPressed: () => _adjust(-1),
                  icon: const Icon(Icons.remove_rounded),
                ),
                SizedBox(
                  width: 96,
                  child: Text(
                    '$_rounds',
                    textAlign: TextAlign.center,
                    style: AppTypography.numeral(context, size: 48),
                  ),
                ),
                IconButton.filledTonal(
                  onPressed: () => _adjust(1),
                  icon: const Icon(Icons.add_rounded),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: AppSpacing.sm,
              children: [
                for (final pick in _quickPicks)
                  ChoiceChip(
                    label: Text('$pick'),
                    selected: _rounds == pick,
                    onSelected: (_) => setState(() => _rounds = pick),
                  ),
              ],
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
