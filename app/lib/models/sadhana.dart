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

/// One sitting of japa — counted bead by bead in the app, or entered
/// afterwards for rounds chanted on physical beads. Both sources land here.
class ChantSession {
  const ChantSession({
    required this.id,
    required this.source,
    required this.rounds,
    required this.beads,
    required this.startedAt,
    this.endedAt,
    this.durationSeconds,
    this.mantraId,
    this.mantraName,
  });

  final String id;

  /// The backend's `ChantSource` — IN_APP or MANUAL.
  final String source;
  final int rounds;

  /// Beads into the round in progress. 108 completes a round.
  final int beads;

  final DateTime startedAt;
  final DateTime? endedAt;
  final int? durationSeconds;

  final String? mantraId;
  final String? mantraName;

  bool get isManual => source == 'MANUAL';
  bool get isFinished => endedAt != null;

  factory ChantSession.fromJson(Json json) {
    final mantra = asJson(json['mantra']);
    return ChantSession(
      id: asString(json['id']),
      source: asString(json['source'], 'IN_APP'),
      rounds: asInt(json['rounds']),
      beads: asInt(json['beads']),
      startedAt: asDate(json['startedAt']) ?? DateTime.now(),
      endedAt: asDate(json['endedAt']),
      durationSeconds: asIntOrNull(json['durationSeconds']),
      mantraId: asStringOrNull(json['mantraId']),
      mantraName: mantra == null ? null : asStringOrNull(mantra['name']),
    );
  }
}

/// The standing target and reminder, read from the profile and prefilled
/// onto every new day unless that day changes its own target.
class SadhanaProfile {
  const SadhanaProfile({
    required this.dailyRoundTarget,
    this.reminderTime,
    this.preferredMantraId,
    this.preferredMantraSlug,
    this.preferredMantraName,
  });

  final int dailyRoundTarget;

  /// "04:30", local to the user's own timezone.
  final String? reminderTime;

  /// What "Chant now" opens with when nothing more specific was tapped. Only
  /// the id, slug and name travel with the profile — the chant screen needs
  /// the full mantra (text, pacing), which it fetches by slug the same way
  /// opening a mantra from its own detail page does.
  final String? preferredMantraId;
  final String? preferredMantraSlug;
  final String? preferredMantraName;

  factory SadhanaProfile.fromJson(Json json) {
    final mantra = asJson(json['preferredMantra']);
    return SadhanaProfile(
      dailyRoundTarget: asInt(json['dailyRoundTarget'], 16),
      reminderTime: asStringOrNull(json['reminderTime']),
      preferredMantraId: asStringOrNull(json['preferredMantraId']),
      preferredMantraSlug: mantra == null ? null : asStringOrNull(mantra['slug']),
      preferredMantraName: mantra == null ? null : asStringOrNull(mantra['name']),
    );
  }
}

/// The whole practice screen in one call: the day, its sessions, its standing
/// preferences and the current streak.
class SadhanaToday {
  const SadhanaToday({
    required this.date,
    required this.day,
    required this.tasks,
    required this.sessions,
    required this.streak,
    required this.beadsPerRound,
    this.profile,
  });

  final String date;
  final SadhanaDay day;
  final List<SadhanaTask> tasks;
  final List<ChantSession> sessions;
  final int streak;

  /// 108, sent by the server rather than assumed, so a future mantra counted
  /// differently does not need an app update to chant correctly.
  final int beadsPerRound;

  final SadhanaProfile? profile;

  factory SadhanaToday.fromJson(Json json) => SadhanaToday(
        date: asString(json['date']),
        day: SadhanaDay.fromJson(asJson(json['day']) ?? const {}),
        tasks: asList(json['tasks'], SadhanaTask.fromJson),
        sessions: asList(json['sessions'], ChantSession.fromJson),
        streak: asInt(json['streak']),
        beadsPerRound: asInt(json['beadsPerRound'], 108),
        profile: asJson(json['profile']) == null
            ? null
            : SadhanaProfile.fromJson(asJson(json['profile'])!),
      );
}
