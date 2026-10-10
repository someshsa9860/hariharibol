import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/routine_task.dart';
import '../../providers/routine_provider.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/common/eyebrow.dart';
import '../../widgets/common/vaishnava_tilak_icon.dart';
import '../../widgets/routine/add_routine_task_sheet.dart';
import '../../widgets/routine/daily_routine_sheet.dart';
import '../../widgets/routine/routine_date_strip.dart';
import '../../widgets/routine/routine_style.dart';
import '../../widgets/routine/routine_task_tile.dart';

/// The routine: devotion, work and the ordinary errands around them — the
/// life-management half of practice, not the verses.
///
/// A strip of days sits at the top; the day chosen there is the day below. Each
/// day has its own list — what was added for it, plus the optional daily
/// routine — so earlier days can be opened and read back.
///
/// Device-only for now: there is no backend model for a personal task list
/// yet, so this is a real screen rather than a placeholder, built on local
/// storage until one arrives.
class RoutineTab extends ConsumerWidget {
  const RoutineTab({super.key});

  Future<void> _addTask(BuildContext context, WidgetRef ref) async {
    final draft = await showAddRoutineTaskSheet(context);
    if (draft == null) return;
    await ref
        .read(routineProvider.notifier)
        .addTask(
          day: ref.read(selectedRoutineDayProvider),
          title: draft.title,
          category: draft.category,
          slot: draft.slot,
        );
  }

  Future<void> _remove(
    BuildContext context,
    WidgetRef ref,
    RoutineTask task,
  ) async {
    final text = AppLocalizations.of(context);
    await ref.read(routineProvider.notifier).remove(task.id);
    if (!context.mounted) return;

    final messenger = ScaffoldMessenger.of(context);
    messenger.clearSnackBars();
    messenger.showSnackBar(
      SnackBar(
        content: Text(text.routineTaskRemoved),
        action: SnackBarAction(
          label: text.routineUndo,
          onPressed: () => ref.read(routineProvider.notifier).restore(task),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final day = ref.watch(selectedRoutineDayProvider);
    final tasks = ref.watch(routineDayProvider(routineDayKey(day)));
    final progress = routineProgressOf(tasks);
    final isToday = day == routineDay(DateTime.now());
    final isEkadashi = ref.watch(ekadashiCalendarProvider).isEkadashi(day);

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: AppSpacing.screenH.copyWith(top: AppSpacing.lg),
              child: _Header(
                onManageDaily: () => showDailyRoutineSheet(context),
                onAdd: () => _addTask(context, ref),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            const RoutineDateStrip(),
            Padding(
              padding: AppSpacing.screenH.copyWith(
                top: AppSpacing.sm,
                bottom: AppSpacing.md,
              ),
              child: _DayHeading(
                day: day,
                progress: progress,
                isToday: isToday,
                isEkadashi: isEkadashi,
                onJumpToToday: () => ref
                    .read(selectedRoutineDayProvider.notifier)
                    .select(DateTime.now()),
              ),
            ),
            Expanded(
              child: tasks.isEmpty
                  ? Center(
                      child: EmptyState(
                        message: text.routineEmptyBody,
                        icon: Icons.checklist_outlined,
                        action: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            FilledButton.icon(
                              onPressed: () => _addTask(context, ref),
                              icon: const Icon(Icons.add_rounded),
                              label: Text(text.routineAddTask),
                            ),
                            const SizedBox(height: AppSpacing.sm),
                            TextButton.icon(
                              onPressed: () => showDailyRoutineSheet(context),
                              icon: const Icon(Icons.repeat_rounded),
                              label: Text(text.routineManageDaily),
                            ),
                          ],
                        ),
                      ),
                    )
                  : ListView(
                      padding: AppSpacing.page.copyWith(top: 0),
                      children: [
                        for (final slot in RoutineSlot.values)
                          if (tasks.any((task) => task.slot == slot))
                            _SlotSection(
                              slot: slot,
                              tasks: tasks
                                  .where((task) => task.slot == slot)
                                  .toList(),
                              onToggle: (task) =>
                                  ref.read(routineProvider.notifier).toggle(task),
                              onDismissed: (task) =>
                                  _remove(context, ref, task),
                            ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.onManageDaily, required this.onAdd});

  final VoidCallback onManageDaily;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Row(
      children: [
        Expanded(
          child: Text(text.tabRoutine, style: context.texts.headlineMedium),
        ),
        IconButton(
          tooltip: text.routineManageDaily,
          onPressed: onManageDaily,
          icon: const Icon(Icons.repeat_rounded),
        ),
        IconButton(
          tooltip: text.routineAddTask,
          onPressed: onAdd,
          icon: const Icon(Icons.add_circle_outline_rounded),
        ),
      ],
    );
  }
}

/// Which day is open: its full date, whether it is Ekadashi, how much is done,
/// and a way back to today from anywhere in the strip.
class _DayHeading extends StatelessWidget {
  const _DayHeading({
    required this.day,
    required this.progress,
    required this.isToday,
    required this.isEkadashi,
    required this.onJumpToToday,
  });

  final DateTime day;
  final RoutineProgress progress;
  final bool isToday;
  final bool isEkadashi;
  final VoidCallback onJumpToToday;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).toString();
    final muted = context.texts.bodyMedium?.copyWith(
      color: context.colors.onSurfaceVariant,
    );

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Flexible(
                    child: Text(
                      DateFormat.MMMMEEEEd(locale).format(day),
                      style: context.texts.titleMedium,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (isEkadashi) ...[
                    const SizedBox(width: AppSpacing.sm),
                    Tooltip(
                      message: text.routineEkadashiNote,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.sm,
                          vertical: AppSpacing.xxs,
                        ),
                        decoration: BoxDecoration(
                          color: context.colors.primaryContainer,
                          borderRadius: BorderRadius.circular(AppRadius.pill),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            VaishnavaTilakIcon(
                              size: AppSizes.iconSm,
                              color: context.colors.onPrimaryContainer,
                            ),
                            const SizedBox(width: AppSpacing.xs),
                            Text(
                              text.routineEkadashi,
                              style: context.texts.labelMedium?.copyWith(
                                color: context.colors.onPrimaryContainer,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: AppSpacing.xxs),
              Text(
                progress.total > 0
                    ? text.routineProgress(progress.done, progress.total)
                    : text.routineNothingPlanned,
                style: muted,
              ),
            ],
          ),
        ),
        if (!isToday)
          TextButton(
            onPressed: onJumpToToday,
            child: Text(text.routineJumpToToday),
          ),
      ],
    );
  }
}

class _SlotSection extends StatelessWidget {
  const _SlotSection({
    required this.slot,
    required this.tasks,
    required this.onToggle,
    required this.onDismissed,
  });

  final RoutineSlot slot;
  final List<RoutineTask> tasks;
  final ValueChanged<RoutineTask> onToggle;
  final ValueChanged<RoutineTask> onDismissed;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
            child: Eyebrow(routineSlotLabel(text, slot)),
          ),
          for (final task in tasks)
            RoutineTaskTile(
              key: ValueKey('${task.isDaily}-${task.id}'),
              task: task,
              onToggle: () => onToggle(task),
              onDismissed: () => onDismissed(task),
            ),
        ],
      ),
    );
  }
}
