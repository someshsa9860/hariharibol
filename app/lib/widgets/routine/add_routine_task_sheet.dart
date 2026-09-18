import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/routine_task.dart';
import 'routine_style.dart';

/// What the sheet hands back — the provider decides the id, this only
/// describes what to add.
class RoutineTaskDraft {
  const RoutineTaskDraft({
    required this.title,
    required this.category,
    required this.slot,
  });

  final String title;
  final RoutineCategory category;
  final RoutineSlot slot;
}

/// One task, with a category and a rough time of day — not a full scheduler,
/// which a routine that has to survive a busy morning would not survive
/// filling in.
///
/// `useRootNavigator: true`: the routine tab lives in the dashboard shell's
/// own nested `Navigator`, which `DashboardView` paints underneath the
/// frosted `GlassNavBar` — a sheet opened on that navigator renders behind
/// the bar instead of over it, with no way to dismiss it.
Future<RoutineTaskDraft?> showAddRoutineTaskSheet(BuildContext context) {
  return showModalBottomSheet<RoutineTaskDraft>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    useRootNavigator: true,
    backgroundColor: context.colors.surface,
    builder: (context) => const _AddRoutineTaskSheet(),
  );
}

class _AddRoutineTaskSheet extends StatefulWidget {
  const _AddRoutineTaskSheet();

  @override
  State<_AddRoutineTaskSheet> createState() => _AddRoutineTaskSheetState();
}

class _AddRoutineTaskSheetState extends State<_AddRoutineTaskSheet> {
  final _controller = TextEditingController();
  RoutineCategory _category = RoutineCategory.devotion;
  RoutineSlot _slot = RoutineSlot.anytime;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final title = _controller.text.trim();
    if (title.isEmpty) return;
    Navigator.of(
      context,
    ).pop(RoutineTaskDraft(title: title, category: _category, slot: _slot));
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.sm,
          AppSpacing.lg,
          MediaQuery.viewInsetsOf(context).bottom + AppSpacing.xl,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(text.routineAddTask, style: context.texts.titleLarge),
            const SizedBox(height: AppSpacing.lg),
            TextField(
              controller: _controller,
              autofocus: true,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(hintText: text.routineTaskHint),
              onSubmitted: (_) => _submit(),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(text.routineCategoryLabel, style: context.texts.labelLarge),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                for (final category in RoutineCategory.values)
                  ChoiceChip(
                    label: Text(routineCategoryLabel(text, category)),
                    avatar: Icon(
                      routineCategoryIcon(category),
                      size: AppSizes.iconSm,
                    ),
                    selected: _category == category,
                    onSelected: (_) => setState(() => _category = category),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(text.routineSlotLabel, style: context.texts.labelLarge),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                for (final slot in RoutineSlot.values)
                  ChoiceChip(
                    label: Text(routineSlotLabel(text, slot)),
                    selected: _slot == slot,
                    onSelected: (_) => setState(() => _slot = slot),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.xl),
            SizedBox(
              width: double.infinity,
              height: AppSizes.buttonHeight,
              child: FilledButton(
                onPressed: _submit,
                child: Text(text.routineSaveAction),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
