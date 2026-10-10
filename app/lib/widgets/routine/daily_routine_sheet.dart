import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../providers/routine_provider.dart';
import 'add_routine_task_sheet.dart';
import 'routine_style.dart';

/// The optional daily routine: what repeats every day, with a way to add to it
/// and to take items off it. Taking one off keeps the days already lived as
/// they were.
///
/// `useRootNavigator: true` for the same reason as the add sheet — see there.
Future<void> showDailyRoutineSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    useRootNavigator: true,
    backgroundColor: context.colors.surface,
    builder: (context) => const _DailyRoutineSheet(),
  );
}

class _DailyRoutineSheet extends ConsumerWidget {
  const _DailyRoutineSheet();

  Future<void> _add(BuildContext context, WidgetRef ref) async {
    final draft = await showAddRoutineTaskSheet(context, daily: true);
    if (draft == null) return;
    await ref
        .read(routineProvider.notifier)
        .addDaily(
          title: draft.title,
          category: draft.category,
          slot: draft.slot,
        );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final items = ref
        .watch(routineProvider.select((data) => data.daily))
        .where((item) => item.isActive)
        .toList();

    return SafeArea(
      top: false,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.8,
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.sm,
            AppSpacing.lg,
            AppSpacing.xl,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(text.routineDailyTitle, style: context.texts.titleLarge),
              const SizedBox(height: AppSpacing.xs),
              Text(
                text.routineDailyBody,
                style: context.texts.bodyMedium?.copyWith(
                  color: context.colors.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Flexible(
                child: items.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.symmetric(
                          vertical: AppSpacing.lg,
                        ),
                        child: Text(
                          text.routineDailyEmpty,
                          style: context.texts.bodyMedium,
                        ),
                      )
                    : ListView(
                        shrinkWrap: true,
                        children: [
                          for (final item in items)
                            ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: Icon(
                                routineCategoryIcon(item.category),
                                color: context.colors.onSurfaceVariant,
                              ),
                              title: Text(item.title),
                              subtitle: Text(routineSlotLabel(text, item.slot)),
                              trailing: IconButton(
                                tooltip: text.routineDailyRemove,
                                icon: const Icon(Icons.delete_outline_rounded),
                                onPressed: () => ref
                                    .read(routineProvider.notifier)
                                    .removeDaily(item.id),
                              ),
                            ),
                        ],
                      ),
              ),
              const SizedBox(height: AppSpacing.md),
              SizedBox(
                width: double.infinity,
                height: AppSizes.buttonHeight,
                child: FilledButton.icon(
                  onPressed: () => _add(context, ref),
                  icon: const Icon(Icons.add_rounded),
                  label: Text(text.routineDailyAdd),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
