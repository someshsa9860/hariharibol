import 'package:flutter/material.dart';

import '../../core/constants/routine_presets.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/routine_task.dart';

/// How a category or a slot is drawn — shared between the task tile and the
/// add sheet so the two never drift apart on what a category looks like.
///
/// Icons only, never colour: the palette has no hue left to spend on telling
/// four categories apart.
IconData routineCategoryIcon(RoutineCategory category) => switch (category) {
  RoutineCategory.devotion => Icons.self_improvement_rounded,
  RoutineCategory.work => Icons.work_outline_rounded,
  RoutineCategory.home => Icons.cottage_outlined,
  RoutineCategory.errand => Icons.directions_walk_rounded,
};

String routineCategoryLabel(AppLocalizations text, RoutineCategory category) =>
    switch (category) {
      RoutineCategory.devotion => text.routineCategoryDevotion,
      RoutineCategory.work => text.routineCategoryWork,
      RoutineCategory.home => text.routineCategoryHome,
      RoutineCategory.errand => text.routineCategoryErrand,
    };

String routineSlotLabel(AppLocalizations text, RoutineSlot slot) =>
    switch (slot) {
      RoutineSlot.morning => text.routineSlotMorning,
      RoutineSlot.afternoon => text.routineSlotAfternoon,
      RoutineSlot.evening => text.routineSlotEvening,
      RoutineSlot.anytime => text.routineSlotAnytime,
    };

String routinePresetLabel(AppLocalizations text, RoutinePreset preset) =>
    switch (preset) {
      RoutinePreset.wakeUp => text.routinePresetWakeUp,
      RoutinePreset.morningChant => text.routinePresetMorningChant,
      RoutinePreset.exercise => text.routinePresetExercise,
      RoutinePreset.breakfast => text.routinePresetBreakfast,
      RoutinePreset.lunch => text.routinePresetLunch,
      RoutinePreset.eveningChant => text.routinePresetEveningChant,
      RoutinePreset.dinner => text.routinePresetDinner,
      RoutinePreset.scriptureReading => text.routinePresetScriptureReading,
      RoutinePreset.sleep => text.routinePresetSleep,
    };

// ── Times ────────────────────────────────────────────────────────────────────

TimeOfDay routineTimeOf(int minute) =>
    TimeOfDay(hour: minute ~/ 60, minute: minute % 60);

int routineMinuteOfTime(TimeOfDay time) => time.hour * 60 + time.minute;

/// A time as the phone shows times: 12- or 24-hour as its own setting says,
/// with the reader's own digits and am/pm.
String routineTimeLabel(BuildContext context, int minute) =>
    routineTimeOf(minute).format(context);

String routineWindowLabel(BuildContext context, RoutineWindow window) =>
    AppLocalizations.of(context).routineWindowRange(
      routineTimeLabel(context, window.start),
      routineTimeLabel(context, window.end),
    );

// ── How on time ──────────────────────────────────────────────────────────────

/// The word for a status. A task not ticked has none to show on screen — its
/// empty circle says it — but a screen reader is told.
String routineStatusLabel(AppLocalizations text, RoutineStatus status) =>
    switch (status) {
      RoutineStatus.pending => text.routineStatusNotDone,
      RoutineStatus.done => text.routineStatusDone,
      RoutineStatus.early => text.routineStatusEarly,
      RoutineStatus.onTime => text.routineStatusOnTime,
      RoutineStatus.late => text.routineStatusLate,
    };

/// The colour a status is drawn in: yellow early, green on time, red late, the
/// theme's own muted tone for a task not ticked, and the theme's "done" for a
/// ticked one with nothing to be judged against. See
/// [AppColors.earlyLight] for why this is allowed and what always goes with it.
Color routineStatusColor(BuildContext context, RoutineStatus status) {
  final isLight = context.theme.brightness == Brightness.light;
  return switch (status) {
    RoutineStatus.pending => context.colors.onSurfaceVariant,
    RoutineStatus.done => context.semanticColors.success,
    RoutineStatus.early => AppColors.early(isLight: isLight),
    RoutineStatus.onTime => AppColors.onTime(isLight: isLight),
    RoutineStatus.late => AppColors.late(isLight: isLight),
  };
}

IconData routineStatusIcon(RoutineStatus status) => switch (status) {
  RoutineStatus.pending => Icons.radio_button_unchecked_rounded,
  _ => Icons.check_circle_rounded,
};
