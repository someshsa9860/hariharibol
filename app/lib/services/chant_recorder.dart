import '../models/chant_log.dart';

/// The tap-by-tap record of one sitting.
///
/// Every tap is stamped as it lands, and a round is simply the next
/// `beadsPerRound` taps — so which round a tap belongs to, and whether a round
/// is finished, is arithmetic on the tap count rather than state that can fall
/// out of step with it.
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

  /// Rounds whose taps have changed since they were last sent.
  final Set<int> _dirty = {};

  final List<ChantHeard> _unsentHeard = [];

  int get tapCount => _taps.length;

  /// Rounds finished — the "malas done" figure.
  int get completedMalas => _taps.length ~/ beadsPerRound;

  /// The round being chanted now, 1-based.
  int get currentMala => completedMalas + 1;

  /// Beads into the current round; 0 right after one completes.
  int get beadsInMala => _taps.length % beadsPerRound;

  List<ChantTapLog> get taps => List.unmodifiable(_taps);

  ChantTapLog? get lastTap => _taps.isEmpty ? null : _taps.last;

  int malaOf(int seq) => (seq - 1) ~/ beadsPerRound + 1;

  /// Counts one repetition now. [auto] marks one the microphone counted.
  ChantTapLog tap({bool auto = false}) {
    final at = _now();
    final previous = lastTap;
    final tap = ChantTapLog(
      seq: _taps.length + 1,
      at: at,
      gapMs: previous == null ? 0 : at.difference(previous.at).inMilliseconds,
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
    final removed = _taps.removeLast();
    _dirty.add(malaOf(removed.seq));
    _unsentHeard.removeWhere((heard) => heard.seq == removed.seq);
    return true;
  }

  /// Every round with at least one tap, in order.
  List<ChantMalaLog> get malas {
    final result = <ChantMalaLog>[];
    for (var start = 0; start < _taps.length; start += beadsPerRound) {
      final end = start + beadsPerRound < _taps.length ? start + beadsPerRound : _taps.length;
      result.add(
        ChantMalaLog(
          index: start ~/ beadsPerRound + 1,
          taps: _taps.sublist(start, end),
          complete: end - start == beadsPerRound,
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
    return malas.where((mala) => wanted.contains(mala.index)).toList();
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
