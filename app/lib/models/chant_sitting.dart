import 'dart:convert';
import 'dart:math';

import '../core/constants/chant_sync_config.dart';
import 'json.dart';
import 'routine_task.dart';

/// One sitting of chanting as the phone keeps it: what was counted, and how
/// much of it the server has been told.
///
/// The phone is where chanting is first written; the server hears of it later,
/// in a batch (see `ChantSyncer`). A sitting is made when the counter opens —
/// its [clientId] is how the server knows it again, so sending it twice is the
/// same sitting and not two — and it belongs to the day it began, the way it
/// does on the server.
///
/// What was sent is kept beside what is now ([syncedRounds] and the like), so
/// "is there anything to send" is a comparison and not a flag that can be left
/// raised or lowered by a request that fails half way.
class ChantSitting {
  const ChantSitting({
    required this.clientId,
    required this.day,
    required this.startedAt,
    this.mantraId,
    this.rounds = 0,
    this.beads = 0,
    this.finished = false,
    this.endedAt,
    this.pendingMalas = const {},
    this.synced = false,
    this.syncedRounds = 0,
    this.syncedBeads = 0,
    this.syncedFinished = false,
  });

  /// Made on the phone when the sitting begins; unique to the account.
  final String clientId;

  /// The day it began, as `yyyy-MM-dd` on the phone's own calendar.
  final String day;
  final DateTime startedAt;

  /// Null for a sitting on the plain counter, with no mantra.
  final String? mantraId;

  /// Whole rounds this sitting has completed, and the beads into the round after
  /// them — the figures the counter shows. A round left part-way by an earlier
  /// sitting and finished in this one is completed here, so it counts here, once.
  final int rounds;
  final int beads;

  final bool finished;
  final DateTime? endedAt;

  /// The rounds whose figures changed since they were last sent, by index,
  /// each as [ChantMalaLog.toJson] writes it.
  final Map<int, Json> pendingMalas;

  /// The server has heard of this sitting, and what it was told then.
  final bool synced;
  final int syncedRounds;
  final int syncedBeads;
  final bool syncedFinished;

  /// Something was counted. A sitting opened and left with no bead is never
  /// sent: it would be an empty row on the account.
  bool get hasChanted => rounds > 0 || beads > 0;

  /// There is something the server has not been told.
  bool get isDirty =>
      hasChanted &&
      (!synced ||
          rounds != syncedRounds ||
          beads != syncedBeads ||
          (finished && !syncedFinished) ||
          pendingMalas.isNotEmpty);

  ChantSitting copyWith({
    int? rounds,
    int? beads,
    bool? finished,
    DateTime? endedAt,
    Map<int, Json>? pendingMalas,
    bool? synced,
    int? syncedRounds,
    int? syncedBeads,
    bool? syncedFinished,
  }) =>
      ChantSitting(
        clientId: clientId,
        day: day,
        startedAt: startedAt,
        mantraId: mantraId,
        rounds: rounds ?? this.rounds,
        beads: beads ?? this.beads,
        finished: finished ?? this.finished,
        endedAt: endedAt ?? this.endedAt,
        pendingMalas: pendingMalas ?? this.pendingMalas,
        synced: synced ?? this.synced,
        syncedRounds: syncedRounds ?? this.syncedRounds,
        syncedBeads: syncedBeads ?? this.syncedBeads,
        syncedFinished: syncedFinished ?? this.syncedFinished,
      );

  /// This sitting with the figures now counted, held to what the server takes
  /// ([ChantSyncConfig.maxRounds] and the rest) so that one odd sitting can never
  /// become a request the server refuses again and again.
  ///
  /// [malas] are the rounds whose figures changed since the last call, each as
  /// [ChantMalaLog.toJson] writes it. They wait with the others until they are
  /// sent, a later figure for a round replacing an earlier one.
  ChantSitting counted({
    required int rounds,
    required int beads,
    Iterable<Json> malas = const [],
  }) {
    final waiting = Map<int, Json>.of(pendingMalas);
    for (final mala in malas) {
      final held = _heldToLimits(mala);
      waiting[asInt(held['index'])] = held;
    }
    return copyWith(
      rounds: rounds.clamp(0, ChantSyncConfig.maxRounds),
      beads: beads.clamp(0, ChantSyncConfig.maxBeads),
      pendingMalas: waiting,
    );
  }

  static Json _heldToLimits(Json mala) => {
        ...mala,
        'index': asInt(mala['index']).clamp(1, ChantSyncConfig.maxMalaIndex),
        'beads': asInt(mala['beads']).clamp(0, ChantSyncConfig.maxMalaBeads),
        'durationMs': asInt(mala['durationMs']).clamp(0, ChantSyncConfig.maxMalaMs),
        'avgGapMs': asInt(mala['avgGapMs']).clamp(0, ChantSyncConfig.maxMalaMs),
      };

