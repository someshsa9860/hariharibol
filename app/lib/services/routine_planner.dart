import '../core/constants/routine_plan_config.dart';
import '../core/constants/routine_presets.dart';
import '../models/routine_task.dart';

/// One row of a planned day: which standard routine it is and when.
class PlannedRoutineItem {
  const PlannedRoutineItem(this.preset, this.window);

  final RoutinePreset preset;
  final RoutineWindow window;
}

/// A day worked out for someone from what they chant and how much.
class RoutinePlan {
  const RoutinePlan({
    required this.wake,
    required this.bedtime,
    required this.chantMinutes,
    required this.fitsMorning,
    required this.items,
  });

  /// When they wake and when they go to bed, minutes after midnight.
  final int wake;
  final int bedtime;

  /// How long the morning rounds take.
  final int chantMinutes;

  /// Whether the morning rounds are over by
  /// [RoutinePlanConfig.morningChantDeadlineMinute].
  final bool fitsMorning;

  /// The day, in the order it is lived.
  final List<PlannedRoutineItem> items;
}

/// Works out a devotee's daily routine from the rounds they mean to chant.
///
/// The more they chant, the earlier they wake: the rounds have to be finished
/// by a fixed morning hour, so the wake-up is placed that long (plus the time to
/// get ready) before it — but never *suggested* earlier than 4 AM. The bedtime
/// follows from the wake-up, leaving six hours' sleep, and never runs past
/// midnight. A pure function of its inputs, so what the screen shows and what is
/// saved cannot differ.
abstract final class RoutinePlanner {
  /// Minutes the day's rounds take: [rounds] of [chantMs] a chant, 108 chants a
  /// round, and the extra a real round takes over the chants alone.
  static int chantMinutesFor({required int rounds, required int chantMs}) {
    final ms = chantMs > 0 ? chantMs : RoutinePlanConfig.fallbackChantMs;
    final minutes =
        rounds *
        RoutinePlanConfig.beadsPerRound *
        ms *
        RoutinePlanConfig.chantPaceFactor /
        Duration.millisecondsPerMinute;
    final whole = minutes.ceil();
    return whole < RoutinePlanConfig.minChantWindowMinutes
        ? RoutinePlanConfig.minChantWindowMinutes
        : whole;
  }

  /// When someone chanting [rounds] should wake.
  static int suggestWake({required int rounds, required int chantMs}) {
    final chant = chantMinutesFor(rounds: rounds, chantMs: chantMs);
    final raw =
        RoutinePlanConfig.morningChantDeadlineMinute -
        RoutinePlanConfig.prepMinutes -
        chant;
    return _max(_down(raw), RoutinePlanConfig.wakeEarliestSuggestedMinute);
  }

  /// A bedtime that leaves [RoutinePlanConfig.minSleepMinutes] before [wake]. It
  /// stops at the last quarter hour of the day, so it is never past midnight.
  static int suggestBedtime(int wake) {
    final latest = _down(wake + Duration.minutesPerDay - RoutinePlanConfig.minSleepMinutes);
    return _min(latest, _down(Duration.minutesPerDay - 1));
  }

  /// Whether [minute] may be a bedtime: an evening time, noon or later.
  static bool isBedtimeAllowed(int minute) =>
      minute >= RoutinePlanConfig.sleepEveningStartMinute;

  /// The day for someone chanting [rounds] of a mantra that takes [chantMs] a
  /// chant. [wake] and [bedtime] are what they chose, when they chose; each is
  /// kept inside the day, and a bedtime before noon is pulled to noon, so a plan
  /// never breaks the limit.
  static RoutinePlan plan({
    required int rounds,
    required int chantMs,
    int? wake,
    int? bedtime,
  }) {
    final chant = chantMinutesFor(rounds: rounds, chantMs: chantMs);
    final wakeAt = (wake ?? suggestWake(rounds: rounds, chantMs: chantMs)).clamp(
      0,
      Duration.minutesPerDay - 1,
    );
    final bedAt = (bedtime ?? suggestBedtime(wakeAt)).clamp(
      RoutinePlanConfig.sleepEveningStartMinute,
      Duration.minutesPerDay - 1,
    );

    final chantStart = wakeAt + RoutinePlanConfig.prepMinutes;
    final chantEnd = chantStart + chant;
    final shownChantEnd = chantEnd > RoutinePlanConfig.latestChantEndMinute
        ? RoutinePlanConfig.latestChantEndMinute
        : chantEnd;

    // Breakfast waits for the rounds to end, and goes if that leaves it no room
    // before lunch.
    final breakfast = RoutinePreset.breakfast;
    final breakfastStart = _max(
      breakfast.start,
      _up(shownChantEnd + RoutinePlanConfig.breakfastGapMinutes),
    );
    final hasBreakfast =
        breakfastStart < RoutinePreset.lunch.start - RoutinePlanConfig.stepMinutes;

    // An early bedtime brings the evening forward with it.
    final shift = bedAt < RoutinePlanConfig.eveningLayoutSleepMinute
        ? bedAt - RoutinePlanConfig.eveningLayoutSleepMinute
        : 0;

    PlannedRoutineItem evening(RoutinePreset preset) {
      final length = preset.end - preset.start;
      final start = _max(preset.start + shift, RoutinePlanConfig.earliestEveningMinute);
      return PlannedRoutineItem(preset, RoutineWindow(start: start, end: start + length));
    }

    return RoutinePlan(
      wake: wakeAt,
      bedtime: bedAt,
      chantMinutes: chant,
      fitsMorning: chantEnd <= RoutinePlanConfig.morningChantDeadlineMinute,
      items: [
        PlannedRoutineItem(
          RoutinePreset.wakeUp,
          RoutineWindow(start: wakeAt, end: wakeAt + RoutinePlanConfig.wakeWindowMinutes),
        ),
        PlannedRoutineItem(
          RoutinePreset.morningChant,
          RoutineWindow(start: chantStart, end: shownChantEnd),
        ),
        if (hasBreakfast)
          PlannedRoutineItem(
            RoutinePreset.breakfast,
            RoutineWindow(
              start: breakfastStart,
              end: breakfastStart + (breakfast.end - breakfast.start),
            ),
          ),
        PlannedRoutineItem(RoutinePreset.lunch, RoutinePreset.lunch.window),
        evening(RoutinePreset.eveningChant),
        evening(RoutinePreset.dinner),
        evening(RoutinePreset.scriptureReading),
        PlannedRoutineItem(
          RoutinePreset.sleep,
          RoutineWindow(
            start: bedAt,
            end: _min(bedAt + RoutinePlanConfig.sleepWindowMinutes, Duration.minutesPerDay - 1),
          ),
        ),
      ],
    );
  }

  static int _down(int minute) =>
      minute - minute % RoutinePlanConfig.stepMinutes;

  static int _up(int minute) {
    final rest = minute % RoutinePlanConfig.stepMinutes;
    return rest == 0 ? minute : minute + RoutinePlanConfig.stepMinutes - rest;
  }

  static int _max(int a, int b) => a > b ? a : b;
  static int _min(int a, int b) => a < b ? a : b;
}
