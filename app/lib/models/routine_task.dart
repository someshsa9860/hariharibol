import 'json.dart';

/// The four kinds of thing that make up a devotee's day. Kept as icons, never
/// colours — the palette has no hue to spare for a category tag.
enum RoutineCategory { devotion, work, home, errand }

/// A rough slot in the day, not a clock time — a timetable a person will
/// actually keep to is one they do not have to schedule to the minute.
enum RoutineSlot { morning, afternoon, evening, anytime }

/// A calendar day as the key the routine is stored under: `2026-10-11`. Sorts
/// the same way the days do, so two keys compare as the days they name.
String routineDayKey(DateTime day) {
  final month = day.month.toString().padLeft(2, '0');
  final date = day.day.toString().padLeft(2, '0');
  return '${day.year}-$month-$date';
}

/// The day at midnight, local time — a date with the time of day taken off.
DateTime routineDay(DateTime moment) =>
    DateTime(moment.year, moment.month, moment.day);

/// One item on a day's routine — a round of japa, a chore, an errand. Kept on
/// the device only: there is no backend model for this yet.
///
/// A task is either one a person added **for that day** (it has a [day]), or one
/// of their daily routine, shown on every day it applies to ([isDaily]) with
/// that day's own check. The second kind is built by the provider from a
/// [DailyRoutineItem]; it is never stored as a task.
class RoutineTask {
  const RoutineTask({
    required this.id,
    required this.title,
    this.category = RoutineCategory.errand,
    this.slot = RoutineSlot.anytime,
    this.isDone = false,
    this.day = '',
    this.isDaily = false,
  });

  final String id;
  final String title;
  final RoutineCategory category;
  final RoutineSlot slot;
  final bool isDone;

  /// The day it belongs to, as [routineDayKey]. Empty on a daily item.
  final String day;
  final bool isDaily;

  RoutineTask copyWith({bool? isDone}) => RoutineTask(
    id: id,
    title: title,
    category: category,
    slot: slot,
    isDone: isDone ?? this.isDone,
    day: day,
    isDaily: isDaily,
  );

  RoutineTask withDay(String value) => RoutineTask(
    id: id,
    title: title,
    category: category,
    slot: slot,
    isDone: isDone,
    day: value,
    isDaily: isDaily,
  );

  Json toJson() => {
    'id': id,
    'title': title,
    'category': category.name,
    'slot': slot.name,
    'isDone': isDone,
    'day': day,
  };

  factory RoutineTask.fromJson(Json json) => RoutineTask(
    id: asString(json['id']),
    title: asString(json['title']),
    day: asString(json['day']),
    category: RoutineCategory.values.firstWhere(
      (value) => value.name == json['category'],
      orElse: () => RoutineCategory.errand,
    ),
    slot: RoutineSlot.values.firstWhere(
      (value) => value.name == json['slot'],
      orElse: () => RoutineSlot.anytime,
    ),
    isDone: asBool(json['isDone']),
  );
}

/// One item of the optional daily routine: it appears on every day from
/// [since] until it is removed, and each day keeps its own check.
///
/// Removing one sets [until] to the last day it applied rather than deleting
/// it, so the days already lived keep showing what was on them.
class DailyRoutineItem {
  const DailyRoutineItem({
    required this.id,
    required this.title,
    required this.since,
    this.category = RoutineCategory.devotion,
    this.slot = RoutineSlot.anytime,
    this.until = '',
  });

  final String id;
  final String title;
  final RoutineCategory category;
  final RoutineSlot slot;

  /// First day it applies, as [routineDayKey].
  final String since;

  /// Last day it applies, or empty while it is still going.
  final String until;

  bool get isActive => until.isEmpty;

  bool appliesOn(String day) =>
      day.compareTo(since) >= 0 && (until.isEmpty || day.compareTo(until) <= 0);

  DailyRoutineItem endedOn(String lastDay) => DailyRoutineItem(
    id: id,
    title: title,
    since: since,
    category: category,
    slot: slot,
    until: lastDay,
  );

  /// How it reads on [day]: a task with that day's check.
  RoutineTask on(String day, {required bool isDone}) => RoutineTask(
    id: id,
    title: title,
    category: category,
    slot: slot,
    isDone: isDone,
    day: day,
    isDaily: true,
  );

  Json toJson() => {
    'id': id,
    'title': title,
    'category': category.name,
    'slot': slot.name,
    'since': since,
    'until': until,
  };

  factory DailyRoutineItem.fromJson(Json json) => DailyRoutineItem(
    id: asString(json['id']),
    title: asString(json['title']),
    since: asString(json['since']),
    until: asString(json['until']),
    category: RoutineCategory.values.firstWhere(
      (value) => value.name == json['category'],
      orElse: () => RoutineCategory.devotion,
    ),
    slot: RoutineSlot.values.firstWhere(
      (value) => value.name == json['slot'],
      orElse: () => RoutineSlot.anytime,
    ),
  );
}
