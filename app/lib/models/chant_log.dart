import 'json.dart';

/// One tap on the counter — one repetition of the mantra.
///
/// [gapMs] is the time since the tap before it, which is what "how long that
/// chant took" means: a repetition has no end of its own, it ends where the
/// next one begins. The very first tap of a sitting has nothing before it, so
/// its gap is 0 and every average leaves it out.
class ChantTapLog {
  const ChantTapLog({
    required this.seq,
    required this.at,
    required this.gapMs,
    this.auto = false,
    this.filler = false,
    this.heard,
  });

  /// 1-based across the whole sitting, not per round. It is the key the
  /// server stores what was heard under.
  final int seq;
  final DateTime at;
  final int gapMs;

  /// Counted by the microphone rather than a thumb.
  final bool auto;

  /// Not a chant the counter saw: a bead added when the reader finished a round
  /// early, to bring the count to its end. It has no gap of its own and no
  /// average is worked out from it.
  final bool filler;

  /// What speech recognition heard for this tap, when word detection was on.
  /// Only held for a sitting still on screen, or fetched back from the server
  /// within its 7-day life.
  final String? heard;

  double get gapSeconds => gapMs / 1000;

  ChantTapLog withHeard(String? text) =>
      ChantTapLog(seq: seq, at: at, gapMs: gapMs, auto: auto, filler: filler, heard: text);

  Json toJson() => {
        'seq': seq,
        'at': at.millisecondsSinceEpoch,
        'gapMs': gapMs,
        'auto': auto,
        'filler': filler,
      };

  factory ChantTapLog.fromJson(Json json) => ChantTapLog(
        seq: asInt(json['seq']),
        at: DateTime.fromMillisecondsSinceEpoch(asInt(json['at'])),
        gapMs: asInt(json['gapMs']),
        auto: asBool(json['auto']),
        filler: asBool(json['filler']),
      );
}

/// One round of the mala.
///
/// Two shapes, one reading. A round chanted on this screen is built from its
/// taps, and its start, end and duration are read off them, so the figures can
/// never disagree with the list they describe. A round that comes back from the
/// server is a [ChantMalaLog.stored]: the server keeps a summary of each round
/// and not its taps (a row per bead is what made the history so large), so it
/// has the figures and no taps.
class ChantMalaLog {
  const ChantMalaLog({
    required this.index,
    required this.taps,
    this.complete = false,
    this.carried = 0,
  })  : _storedBeads = null,
        _storedStartedAt = null,
        _storedEndedAt = null,
        _storedDurationMs = 0,
        _storedAvgGapMs = 0;

  /// A round as the server keeps it: the figures, without the taps.
  const ChantMalaLog.stored({
    required this.index,
    required int beads,
    required this.complete,
    DateTime? startedAt,
    DateTime? endedAt,
    int durationMs = 0,
    int avgGapMs = 0,
  })  : taps = const [],
        carried = 0,
        _storedBeads = beads,
        _storedStartedAt = startedAt,
        _storedEndedAt = endedAt,
        _storedDurationMs = durationMs,
        _storedAvgGapMs = avgGapMs;

  /// 1-based within the sitting.
  final int index;

  /// The taps made on this screen. Empty for a [ChantMalaLog.stored] round.
  final List<ChantTapLog> taps;

  /// All of the round's beads were counted.
  final bool complete;

  /// Beads of this round counted before the screen was opened, when the
  /// sitting carried on from a count left by an earlier one. They have no taps
  /// here, but they are beads of this round all the same.
  final int carried;

  // Set only on a stored round, whose figures are not worked out from taps.
  final int? _storedBeads;
  final DateTime? _storedStartedAt;
  final DateTime? _storedEndedAt;
  final int _storedDurationMs;
  final int _storedAvgGapMs;

  bool get _isStored => _storedBeads != null;

  int get beads => _storedBeads ?? carried + taps.length;

  /// The first and last tap. A round that has not had a tap has neither.
  DateTime? get startedAt =>
      _isStored ? _storedStartedAt : (taps.isEmpty ? null : taps.first.at);
  DateTime? get endedAt => _isStored ? _storedEndedAt : (taps.isEmpty ? null : taps.last.at);

  /// How long the round took. 0 when that is not known: a round with beads
  /// carried over was begun in an earlier sitting, so the time between its
  /// first and last tap here is not the time it took.
  int get durationMs {
    if (_isStored) return _storedDurationMs;
    if (carried > 0 || taps.length < 2) return 0;
    return taps.last.at.difference(taps.first.at).inMilliseconds;
  }

  double get durationSeconds => durationMs / 1000;

  /// Mean gap, leaving out the first tap of the sitting (which has none).
  int get avgGapMs {
    if (_isStored) return _storedAvgGapMs;
    final gaps = taps.where((tap) => tap.gapMs > 0).map((tap) => tap.gapMs).toList();
    if (gaps.isEmpty) return 0;
    return (gaps.reduce((a, b) => a + b) / gaps.length).round();
  }

  /// What is sent to the server: the figures, not the taps.
  Json toJson() => {
        'index': index,
        'complete': complete,
        'beads': beads,
        'startedAt': ?startedAt?.millisecondsSinceEpoch,
        'endedAt': ?endedAt?.millisecondsSinceEpoch,
        'durationMs': durationMs,
        'avgGapMs': avgGapMs,
      };

