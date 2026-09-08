import 'json.dart';

/// Today's practice: the target, what is done, and how the day is going.
///
/// The API returns null for this until the day is opened, which is the
/// difference between "start your day" and "target met, zero of zero".
class SadhanaDay {
  const SadhanaDay({
    required this.roundTarget,
    required this.roundsCompleted,
    required this.tasksTotal,
    required this.tasksDone,
  });

  final int roundTarget;
  final int roundsCompleted;
  final int tasksTotal;
  final int tasksDone;

  /// 0.0–1.0, clamped, and 0 when no target is set so a progress bar never
  /// divides by zero.
  double get roundProgress =>
      roundTarget <= 0 ? 0 : (roundsCompleted / roundTarget).clamp(0.0, 1.0);

  double get taskProgress => tasksTotal <= 0 ? 0 : (tasksDone / tasksTotal).clamp(0.0, 1.0);

  bool get roundTargetMet => roundTarget > 0 && roundsCompleted >= roundTarget;

  factory SadhanaDay.fromJson(Json json) => SadhanaDay(
        roundTarget: asInt(json['roundTarget']),
        roundsCompleted: asInt(json['roundsCompleted']),
        tasksTotal: asInt(json['tasksTotal']),
        tasksDone: asInt(json['tasksDone']),
      );
}

/// The sadhana block on the dashboard: today, plus the run of days behind it.
class SadhanaSummary {
  const SadhanaSummary({this.today, this.streak = 0});

  final SadhanaDay? today;
  final int streak;

  bool get dayStarted => today != null;

  factory SadhanaSummary.fromJson(Json json) => SadhanaSummary(
        today: asJson(json['today']) == null ? null : SadhanaDay.fromJson(asJson(json['today'])!),
        streak: asInt(json['streak']),
      );
}

/// One item on today's list.
class SadhanaTask {
  const SadhanaTask({
    required this.id,
    required this.title,
    required this.status,
    this.notes,
    this.date,
    this.completedAt,
    this.deferCount = 0,
    this.movedFromId,
  });

  final String id;
  final String title;

  /// The backend's `TaskStatus` — PENDING, DONE, MOVED, DROPPED.
  final String status;
  final String? notes;
  final DateTime? date;
  final DateTime? completedAt;

  /// How many times this has been pushed to tomorrow. The productivity report
  /// is built on it, so it is shown rather than hidden.
  final int deferCount;

  /// Set when this task is yesterday's, carried forward.
  final String? movedFromId;

  bool get isDone => status == 'DONE';
  bool get isPending => status == 'PENDING';
  bool get wasCarried => movedFromId != null;

  factory SadhanaTask.fromJson(Json json) => SadhanaTask(
        id: asString(json['id']),
        title: asString(json['title']),
        status: asString(json['status'], 'PENDING'),
        notes: asStringOrNull(json['notes']),
        date: asDate(json['date']),
        completedAt: asDate(json['completedAt']),
        deferCount: asInt(json['deferCount']),
        movedFromId: asStringOrNull(json['movedFromId']),
      );
}
