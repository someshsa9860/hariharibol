import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/routine_task.dart';
import '../../providers/routine_provider.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/common/eyebrow.dart';
import '../../widgets/routine/add_routine_task_sheet.dart';
import '../../widgets/routine/routine_style.dart';
import '../../widgets/routine/routine_task_tile.dart';

/// Today's routine: devotion, work and the ordinary errands around them —
/// the life-management half of practice, not the verses.
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
        .add(title: draft.title, category: draft.category, slot: draft.slot);
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
    final tasks = ref.watch(routineProvider);
    final done = tasks.where((task) => task.isDone).length;

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: AppSpacing.page.copyWith(bottom: AppSpacing.lg),
              child: _Header(
                doneCount: done,
                totalCount: tasks.length,
                onAdd: () => _addTask(context, ref),
              ),
            ),
            Expanded(
              child: tasks.isEmpty
                  ? Center(
                      child: EmptyState(
                        message: text.routineEmptyBody,
                        icon: Icons.checklist_outlined,
                        action: FilledButton.icon(
                          onPressed: () => _addTask(context, ref),
                          icon: const Icon(Icons.add_rounded),
                          label: Text(text.routineAddTask),
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
                              onToggle: (task) => ref
                                  .read(routineProvider.notifier)
                                  .toggle(task.id),
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
  const _Header({
    required this.doneCount,
    required this.totalCount,
    required this.onAdd,
  });

  final int doneCount;
  final int totalCount;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(text.tabRoutine, style: context.texts.headlineMedium),
            ),
            Semantics(
              button: true,
              label: text.routineAddTask,
              child: IconButton(
                onPressed: onAdd,
                icon: const Icon(Icons.add_circle_outline_rounded),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          totalCount > 0
              ? text.routineProgress(doneCount, totalCount)
              : text.routineSubtitle,
          style: context.texts.bodyMedium?.copyWith(
            color: context.colors.onSurfaceVariant,
          ),
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
              task: task,
              onToggle: () => onToggle(task),
              onDismissed: () => onDismissed(task),
            ),
        ],
      ),
    );
  }
}