  factory ChantMalaLog.fromJson(Json json) => ChantMalaLog.stored(
        index: asInt(json['index']),
        complete: asBool(json['complete']),
        beads: asInt(json['beads']),
        startedAt: asDate(json['startedAt']),
        endedAt: asDate(json['endedAt']),
        durationMs: asInt(json['durationMs']),
        avgGapMs: asInt(json['avgGapMs']),
      );
}

/// What speech recognition heard for one tap, waiting to be sent.
class ChantHeard {
  const ChantHeard({
    required this.seq,
    required this.malaIndex,
    required this.text,
    required this.heardAt,
    this.confidence,
    this.locale,
  });

  final int seq;
  final int malaIndex;
  final String text;
  final DateTime heardAt;
  final double? confidence;
  final String? locale;

  Json toJson() => {
        'seq': seq,
        'malaIndex': malaIndex,
        'text': text,
        'heardAt': heardAt.toUtc().toIso8601String(),
        'confidence': ?confidence,
        'locale': ?locale,
      };
}

/// One row of the history list: a past sitting, in brief.
class ChantSessionSummary {
  const ChantSessionSummary({
    required this.id,
    required this.startedAt,
    required this.rounds,
    required this.beads,
    required this.malaCount,
    required this.avgMalaMs,
    this.endedAt,
    this.durationSeconds,
    this.mantraName,
  });

  final String id;
  final DateTime startedAt;
  final DateTime? endedAt;
  final int rounds;

  /// Beads into the round that was in progress when the sitting closed.
  final int beads;
  final int? durationSeconds;
  final String? mantraName;

  /// Rounds with a tap record on the server — 0 for a sitting from before
  /// tap-by-tap recording, which only has [rounds].
  final int malaCount;
  final int avgMalaMs;

  bool get hasDetail => malaCount > 0;

  /// Every repetition, whole rounds plus the part-round left over.
  int beadsTotal(int beadsPerRound) => rounds * beadsPerRound + beads;

  factory ChantSessionSummary.fromJson(Json json) {
    final mantra = asJson(json['mantra']);
    return ChantSessionSummary(
      id: asString(json['id']),
      startedAt: asDate(json['startedAt']) ?? DateTime.now(),
      endedAt: asDate(json['endedAt']),
      rounds: asInt(json['rounds']),
      beads: asInt(json['beads']),
      durationSeconds: asIntOrNull(json['durationSeconds']),
      mantraName: mantra == null ? null : asStringOrNull(mantra['name']),
      malaCount: asInt(json['malaCount']),
      avgMalaMs: asInt(json['avgMalaMs']),
    );
  }
}

/// A past sitting in full: its summary and every round it was chanted in.
class ChantSessionDetail {
  const ChantSessionDetail({required this.summary, required this.malas});

  final ChantSessionSummary summary;
  final List<ChantMalaLog> malas;

  factory ChantSessionDetail.fromJson(Json json) {
    final session = asJson(json['session']) ?? const {};
    return ChantSessionDetail(
      summary: ChantSessionSummary.fromJson(session),
      malas: asList(json['malas'], ChantMalaLog.fromJson),
    );
  }
}

/// The figures read off a set of rounds — what the summary strip and the
/// analytics screen both show, worked out in one place so they cannot
/// disagree.
class ChantStats {
  const ChantStats({
    required this.totalChants,
    required this.malasDone,
    this.avgChantSeconds,
    this.avgMalaSeconds,
    this.fastestMalaSeconds,
  });

  /// Every tap, across finished and unfinished rounds.
  final int totalChants;

  /// Rounds with every bead counted.
  final int malasDone;

  /// Mean time one repetition took. Null until there are two taps.
  final double? avgChantSeconds;

  /// Mean time a finished round took. Null until one has finished.
  final double? avgMalaSeconds;
  final double? fastestMalaSeconds;

  factory ChantStats.of(List<ChantMalaLog> malas) {
    final finished = malas.where((mala) => mala.complete).toList();

    // A round with its taps contributes each of them; a stored one (no taps)
    // contributes its mean, once for each gap it is the mean of.
    var gapTotalMs = 0;
    var gapCount = 0;
    for (final mala in malas) {
      if (mala.taps.isNotEmpty) {
        for (final tap in mala.taps) {
          if (tap.seq > 1 && !tap.filler) {
            gapTotalMs += tap.gapMs;
            gapCount += 1;
          }
        }
      } else if (mala.avgGapMs > 0 && mala.beads > 1) {
        gapTotalMs += mala.avgGapMs * (mala.beads - 1);
        gapCount += mala.beads - 1;
      }
    }

    // A round whose time is not known (see ChantMalaLog.durationMs) is left out
    // of the averages rather than counted as instant.
    final durations = [
      for (final mala in finished)
        if (mala.durationMs > 0) mala.durationMs,
    ];
    final meanDuration =
        durations.isEmpty ? null : durations.reduce((a, b) => a + b) / durations.length / 1000;

    return ChantStats(
      totalChants: malas.fold(0, (sum, mala) => sum + mala.beads),
      malasDone: finished.length,
      avgChantSeconds: gapCount == 0 ? null : gapTotalMs / gapCount / 1000,
      avgMalaSeconds: meanDuration,
      fastestMalaSeconds:
          durations.isEmpty ? null : durations.reduce((a, b) => a < b ? a : b) / 1000,
    );
  }
}
