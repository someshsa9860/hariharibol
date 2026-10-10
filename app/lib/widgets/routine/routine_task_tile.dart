import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/routine_task.dart';
import 'routine_style.dart';

/// One row on today's routine: a checkbox, the title, and what kind of thing
/// it is. Swiping it away removes it — the tab shows an undo after, so the
/// gesture never has to be second-guessed with a confirmation dialog.
class RoutineTaskTile extends StatelessWidget {
  const RoutineTaskTile({
    super.key,
    required this.task,
    required this.onToggle,
    required this.onDismissed,
  });

  final RoutineTask task;
  final VoidCallback onToggle;
  final VoidCallback onDismissed;

  @override
  Widget build(BuildContext context) {
    final done = task.isDone;
    final text = AppLocalizations.of(context);

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
                Icon(
                  done
                      ? Icons.check_circle_rounded
                      : Icons.radio_button_unchecked_rounded,
                  color: done
                      ? context.semanticColors.success
                      : context.colors.onSurfaceVariant,
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Text(
                    task.title,
                    style: context.texts.bodyLarge?.copyWith(
                      decoration: done ? TextDecoration.lineThrough : null,
                      color: done ? context.colors.onSurfaceVariant : null,
                    ),
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
