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
    this.heard,
  });

  /// 1-based across the whole sitting, not per round. It is the key the
  /// server stores what was heard under.
  final int seq;
  final DateTime at;
  final int gapMs;

  /// Counted by the microphone rather than a thumb.
  final bool auto;

  /// What speech recognition heard for this tap, when word detection was on.
  /// Only held for a sitting still on screen, or fetched back from the server
  /// within its 7-day life.
  final String? heard;

  double get gapSeconds => gapMs / 1000;

  ChantTapLog withHeard(String? text) =>
      ChantTapLog(seq: seq, at: at, gapMs: gapMs, auto: auto, heard: text);

  Json toJson() => {
        'seq': seq,
        'at': at.millisecondsSinceEpoch,
        'gapMs': gapMs,
        'auto': auto,
      };

  factory ChantTapLog.fromJson(Json json) => ChantTapLog(
        seq: asInt(json['seq']),
        at: DateTime.fromMillisecondsSinceEpoch(asInt(json['at'])),
        gapMs: asInt(json['gapMs']),
        auto: asBool(json['auto']),
      );
}

/// One round of the mala: its taps, and everything that follows from them.
///
/// Nothing here is stored beside the taps — start, end and duration are read
/// off them, so the three can never disagree with the list they describe.
class ChantMalaLog {
  const ChantMalaLog({required this.index, required this.taps, this.complete = false});

  /// 1-based within the sitting.
  final int index;
  final List<ChantTapLog> taps;

  /// All of the round's beads were counted.
  final bool complete;

  int get beads => taps.length;

  /// The first and last tap. A round that has not had a tap has neither.
  DateTime? get startedAt => taps.isEmpty ? null : taps.first.at;
  DateTime? get endedAt => taps.isEmpty ? null : taps.last.at;

  int get durationMs =>
      taps.length < 2 ? 0 : taps.last.at.difference(taps.first.at).inMilliseconds;

  double get durationSeconds => durationMs / 1000;

  /// Mean gap, leaving out the first tap of the sitting (which has none).
  int get avgGapMs {
    final gaps = taps.where((tap) => tap.gapMs > 0).map((tap) => tap.gapMs).toList();
    if (gaps.isEmpty) return 0;
    return (gaps.reduce((a, b) => a + b) / gaps.length).round();
  }

  /// How many taps have words attached — what the "heard" badge counts.
  int get heardCount => taps.where((tap) => tap.heard != null).length;

  ChantMalaLog withTaps(List<ChantTapLog> next) =>
      ChantMalaLog(index: index, taps: next, complete: complete);

  Json toJson() => {
        'index': index,
        'complete': complete,
        'taps': taps.map((tap) => tap.toJson()).toList(),
      };

  factory ChantMalaLog.fromJson(Json json) => ChantMalaLog(
        index: asInt(json['index']),
        complete: asBool(json['complete']),
        taps: asList(json['taps'], ChantTapLog.fromJson),
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

/// A past sitting in full: its summary, every round with its taps, and the
/// words heard for them while those are still within their 7 days.
class ChantSessionDetail {
  const ChantSessionDetail({required this.summary, required this.malas});

  final ChantSessionSummary summary;
  final List<ChantMalaLog> malas;

  factory ChantSessionDetail.fromJson(Json json) {
    final session = asJson(json['session']) ?? const {};
    final heard = <int, String>{};
    for (final row in json['transcripts'] is List ? json['transcripts'] as List : const []) {
      final item = asJson(row);
      if (item == null) continue;
      final text = asStringOrNull(item['text']);
      if (text != null) heard[asInt(item['seq'])] = text;
    }

    final malas = asList(json['malas'], ChantMalaLog.fromJson)
        .map(
          (mala) => mala.withTaps([
            for (final tap in mala.taps) tap.withHeard(heard[tap.seq]),
          ]),
        )
        .toList();

    return ChantSessionDetail(summary: ChantSessionSummary.fromJson(session), malas: malas);
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
    final gaps = [
      for (final mala in malas)
        for (final tap in mala.taps)
          if (tap.seq > 1) tap.gapMs,
    ];

    double? mean(List<int> values) =>
        values.isEmpty ? null : values.reduce((a, b) => a + b) / values.length / 1000;

    final durations = finished.map((mala) => mala.durationMs).toList();

    return ChantStats(
      totalChants: malas.fold(0, (sum, mala) => sum + mala.beads),
      malasDone: finished.length,
      avgChantSeconds: mean(gaps),
      avgMalaSeconds: mean(durations),
      fastestMalaSeconds:
          durations.isEmpty ? null : durations.reduce((a, b) => a < b ? a : b) / 1000,
    );
  }
}
