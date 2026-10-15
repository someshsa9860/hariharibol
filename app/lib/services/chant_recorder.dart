import '../models/chant_log.dart';

/// The tap-by-tap record of one sitting.
///
/// Every tap is stamped as it lands, and a round is simply the next
/// `beadsPerRound` taps — so which round a tap belongs to, and whether a round
/// is finished, is arithmetic on the tap count rather than state that can fall
/// out of step with it.
///
/// A sitting can carry on from a count left by an earlier one ([carry]): those
/// beads have no taps here, and are counted ahead of the first one.
///
/// Pure Dart with an injectable clock: the counter screen wires it up, and
/// `test/chant_recorder_test.dart` drives it with a scripted clock.
class ChantRecorder {
  ChantRecorder({required this.beadsPerRound, DateTime Function()? now})
      : assert(beadsPerRound > 0),
        _now = now ?? DateTime.now;

  final int beadsPerRound;
  final DateTime Function() _now;

  final List<ChantTapLog> _taps = [];

  /// Beads counted before the first tap here; see [carry].
  int _carried = 0;

  /// When chanting was last begun afresh — after the opening prayer, which is
  /// not a chant. The next chant is timed from here if that is later than the
  /// last tap, since the prayer in between is not part of any chant.
  DateTime? _beganAt;

  /// Rounds whose taps have changed since they were last sent.
  final Set<int> _dirty = {};

  final List<ChantHeard> _unsentHeard = [];

  int get tapCount => _taps.length;

  int get _counted => _carried + _taps.length;

  /// Rounds finished — the "malas done" figure.
  int get completedMalas => _counted ~/ beadsPerRound;

  /// The round being chanted now, 1-based.
  int get currentMala => completedMalas + 1;

  /// Beads into the current round; 0 right after one completes.
  int get beadsInMala => _counted % beadsPerRound;

  /// Picks up a round left part-way by an earlier sitting: [beads] are already
  /// counted, and the next tap is the one after them. Only before the first
  /// tap, and never a whole round (that one is finished, not carried).
  void carry(int beads) {
    assert(_taps.isEmpty, 'carry() is for the start of a sitting');
    if (_taps.isNotEmpty) return;
    _carried = beads.clamp(0, beadsPerRound - 1);
  }

  /// Chanting begins afresh now: the opening prayer is over, and the chant
  /// after it is timed from here rather than from the round before.
  void beginChanting() => _beganAt = _now();

  List<ChantTapLog> get taps => List.unmodifiable(_taps);

  ChantTapLog? get lastTap => _taps.isEmpty ? null : _taps.last;

  int malaOf(int seq) => (seq - 1 + _carried) ~/ beadsPerRound + 1;

  /// What the next chant is timed from: the last tap, or the moment chanting
  /// began afresh if that came after it. Null at the very start of a sitting.
  DateTime? get _timedFrom {
    final previous = lastTap?.at;
    final began = _beganAt;
    if (previous == null) return began;
    return began != null && began.isAfter(previous) ? began : previous;
  }

  /// Whether a tap now is at least [minGap] after the last one (and so is not
  /// a tap with no chanting behind it). Always true for the first tap of a
  /// sitting. Reads the tap log, so taking a tap back makes room for the next.
  bool tapAllowed(Duration minGap) {
    final from = _timedFrom;
    return from == null || _now().difference(from) >= minGap;
  }

  /// Counts one repetition now. [auto] marks one the microphone counted.
  ChantTapLog tap({bool auto = false}) {
    final at = _now();
    final from = _timedFrom;
    final tap = ChantTapLog(
      seq: _taps.length + 1,
      at: at,
      gapMs: from == null ? 0 : at.difference(from).inMilliseconds,
      auto: auto,
    );
    _taps.add(tap);
    _dirty.add(malaOf(tap.seq));
    return tap;
  }

  /// Takes back the last tap, but only within the current round — a finished
  /// round stays finished, as it does on the ring.
  bool undo() {
    if (beadsInMala == 0) return false;
    // Only carried beads left: the last one counted is one of those.
    if (_taps.isEmpty) {
      _carried -= 1;
      return true;
    }
    final removed = _taps.removeLast();
    _dirty.add(malaOf(removed.seq));
    _unsentHeard.removeWhere((heard) => heard.seq == removed.seq);
    return true;
  }

  /// Every round with at least one bead, in order.
  List<ChantMalaLog> get malas {
    final total = _counted;
    final result = <ChantMalaLog>[];
    for (var start = 0; start < total; start += beadsPerRound) {
      final end = start + beadsPerRound < total ? start + beadsPerRound : total;
      // Beads are numbered from the carried ones, so the taps of this round
      // are the ones after the carried beads that fall inside it.
      final from = start > _carried ? start - _carried : 0;
      final to = end - _carried;
      result.add(
        ChantMalaLog(
          index: start ~/ beadsPerRound + 1,
          taps: to > from ? _taps.sublist(from, to) : const [],
          complete: end - start == beadsPerRound,
          carried: start < _carried ? (end < _carried ? end : _carried) - start : 0,
        ),
      );
    }
    return result;
  }

  ChantMalaLog? get currentMalaLog {
    final all = malas;
    if (all.isEmpty || all.last.complete) return null;
    return all.last;
  }

  /// Time into the current round — from its first tap to now. 0 until the
  /// round has a tap.
  Duration get currentMalaElapsed {
    final log = currentMalaLog;
    final start = log?.startedAt;
    return start == null ? Duration.zero : _now().difference(start);
  }

  /// The summary figures for the sitting so far.
  ChantStats get stats => ChantStats.of(malas);

  /// Attaches words to a tap that is already on the record.
  void attachHeard(ChantHeard heard) {
    final i = _taps.indexWhere((tap) => tap.seq == heard.seq);
    if (i < 0) return;
    _taps[i] = _taps[i].withHeard(heard.text);
    _unsentHeard.removeWhere((item) => item.seq == heard.seq);
    _unsentHeard.add(heard);
  }

  // ── What still has to reach the server ─────────────────────────────────────

  bool get hasUnsent => _dirty.isNotEmpty || _unsentHeard.isNotEmpty;

  /// The rounds changed since the last call, handed over to be sent. Pair
  /// with [restoreUnsent] if the send fails.
  List<ChantMalaLog> takeDirtyMalas() {
    final wanted = Set<int>.of(_dirty);
    _dirty.clear();
    // A round with no tap here has no time to report: carried beads alone are
    // already on the server, under the sitting they were counted in.
    return malas.where((mala) => wanted.contains(mala.index) && mala.taps.isNotEmpty).toList();
  }

  List<ChantHeard> takeUnsentHeard() {
    final items = List<ChantHeard>.of(_unsentHeard);
    _unsentHeard.clear();
    return items;
  }

  /// Puts back what a failed send took, so the next one carries it.
  void restoreUnsent({List<ChantMalaLog> malas = const [], List<ChantHeard> heard = const []}) {
    _dirty.addAll(malas.map((mala) => mala.index));
    for (final item in heard) {
      // A newer attachment for the same tap, made while the send was in
      // flight, wins over the one being put back.
      if (_unsentHeard.every((existing) => existing.seq != item.seq)) _unsentHeard.add(item);
    }
  }
}
