import 'package:flutter/material.dart';

import '../../core/constants/routine_config.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/routine_task.dart';
import 'routine_style.dart';

/// The two ends of a task's standard time range, as minutes after midnight.
/// Not a [RoutineWindow]: while it is being edited it may be a range that is
/// not one yet (the end before the start), and the sheet says so.
typedef RoutineRange = ({int start, int end});

bool isRoutineRangeValid(RoutineRange range) =>
    RoutineWindow.isValid(range.start, range.end);

/// "Standard time": the range a task is meant to be done in, or none. Ticking
/// the task inside it is on time, before it early, after it late.
///
/// Either "no set time" (one button to add a range) or two time boxes, From and
/// To, each opening the system time picker, and a way to take the range off
/// again.
class RoutineWindowField extends StatelessWidget {
  const RoutineWindowField({
    super.key,
    required this.range,
    required this.onChanged,
  });

  final RoutineRange? range;
  final ValueChanged<RoutineRange?> onChanged;

  Future<int?> _pick(BuildContext context, int minute, String help) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: routineTimeOf(minute),
      helpText: help,
    );
    return picked == null ? null : routineMinuteOfTime(picked);
  }

  Future<void> _pickStart(BuildContext context, RoutineRange current) async {
    final text = AppLocalizations.of(context);
    final start = await _pick(context, current.start, text.routineWindowFrom);
    if (start == null) return;

    // A start moved past the end carries the end along, so picking an evening
    // start is not made to wait for a second pick before it is a range.
    final end = current.end > start
        ? current.end
        : (start + RoutineConfig.newWindowLengthMinutes).clamp(
            0,
            RoutineConfig.minutesPerDay - 1,
          );
    onChanged((start: start, end: end));
  }

  Future<void> _pickEnd(BuildContext context, RoutineRange current) async {
    final text = AppLocalizations.of(context);
    final end = await _pick(context, current.end, text.routineWindowTo);
    if (end == null) return;
    onChanged((start: current.start, end: end));
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final current = range;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(text.routineWindowHeading, style: context.texts.labelLarge),
        const SizedBox(height: AppSpacing.sm),
        if (current == null)
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: OutlinedButton.icon(
              onPressed: () => onChanged((
                start: RoutineConfig.newWindowStartMinute,
                end:
                    RoutineConfig.newWindowStartMinute +
                    RoutineConfig.newWindowLengthMinutes,
              )),
              icon: const Icon(Icons.schedule_rounded),
              label: Text(text.routineWindowSet),
            ),
          )
        else ...[
          Row(
            children: [
              Expanded(
                child: _TimeBox(
                  label: text.routineWindowFrom,
                  minute: current.start,
                  onTap: () => _pickStart(context, current),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _TimeBox(
                  label: text.routineWindowTo,
                  minute: current.end,
                  isError: !isRoutineRangeValid(current),
                  onTap: () => _pickEnd(context, current),
                ),
              ),
              IconButton(
                tooltip: text.routineWindowClear,
                onPressed: () => onChanged(null),
                icon: const Icon(Icons.close_rounded),
              ),
            ],
          ),
          if (!isRoutineRangeValid(current)) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              text.routineWindowInvalid,
              style: context.texts.bodySmall?.copyWith(
                color: context.colors.error,
              ),
            ),
          ],
        ],
        const SizedBox(height: AppSpacing.xs),
        Text(
          text.routineWindowHint,
          style: context.texts.bodySmall?.copyWith(
            color: context.colors.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}

/// One end of the range: its name small over the time, drawn as the filled
/// field the name above it is, so the two read as the same kind of control.
class _TimeBox extends StatelessWidget {
  const _TimeBox({
    required this.label,
    required this.minute,
    required this.onTap,
    this.isError = false,
  });

  final String label;
  final int minute;
  final VoidCallback onTap;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final time = routineTimeLabel(context, minute);

    return Semantics(
      button: true,
      label: '$label $time',
      excludeSemantics: true,
      onTap: onTap,
      child: Material(
        color: context.colors.surfaceContainerHighest,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.mdAll,
          side: isError
              ? BorderSide(color: context.colors.error)
              : BorderSide.none,
        ),
        child: InkWell(
          borderRadius: AppRadius.mdAll,
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.md,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: context.texts.labelSmall?.copyWith(
                    color: context.colors.onSurfaceVariant,
                  ),
                ),
                Text(time, style: context.texts.titleMedium),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
