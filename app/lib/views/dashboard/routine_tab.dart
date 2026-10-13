import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/constants/routine_config.dart';
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
/// The list is kept on the device and mirrored to the account in the
/// background (see `routine_syncer.dart`), so the screen never waits on the
/// network and still works offline.
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
          window: draft.window,
        );
  }

  /// Ticks a task, noting when. Today's is ticked at the time it is now; a
  /// task on another day asks, since "now" means nothing there, starting the
  /// picker at the opening of its range. A done task is unticked, and the time
  /// goes with the tick.
  Future<void> _toggle(
    BuildContext context,
    WidgetRef ref,
    RoutineTask task,
  ) async {
    final notifier = ref.read(routineProvider.notifier);
    if (task.isDone) return notifier.unmark(task);

    final isToday = task.day == routineDayKey(DateTime.now());
    final minute = isToday
        ? routineMinuteOf(DateTime.now())
        : await _askTime(
            context,
            task.window?.start ?? RoutineConfig.otherDayPickerMinute,
          );
    if (minute == null) return;
    await notifier.markDone(task, minute: minute);
  }

  /// Changes the time a done task was done at.
  Future<void> _editTime(
    BuildContext context,
    WidgetRef ref,
    RoutineTask task,
  ) async {
    final minute = await _askTime(
      context,
      task.doneAt ?? routineMinuteOf(DateTime.now()),
    );
    if (minute == null) return;
    await ref.read(routineProvider.notifier).markDone(task, minute: minute);
  }

  Future<int?> _askTime(BuildContext context, int initial) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: routineTimeOf(initial),
      helpText: AppLocalizations.of(context).routinePickDoneTime,
    );
    return picked == null ? null : routineMinuteOfTime(picked);
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

    // The floating nav bar is laid over this tab, and the dashboard passes its
    // height down as the bottom padding: the last row has to scroll clear of it.
    final bottomInset = MediaQuery.paddingOf(context).bottom + AppSpacing.xxl;

    return Scaffold(
      // The keyboard belongs to the sheets opened from here; the page behind
      // them stays as it is instead of being squeezed into what is left.
      resizeToAvoidBottomInset: false,
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
                  // Scrolls, so a short screen never overflows it.
                  ? LayoutBuilder(
                      builder: (context, constraints) => SingleChildScrollView(
                        padding: EdgeInsets.only(bottom: bottomInset),
                        child: ConstrainedBox(
                          constraints: BoxConstraints(
                            minHeight: (constraints.maxHeight - bottomInset)
                                .clamp(0.0, double.infinity),
                          ),
                          child: Center(
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
                                    onPressed: () =>
                                        showDailyRoutineSheet(context),
                                    icon: const Icon(Icons.repeat_rounded),
                                    label: Text(text.routineManageDaily),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    )
                  : ListView(
                      padding: AppSpacing.page.copyWith(
                        top: 0,
                        bottom: bottomInset,
                      ),
                      children: [
                        for (final slot in RoutineSlot.values)
                          if (tasks.any((task) => task.slot == slot))
                            _SlotSection(
                              slot: slot,
                              tasks: tasks
                                  .where((task) => task.slot == slot)
                                  .toList(),
                              onToggle: (task) => _toggle(context, ref, task),
                              onEditTime: (task) =>
                                  _editTime(context, ref, task),
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
    required this.onEditTime,
    required this.onDismissed,
  });

  final RoutineSlot slot;
  final List<RoutineTask> tasks;
  final ValueChanged<RoutineTask> onToggle;
  final ValueChanged<RoutineTask> onEditTime;
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
              onEditTime: () => onEditTime(task),
              onDismissed: () => onDismissed(task),
            ),
        ],
      ),
    );
  }
}
