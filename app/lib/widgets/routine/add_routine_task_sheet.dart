import 'package:flutter/material.dart';

import '../../core/constants/routine_config.dart';
import '../../core/constants/routine_presets.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/routine_task.dart';
import 'routine_style.dart';
import 'routine_window_field.dart';

/// What the sheet hands back — the provider decides the id, this only
/// describes what to add.
class RoutineTaskDraft {
  const RoutineTaskDraft({
    required this.title,
    required this.category,
    this.window,
  });

  final String title;
  final RoutineCategory category;

  /// When the task is meant to be done, or null for one with no set time.
  final RoutineWindow? window;
}

/// One task: a name — picked from the standard routines or typed — a category
/// and, if it has one, the time range it is meant to be done in. Not a full
/// scheduler, which a routine that has to survive a busy morning would not
/// survive filling in.
///
/// `useRootNavigator: true`: the routine tab lives in the dashboard shell's
/// own nested `Navigator`, which `DashboardView` paints underneath the
/// frosted `GlassNavBar` — a sheet opened on that navigator renders behind
/// the bar instead of over it, with no way to dismiss it.
///
/// [daily] words it for the daily routine ("Add to every day").
Future<RoutineTaskDraft?> showAddRoutineTaskSheet(
  BuildContext context, {
  bool daily = false,
}) {
  return showModalBottomSheet<RoutineTaskDraft>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    useRootNavigator: true,
    backgroundColor: context.colors.surface,
    builder: (context) => _AddRoutineTaskSheet(daily: daily),
  );
}

class _AddRoutineTaskSheet extends StatefulWidget {
  const _AddRoutineTaskSheet({required this.daily});

  final bool daily;

  @override
  State<_AddRoutineTaskSheet> createState() => _AddRoutineTaskSheetState();
}

class _AddRoutineTaskSheetState extends State<_AddRoutineTaskSheet> {
  final _controller = TextEditingController();
  RoutineCategory _category = RoutineCategory.devotion;
  RoutineRange? _range;

  @override
  void initState() {
    super.initState();
    // Save waits for a name, so it follows what is typed.
    _controller.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool get _canSave =>
      _controller.text.trim().isNotEmpty &&
      (_range == null || isRoutineRangeValid(_range!));

  /// A standard routine fills in its category and its usual time range; both
  /// can still be changed, and the name is the menu's own to write.
  void _pickPreset(RoutinePreset? preset) {
    if (preset == null) return;
    setState(() {
      _category = preset.category;
      _range = (start: preset.start, end: preset.end);
    });
  }

  void _submit() {
    if (!_canSave) return;
    final range = _range;
    Navigator.of(context).pop(
      RoutineTaskDraft(
        title: _controller.text.trim(),
        category: _category,
        window: range == null
            ? null
            : RoutineWindow(start: range.start, end: range.end),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    // The form scrolls and the button stays put under it, both above the
    // keyboard: a sheet taller than what is left of the screen then scrolls
    // instead of overflowing.
    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.sm,
                  AppSpacing.lg,
                  AppSpacing.lg,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.daily
                          ? text.routineDailyAdd
                          : text.routineAddTask,
                      style: context.texts.titleLarge,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    _NameField(controller: _controller, onPreset: _pickPreset),
                    const SizedBox(height: AppSpacing.lg),
                    Text(
                      text.routineCategoryLabel,
                      style: context.texts.labelLarge,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.sm,
                      children: [
                        for (final category in RoutineCategory.values)
                          _CategoryChip(
                            category: category,
                            selected: _category == category,
                            onSelected: () =>
                                setState(() => _category = category),
                          ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    RoutineWindowField(
                      range: _range,
                      onChanged: (range) => setState(() => _range = range),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                0,
                AppSpacing.lg,
                AppSpacing.xl,
              ),
              child: SizedBox(
                height: AppSizes.buttonHeight,
                child: FilledButton(
                  onPressed: _canSave ? _submit : null,
                  child: Text(
                    widget.daily
                        ? text.routineDailySaveAction
                        : text.routineSaveAction,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The task's name: a menu of the standard routines that is also a text field,
/// so anything not on the menu is typed in.
///
/// Opening it (a tap on the field or its arrow) lists every routine, even when
/// a name is already in it. Typing narrows the list to the routines that
/// contain what was typed, and a name that is none of them leaves no menu at
/// all — the menu's padding is zero so an empty one has no height — rather
/// than a list of nine unrelated routines laid over the category chips.
/// Search stays off: it highlights the first match, and "Done" on the keyboard
/// would then swap what was typed for that routine.
class _NameField extends StatelessWidget {
  const _NameField({required this.controller, required this.onPreset});

  final TextEditingController controller;
  final ValueChanged<RoutinePreset?> onPreset;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return DropdownMenu<RoutinePreset>(
      controller: controller,
      expandedInsets: EdgeInsets.zero,
      menuHeight: RoutineConfig.presetMenuHeight,
      requestFocusOnTap: true,
      enableFilter: true,
      enableSearch: false,
      menuStyle: const MenuStyle(
        padding: WidgetStatePropertyAll(EdgeInsets.zero),
      ),
      label: Text(text.routineTaskNameLabel),
      hintText: text.routineTaskHint,
      textInputAction: TextInputAction.done,
      onSelected: onPreset,
      dropdownMenuEntries: [
        for (final preset in RoutinePreset.values)
          DropdownMenuEntry<RoutinePreset>(
            value: preset,
            label: routinePresetLabel(text, preset),
            leadingIcon: Icon(routineCategoryIcon(preset.category)),
            labelWidget: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(routinePresetLabel(text, preset)),
                Text(
                  routineWindowLabel(context, preset.window),
                  style: context.texts.bodySmall?.copyWith(
                    color: context.colors.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// A category as a chip. The icon is drawn in the chip's own label colour: the
/// theme paints a selected chip in the primary colour, which in dark mode is
/// white, and an icon left in the default ink would vanish on it.
class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.category,
    required this.selected,
    required this.onSelected,
  });

  final RoutineCategory category;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return ChoiceChip(
      label: Text(routineCategoryLabel(text, category)),
      avatar: Icon(
        routineCategoryIcon(category),
        size: AppSizes.iconSm,
        color: selected
            ? context.colors.onPrimary
            : context.colors.onSurfaceVariant,
      ),
      selected: selected,
      onSelected: (_) => onSelected(),
    );
  }
}
