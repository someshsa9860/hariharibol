import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/routine_task.dart';
import 'routine_style.dart';

/// One row on a day's routine: a status mark, the title, its standard time
/// range and — once ticked — how on time it was and when. Swiping it away
/// removes it; the tab shows an undo after, so the gesture never has to be
/// second-guessed with a confirmation dialog.
///
/// The row is tapped to tick or untick it. The pill with the time it was done
/// at is a button of its own that changes that time.
class RoutineTaskTile extends StatelessWidget {
  const RoutineTaskTile({
    super.key,
    required this.task,
    required this.onToggle,
    required this.onEditTime,
    required this.onDismissed,
  });

  final RoutineTask task;
  final VoidCallback onToggle;
  final VoidCallback onEditTime;
  final VoidCallback onDismissed;

  @override
  Widget build(BuildContext context) {
    final done = task.isDone;
    final text = AppLocalizations.of(context);
    final window = task.window;

    final card = Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Card(
        child: InkWell(
          borderRadius: AppRadius.lgAll,
          onTap: onToggle,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.sm,
            ),
            child: Row(
              children: [
                // A tick that is done says so in the pill; one that is not
                // says so here, for a screen reader.
                Icon(
                  routineStatusIcon(task.status),
                  color: routineStatusColor(context, task.status),
                  semanticLabel: done
                      ? null
                      : routineStatusLabel(text, task.status),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        task.title,
                        style: context.texts.bodyLarge?.copyWith(
                          decoration: done ? TextDecoration.lineThrough : null,
                          color: done ? context.colors.onSurfaceVariant : null,
                        ),
                      ),
                      if (window != null || done)
                        Padding(
                          padding: const EdgeInsets.only(top: AppSpacing.xs),
                          child: Wrap(
                            spacing: AppSpacing.sm,
                            runSpacing: AppSpacing.xs,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              if (window != null) _Range(window: window),
                              if (done)
                                _StatusPill(
                                  task: task,
                                  onTap: onEditTime,
                                ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                if (task.isDaily) ...[
                  Tooltip(
                    message: text.routineDailyBadge,
                    child: Icon(
                      Icons.repeat_rounded,
                      size: AppSizes.iconSm,
                      semanticLabel: text.routineDailyBadge,
                      color: context.colors.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                ],
                Icon(
                  routineCategoryIcon(task.category),
                  size: AppSizes.iconSm,
                  color: context.colors.onSurfaceVariant,
                ),
              ],
            ),
          ),
        ),
      ),
    );

    // The daily routine is taken apart in its own sheet, not swiped off a day.
    if (task.isDaily) return card;

    return Dismissible(
      key: ValueKey(task.id),
      direction: DismissDirection.endToStart,
      onDismissed: (_) => onDismissed(),
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
        child: Icon(
          Icons.delete_outline_rounded,
          color: context.colors.onSurfaceVariant,
        ),
      ),
      child: card,
    );
  }
}

/// The standard time range, in the muted tone: it is context for the pill, not
/// the news.
class _Range extends StatelessWidget {
  const _Range({required this.window});

  final RoutineWindow window;

  @override
  Widget build(BuildContext context) {
    final muted = context.colors.onSurfaceVariant;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.schedule_rounded, size: AppSizes.iconSm, color: muted),
        const SizedBox(width: AppSpacing.xs),
        Flexible(
          child: Text(
            routineWindowLabel(context, window),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: context.texts.bodySmall?.copyWith(color: muted),
          ),
        ),
      ],
    );
  }
}

/// "On time · 6:42 AM": how the tick sits against the range and when it was
/// made. Tapping it changes the time.
///
/// The colour is in the border, the wash and the mark; the words are in the
/// ordinary ink, so how well they read never depends on yellow, green or red.
class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.task, required this.onTap});

  final RoutineTask task;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final color = routineStatusColor(context, task.status);
    final word = routineStatusLabel(text, task.status);
    final at = task.doneAt;
    final label = at == null
        ? word
        : text.routineStatusAtTime(word, routineTimeLabel(context, at));

    return Semantics(
      button: true,
      label: label,
      hint: text.routineChangeTime,
      excludeSemantics: true,
      onTap: onTap,
      child: Tooltip(
        message: text.routineChangeTime,
        child: Material(
          color: color.withValues(alpha: 0.14),
          shape: StadiumBorder(side: BorderSide(color: color)),
          child: InkWell(
            customBorder: const StadiumBorder(),
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.xs + AppSpacing.xxs,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // A long word in another script, on a narrow phone, is cut
                  // short rather than drawn off the edge.
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: context.texts.labelMedium?.copyWith(
                        color: context.colors.onSurface,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Icon(
                    Icons.edit_outlined,
                    size: AppSizes.iconSm - AppSpacing.xs,
                    color: context.colors.onSurfaceVariant,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
