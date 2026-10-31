import 'package:flutter/material.dart';

import '../../core/constants/routine_config.dart';
import '../../core/constants/routine_presets.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/routine_task.dart';
import 'routine_limits.dart';
import 'routine_style.dart';
import 'routine_window_field.dart';

/// What the sheet hands back — the provider decides the id, this only
/// describes what to add or what the task becomes.
class RoutineTaskDraft {
  const RoutineTaskDraft({
    required this.title,
    required this.category,
    this.window,
    this.daily = false,
  });

  final String title;
  final RoutineCategory category;

  /// When the task is meant to be done, or null for one with no set time.
  final RoutineWindow? window;

  /// Whether it repeats every day (from the day it was added or changed on).
  final bool daily;
}

/// What the edit sheet hands back: the task as it is to be, or that it is to
/// be deleted.
class RoutineTaskEdit {
  const RoutineTaskEdit.save(RoutineTaskDraft this.draft) : delete = false;
  const RoutineTaskEdit.delete() : draft = null, delete = true;

  final RoutineTaskDraft? draft;
  final bool delete;
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
/// [daily] words it for the daily routine ("Add to every day"); otherwise it
/// adds to a day, with a switch to make the task repeat every day from it.
Future<RoutineTaskDraft?> showAddRoutineTaskSheet(
  BuildContext context, {
  bool daily = false,
}) {
  return _showSheet<RoutineTaskDraft>(
    context,
    _RoutineTaskSheet(purpose: daily ? _Purpose.addDaily : _Purpose.addToDay),
  );
}

/// The same form filled in with [task], to change it from the day it is shown
/// on: its name, category and time range, whether it repeats every day, or
/// to delete it from that day on.
///
/// [fromDailyList] is the daily routine's own list, where an item is changed
/// from today on and is taken off with the list's own button: the sheet then
/// has neither the switch nor a delete button.
Future<RoutineTaskEdit?> showEditRoutineTaskSheet(
  BuildContext context,
  RoutineTask task, {
  bool fromDailyList = false,
}) {
  return _showSheet<RoutineTaskEdit>(
    context,
    _RoutineTaskSheet(
      purpose: fromDailyList ? _Purpose.editDaily : _Purpose.editOnDay,
      task: task,
    ),
  );
}

Future<T?> _showSheet<T>(BuildContext context, Widget sheet) {
  return showModalBottomSheet<T>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    useRootNavigator: true,
    backgroundColor: context.colors.surface,
    builder: (context) => sheet,
  );
}

/// What the form is open for.
enum _Purpose {
  /// A new task on the day shown, which may be made to repeat.
  addToDay,

  /// A new item of the daily routine, from its own list.
  addDaily,

  /// A task on the day shown, daily or not.
  editOnDay,

  /// An item of the daily routine, from its own list.
  editDaily;

  bool get isEdit => this == editOnDay || this == editDaily;

  /// Whether "Repeat every day" can be switched here.
  bool get asksRepeat => this == addToDay || this == editOnDay;
}

class _RoutineTaskSheet extends StatefulWidget {
  const _RoutineTaskSheet({required this.purpose, this.task});

  final _Purpose purpose;

  /// The task being changed, or null when adding one.
  final RoutineTask? task;

  @override
  State<_RoutineTaskSheet> createState() => _RoutineTaskSheetState();
}

class _RoutineTaskSheetState extends State<_RoutineTaskSheet> {
  late final _controller = TextEditingController(text: widget.task?.title);
  late RoutineCategory _category =
      widget.task?.category ?? RoutineCategory.devotion;
  late RoutineRange? _range = switch (widget.task?.window) {
    final window? => (start: window.start, end: window.end),
    null => null,
  };
  late bool _daily =
      widget.task?.isDaily ?? widget.purpose == _Purpose.addDaily;

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

  /// Why the range cannot be kept, when the task is a wake-up or a bedtime and
  /// it starts too late — see `routine_limits.dart`.
  String? get _limitMessage =>
      routineLimitMessage(context, _controller.text, _range);

  bool get _canSave =>
      _controller.text.trim().isNotEmpty &&
      (_range == null || isRoutineRangeValid(_range!)) &&
      _limitMessage == null;

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
    final draft = RoutineTaskDraft(
      title: _controller.text.trim(),
      category: _category,
      window: range == null
          ? null
          : RoutineWindow(start: range.start, end: range.end),
      daily: _daily,
    );
    Navigator.of(
      context,
    ).pop(widget.purpose.isEdit ? RoutineTaskEdit.save(draft) : draft);
  }

  void _delete() => Navigator.of(context).pop(const RoutineTaskEdit.delete());

  /// What switching to repeat, or away from it, will do — said before it is
  /// done, since a change to a daily item never reaches back before its day.
  String? _note(AppLocalizations text) {
    final wasDaily = widget.task?.isDaily ?? false;
    return switch (widget.purpose) {
      _Purpose.editDaily => text.routineEditDailyFromToday,
      _Purpose.addDaily => null,
      _ when wasDaily && _daily => text.routineEditDailyFromDay,
      _ when wasDaily => text.routineRepeatStops,
      _ when _daily => text.routineRepeatFromDay,
      _ => null,
    };
  }

  String _saveLabel(AppLocalizations text) {
    if (widget.purpose.isEdit) return text.routineSaveChanges;
    return _daily ? text.routineDailySaveAction : text.routineSaveAction;
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
                      switch (widget.purpose) {
                        _Purpose.addToDay => text.routineAddTask,
                        _Purpose.addDaily => text.routineDailyAdd,
                        _ => text.routineEditTask,
                      },
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
                    if (_limitMessage case final message?) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        message,
                        style: context.texts.bodySmall?.copyWith(
                          color: context.colors.error,
                        ),
                      ),
                    ],
                    if (widget.purpose.asksRepeat) ...[
                      const SizedBox(height: AppSpacing.md),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        secondary: const Icon(Icons.repeat_rounded),
                        title: Text(text.routineRepeatDaily),
                        value: _daily,
                        onChanged: (value) => setState(() => _daily = value),
                      ),
                    ],
                    if (_note(text) case final note?) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        note,
                        style: context.texts.bodySmall?.copyWith(
                          color: context.colors.onSurfaceVariant,
                        ),
                      ),
                    ],
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
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(
                    height: AppSizes.buttonHeight,
                    child: FilledButton(
                      onPressed: _canSave ? _submit : null,
                      child: Text(_saveLabel(text)),
                    ),
                  ),
                  if (widget.purpose == _Purpose.editOnDay) ...[
                    const SizedBox(height: AppSpacing.sm),
                    TextButton.icon(
                      onPressed: _delete,
                      icon: const Icon(Icons.delete_outline_rounded),
                      label: Text(
                        widget.task?.isDaily ?? false
                            ? text.routineDeleteDaily
                            : text.routineDeleteTask,
                      ),
                    ),
                  ],
                ],
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
