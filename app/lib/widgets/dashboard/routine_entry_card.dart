import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/routine_task.dart';
import '../../providers/routine_provider.dart';

/// The way into the routine, from Home: how today is going, and a door to the
/// list.
///
/// The routine used to be a tab; the bar's third place went to Reels, so this
/// card is where it is found. It reads only today's counts, so it rebuilds when
/// a task is ticked and not on any other change to the routine.
class RoutineEntryCard extends ConsumerWidget {
  const RoutineEntryCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final progress = ref.watch(routineProgressProvider(routineDayKey(DateTime.now())));
    final started = progress.total > 0;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => AppNavigator.instance.push(AppRoutes.routine),
        child: Padding(
          padding: AppSpacing.card,
          child: Row(
            children: [
              Icon(Icons.checklist_rounded, size: AppSizes.iconLg, color: context.colors.primary),
              const SizedBox(width: AppSpacing.lg),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(text.tabRoutine, style: context.texts.titleMedium),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      started
                          ? text.routineProgress(progress.done, progress.total)
                          : text.routineSubtitle,
                      style: context.texts.bodySmall,
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: context.colors.onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }
}