  /// The sitting as the sync request carries it. The rounds are the oldest
  /// [ChantSyncConfig.malasPerSitting] waiting, in order, so a very long sitting
  /// goes up over more than one request.
  ({Json json, List<int> malaIndexes}) toRequest() {
    final indexes = (pendingMalas.keys.toList()..sort())
        .take(ChantSyncConfig.malasPerSitting)
        .toList();
    return (
      json: {
        'clientId': clientId,
        'mantraId': ?mantraId,
        'startedAt': startedAt.millisecondsSinceEpoch,
        'endedAt': ?endedAt?.millisecondsSinceEpoch,
        'rounds': rounds,
        'beads': beads,
        'finish': ?(finished ? true : null),
        if (indexes.isNotEmpty) 'malas': [for (final i in indexes) pendingMalas[i]!],
      },
      malaIndexes: indexes,
    );
  }

  /// What the server answered for this sitting: it has [sent], and whatever of
  /// the rounds in [sentMalas] has not changed since is no longer waiting.
  ChantSitting acknowledged({
    required int sentRounds,
    required int sentBeads,
    required bool sentFinished,
    required Map<int, Json> sentMalas,
  }) {
    final waiting = Map<int, Json>.of(pendingMalas);
    sentMalas.forEach((index, mala) {
      // A round that changed while the request was on its way stays waiting.
      if (jsonEncode(waiting[index]) == jsonEncode(mala)) waiting.remove(index);
    });
    return copyWith(
      synced: true,
      syncedRounds: sentRounds,
      syncedBeads: sentBeads,
      syncedFinished: sentFinished,
      pendingMalas: waiting,
    );
  }

  Json toJson() => {
        'clientId': clientId,
        'day': day,
        'startedAt': startedAt.millisecondsSinceEpoch,
        'mantraId': mantraId,
        'rounds': rounds,
        'beads': beads,
        'finished': finished,
        'endedAt': endedAt?.millisecondsSinceEpoch,
        'pendingMalas': {for (final e in pendingMalas.entries) '${e.key}': e.value},
        'synced': synced,
        'syncedRounds': syncedRounds,
        'syncedBeads': syncedBeads,
        'syncedFinished': syncedFinished,
      };

  static const int _idBytes = 16;

  /// A new sitting's id: 32 hex digits from the system's secure random, so two
  /// sittings — on this phone or any other — never share one.
  static String newClientId([Random? random]) {
    final source = random ?? Random.secure();
    return [
      for (var i = 0; i < _idBytes; i++) source.nextInt(256).toRadixString(16).padLeft(2, '0'),
    ].join();
  }

  /// Null for a row that cannot be read, so one bad row does not lose the rest.
  static ChantSitting? tryFromJson(Json json) {
    final clientId = asStringOrNull(json['clientId']);
    final day = asStringOrNull(json['day']);
    final started = json['startedAt'];
    if (clientId == null || day == null || started is! num) return null;

    final malas = <int, Json>{};
    final raw = asJson(json['pendingMalas']) ?? const {};
    raw.forEach((key, value) {
      final index = int.tryParse(key);
      final mala = asJson(value);
      if (index != null && mala != null) malas[index] = mala;
    });

    final ended = json['endedAt'];
    return ChantSitting(
      clientId: clientId,
      day: day,
      startedAt: DateTime.fromMillisecondsSinceEpoch(started.toInt()),
      mantraId: asStringOrNull(json['mantraId']),
      rounds: asInt(json['rounds']),
      beads: asInt(json['beads']),
      finished: asBool(json['finished']),
      endedAt: ended is num ? DateTime.fromMillisecondsSinceEpoch(ended.toInt()) : null,
      pendingMalas: malas,
      synced: asBool(json['synced']),
      syncedRounds: asInt(json['syncedRounds']),
      syncedBeads: asInt(json['syncedBeads']),
      syncedFinished: asBool(json['syncedFinished']),
    );
  }
}

/// The sittings worth keeping on the phone at [now]: every one the server has
/// not been told about, however old, and the sent ones from the last
/// [ChantSyncConfig.keepSyncedDays] days (today the first) — those are what let
/// the phone tell what the server's figures lack while its answer is a moment
/// behind. A sitting opened and left with no bead is dropped.
List<ChantSitting> keptSittings(Iterable<ChantSitting> sittings, DateTime now) {
  final oldest = routineDayKey(
    DateTime(now.year, now.month, now.day - (ChantSyncConfig.keepSyncedDays - 1)),
  );
  return [
    for (final sitting in sittings)
      if (sitting.isDirty || (sitting.hasChanted && sitting.day.compareTo(oldest) >= 0)) sitting,
  ];
}
