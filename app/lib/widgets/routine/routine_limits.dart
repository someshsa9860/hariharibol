import 'package:flutter/widgets.dart';

import '../../core/constants/routine_plan_config.dart';
import '../../core/constants/routine_presets.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../services/routine_planner.dart';
import 'routine_style.dart';
import 'routine_window_field.dart';

/// The bedtime routine's name in every language the app is written in,
/// lower-cased — so the limit still holds when the reader changed the app's
/// language after adding the task.
///
/// The limit is that nobody goes to bed before noon. A task is a bedtime **by
/// its name**: a task has no kind of its own, and the standard routines fill in
/// only a name, a category and a time. So a task renamed to something else is no
/// longer held to the limit; that is the price of keeping the routine as simple
/// as it is.
final Set<String> _bedtimeNames = {
  for (final locale in AppLocalizations.supportedLocales)
    _key(lookupAppLocalizations(locale).routinePresetSleep),
};

String _key(String title) => title.trim().toLowerCase();

/// [RoutinePreset.sleep] when [title] is the bedtime routine's name in any of the
/// app's languages, otherwise null.
RoutinePreset? routineLimitedPresetOf(String title) =>
    _bedtimeNames.contains(_key(title)) ? RoutinePreset.sleep : null;

/// What is wrong with [range] for a task called [title], said in words — or
/// null when it keeps the limit or the task is not limited. The limit applies to
/// when the range *starts*: that is when the bedtime is.
String? routineLimitMessage(
  BuildContext context,
  String title,
  RoutineRange? range,
) {
  if (range == null) return null;
  final preset = routineLimitedPresetOf(title);
  if (preset == null) return null;
  return routinePresetLimitMessage(context, preset, range.start);
}

/// The same check for a routine the app already knows by its preset, as the
/// setup's bedtime is picked: what is wrong with [start] for [preset], or null
/// when it keeps the limit or the preset has none.
String? routinePresetLimitMessage(
  BuildContext context,
  RoutinePreset preset,
  int start,
) {
  final text = AppLocalizations.of(context);
  return switch (preset) {
    RoutinePreset.sleep when !RoutinePlanner.isBedtimeAllowed(start) =>
      text.routineSleepNotBefore(
        routineTimeLabel(context, RoutinePlanConfig.sleepEveningStartMinute),
      ),
    _ => null,
  };
}
