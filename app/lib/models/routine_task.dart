import 'json.dart';

/// The four kinds of thing that make up a devotee's day. Kept as icons, never
/// colours — the palette has no hue to spare for a category tag.
enum RoutineCategory { devotion, work, home, errand }

/// A rough slot in the day, not a clock time — a timetable a person will
/// actually keep to is one they do not have to schedule to the minute.
enum RoutineSlot { morning, afternoon, evening, anytime }

/// One item on today's routine — a round of japa, a chore, an errand. Kept on
/// the device only: there is no backend model for this yet.
class RoutineTask {
  const RoutineTask({
    required this.id,
    required this.title,
    this.category = RoutineCategory.errand,
    this.slot = RoutineSlot.anytime,
    this.isDone = false,
  });

  final String id;
  final String title;
  final RoutineCategory category;
  final RoutineSlot slot;
  final bool isDone;

  RoutineTask copyWith({bool? isDone}) => RoutineTask(
    id: id,
    title: title,
    category: category,
    slot: slot,
    isDone: isDone ?? this.isDone,
  );

  Json toJson() => {
    'id': id,
    'title': title,
    'category': category.name,
    'slot': slot.name,
    'isDone': isDone,
  };

  factory RoutineTask.fromJson(Json json) => RoutineTask(
    id: asString(json['id']),
    title: asString(json['title']),
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
