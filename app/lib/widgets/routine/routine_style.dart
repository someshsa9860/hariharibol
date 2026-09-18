import 'package:flutter/material.dart';

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
