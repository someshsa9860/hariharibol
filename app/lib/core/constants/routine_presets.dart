import '../../models/routine_task.dart';

/// The standard routines of a devotee's day, offered in the add sheet's name
/// menu with the time range each one is usually kept in. Picking one fills in
/// the name, the category and the range; all three can still be changed.
///
/// The ranges are a starting point, not a rule — a household that eats lunch at
/// 14:30 edits the range once and it is theirs. They are minutes after
/// midnight and in the order of the day, which is the order the menu lists
/// them in. The names are copy and live in the ARB files
/// (`routinePreset…`, see `routinePresetLabel`).
enum RoutinePreset {
  wakeUp(RoutineCategory.home, start: 4 * 60 + 30, end: 6 * 60),
  morningChant(RoutineCategory.devotion, start: 5 * 60, end: 8 * 60),
  exercise(RoutineCategory.home, start: 6 * 60, end: 8 * 60),
  breakfast(RoutineCategory.home, start: 7 * 60 + 30, end: 9 * 60 + 30),
  lunch(RoutineCategory.home, start: 12 * 60, end: 14 * 60),
  eveningChant(RoutineCategory.devotion, start: 18 * 60, end: 19 * 60 + 30),
  dinner(RoutineCategory.home, start: 19 * 60, end: 21 * 60),
  scriptureReading(RoutineCategory.devotion, start: 20 * 60, end: 21 * 60 + 30),
  sleep(RoutineCategory.home, start: 21 * 60, end: 23 * 60);

  const RoutinePreset(this.category, {required this.start, required this.end});

  final RoutineCategory category;
  final int start;
  final int end;

  RoutineWindow get window => RoutineWindow(start: start, end: end);
}
