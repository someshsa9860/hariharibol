import 'package:flutter/material.dart';

import '../../core/constants/routine_plan_config.dart';
import '../../core/constants/routine_presets.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../services/routine_planner.dart';
import '../routine/routine_style.dart';

/// The routine the setup proposes: each standard routine with its time. The
/// wake-up and the bedtime can be moved within their limits; the rest follow
/// from them.
class SetupRoutineStep extends StatelessWidget {
  const SetupRoutineStep({
    super.key,
    required this.plan,
    required this.onChangeTime,
  });

  final RoutinePlan plan;
  final void Function(RoutinePreset preset, int minute) onChangeTime;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return ListView(
      children: [
        if (!plan.fitsMorning) ...[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                Icons.info_outline_rounded,
                size: AppSizes.iconSm,
                color: context.colors.primary,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  text.setupChantLate(
                    routineTimeLabel(context, RoutinePlanConfig.morningChantDeadlineMinute),
                  ),
                  style: context.texts.bodyMedium,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        for (final item in plan.items)
          _RoutineRow(
            key: ValueKey(item.preset),
            item: item,
            onChangeTime: onChangeTime,
          ),
        const SizedBox(height: AppSpacing.md),
        Text(
          text.setupRoutineHint,
          style: context.texts.bodySmall?.copyWith(
            color: context.colors.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}

class _RoutineRow extends StatelessWidget {
  const _RoutineRow({
    super.key,
    required this.item,
    required this.onChangeTime,
  });

  final PlannedRoutineItem item;
  final void Function(RoutinePreset preset, int minute) onChangeTime;

  /// Only the wake-up and the bedtime move: everything else is worked out from
  /// them, so changing it by hand would only be overwritten.
  bool get _editable =>
      item.preset == RoutinePreset.wakeUp || item.preset == RoutinePreset.sleep;

  Future<void> _edit(BuildContext context) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: routineTimeOf(item.window.start),
    );
    if (picked == null || !context.mounted) return;
    onChangeTime(item.preset, routineMinuteOfTime(picked));
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(routineCategoryIcon(item.preset.category)),
      title: Text(routinePresetLabel(text, item.preset)),
      subtitle: Text(routineWindowLabel(context, item.window)),
      trailing: _editable ? const Icon(Icons.edit_outlined) : null,
      onTap: _editable ? () => _edit(context) : null,
    );
  }
}
