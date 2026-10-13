import '../core/constants/routine_config.dart';
import 'json.dart';

/// The four kinds of thing that make up a devotee's day. Kept as icons, never
/// colours — the palette has no hue to spare for a category tag.
enum RoutineCategory { devotion, work, home, errand }

/// A rough slot in the day, which is what the list is grouped by. A task with
/// a time range is in the slot its range opens in; one with none is [anytime].
enum RoutineSlot {
  morning,
  afternoon,
  evening,
  anytime;

  /// The slot a clock time (minutes after midnight) falls in.
  static RoutineSlot at(int minute) {
    if (minute >= RoutineConfig.eveningStartMinute) return RoutineSlot.evening;
    if (minute >= RoutineConfig.afternoonStartMinute) {
      return RoutineSlot.afternoon;
    }
    return RoutineSlot.morning;
  }
}

/// How a task stands on a day, which is what the row is coloured by.
///
/// [pending] is a task not ticked yet. A ticked task is [done] when it has no
/// standard time to be judged against, and otherwise [early], [onTime] or
/// [late] by where the time it was done at falls against its range.
enum RoutineStatus { pending, done, early, onTime, late }

/// A time of day as minutes after midnight, the way the routine keeps every
/// time: a day is already known, so a clock time needs no date and no zone.
int routineMinuteOf(DateTime moment) => moment.hour * 60 + moment.minute;

/// The standard time range of a task — when in the day it is meant to be done.
/// Ticking it inside the range is on time; before it, early; after it, late.
///
/// It never wraps past midnight: [end] is after [start], and a task done at
/// 00:30 belongs to the day that began at 00:00, whatever it was meant for.
class RoutineWindow {
  const RoutineWindow({required this.start, required this.end})
    : assert(start >= 0 && end > start && end < RoutineConfig.minutesPerDay);

  /// Whether two clock times make a range: the end after the start, and both
  /// within the one day.
  static bool isValid(int start, int end) =>
      start >= 0 && end > start && end < RoutineConfig.minutesPerDay;

  /// Minutes after midnight.
  final int start;
  final int end;

  /// The slot of the day the range opens in.
  RoutineSlot get slot => RoutineSlot.at(start);

  /// Both ends count as on time: 06:00 is on time for 06:00–07:30, and so is
  /// 07:30.
  RoutineStatus statusOf(int minute) {
    if (minute < start) return RoutineStatus.early;
    if (minute > end) return RoutineStatus.late;
    return RoutineStatus.onTime;
  }

  RoutineWindow copyWith({int? start, int? end}) =>
      RoutineWindow(start: start ?? this.start, end: end ?? this.end);

  /// Nothing when the stored numbers do not make a range, so a bad value on
  /// disk means "no time range" instead of a crash.
  static RoutineWindow? fromJson(Json json) {
    final start = json['windowStart'];
    final end = json['windowEnd'];
    if (start is! int || end is! int || !isValid(start, end)) return null;
    return RoutineWindow(start: start, end: end);
  }

  Json toJson() => {'windowStart': start, 'windowEnd': end};

  @override
  bool operator ==(Object other) =>
      other is RoutineWindow && other.start == start && other.end == end;

  @override
  int get hashCode => Object.hash(start, end);
}

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
///
/// Ticking a task notes the time it was done at ([doneAt]); [status] says how
/// that time sits against the task's standard [window]. A task ticked before
/// times were kept is [isDone] with no [doneAt], and stays plain "done".
class RoutineTask {
  const RoutineTask({
    required this.id,
    required this.title,
    this.category = RoutineCategory.errand,
    this.slot = RoutineSlot.anytime,
    this.window,
    this.isDone = false,
    this.doneAt,
    this.day = '',
    this.isDaily = false,
  });

  final String id;
  final String title;
  final RoutineCategory category;
  final RoutineSlot slot;

  /// When it is meant to be done, or null for a task with no set time.
  final RoutineWindow? window;
  final bool isDone;

  /// The time it was done at, in minutes after midnight. Null while it is not
  /// done, and on a task that was ticked before times were kept.
  final int? doneAt;

  /// The day it belongs to, as [routineDayKey]. Empty on a daily item.
  final String day;
  final bool isDaily;

  RoutineStatus get status {
    if (!isDone) return RoutineStatus.pending;
    final at = doneAt;
    final range = window;
    if (at == null || range == null) return RoutineStatus.done;
    return range.statusOf(at);
  }

  /// Ticked at [minute] (minutes after midnight) — or ticked again at another
  /// time, which is how the time of a done task is changed.
  RoutineTask doneAtMinute(int minute) => RoutineTask(
    id: id,
    title: title,
    category: category,
    slot: slot,
    window: window,
    isDone: true,
    doneAt: minute,
    day: day,
    isDaily: isDaily,
  );

  /// Unticked: the time it had been done at goes with the tick.
  RoutineTask notDone() => RoutineTask(
    id: id,
    title: title,
    category: category,
    slot: slot,
    window: window,
    day: day,
    isDaily: isDaily,
  );

  RoutineTask withDay(String value) => RoutineTask(
    id: id,
    title: title,
    category: category,
    slot: slot,
    window: window,
    isDone: isDone,
    doneAt: doneAt,
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
    if (window != null) ...window!.toJson(),
    if (doneAt != null) 'doneAt': doneAt,
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
    window: RoutineWindow.fromJson(json),
    isDone: asBool(json['isDone']),
    doneAt: json['doneAt'] is int ? json['doneAt'] as int : null,
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
    this.window,
    this.until = '',
  });

  final String id;
  final String title;
  final RoutineCategory category;
  final RoutineSlot slot;
  final RoutineWindow? window;

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
    window: window,
    until: lastDay,
  );

  /// How it reads on [day]: a task with that day's check, and the time it was
  /// checked at if one was noted.
  RoutineTask on(String day, {required bool isDone, int? doneAt}) => RoutineTask(
    id: id,
    title: title,
    category: category,
    slot: slot,
    window: window,
    isDone: isDone,
    doneAt: doneAt,
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
    if (window != null) ...window!.toJson(),
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
    window: RoutineWindow.fromJson(json),
  );
}
