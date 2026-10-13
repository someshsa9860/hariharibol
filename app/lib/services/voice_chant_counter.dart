import 'mantra_repetition_counter.dart' show AutoChantPhase;

/// Counts chants from nothing but "is someone making sound right now".
///
/// Every mantra has a standard time for one chant. While there is sound, one
/// chant is counted for each standard time that passes; when the sound stops the
/// counting stops, and when it comes back it starts again. No words are
/// recognised — the voice detector is the only input, which is why this works
/// for Sanskrit as well as for anything else.
///
/// Pure Dart with an injected clock, so a test drives it with a scripted
/// sequence of calls rather than a microphone (`test/voice_chant_counter_test.dart`).
class VoiceChantCounter {
  VoiceChantCounter({
    required this.standard,
    this.lead = Duration.zero,
    this.tail = Duration.zero,
    this.partialShare = 0.6,
    this.countedFor = const Duration(milliseconds: 900),
    DateTime Function()? now,
  })  : assert(standard > Duration.zero),
        _now = now ?? DateTime.now;

  /// How long one chant takes at an ordinary pace.
  final Duration standard;

  /// The voice detector reports sound this long after it began (it wants a
  /// moment of it first), so a stretch is taken to have begun this much earlier.
  final Duration lead;

  /// ...and reports silence this long after it ended, which is not chanting.
  final Duration tail;

  /// When a stretch of sound ends, a last, unfinished chant still counts if at
  /// least this share of [standard] was chanted — a short mantra said once and
  /// stopped is one chant, not none.
  final double partialShare;

  /// How long [phase] reads "counted" after a chant.
  final Duration countedFor;

  final DateTime Function() _now;

  bool _active = false;
  DateTime? _since;
  int _counted = 0;
  DateTime? _lastCountAt;

  /// Chants counted since [reset].
  int total = 0;

  AutoChantPhase get phase {
    if (!_active) return AutoChantPhase.idle;
    final last = _lastCountAt;
    if (last != null && _now().difference(last) < countedFor) return AutoChantPhase.cooldown;
    return AutoChantPhase.listening;
  }

  /// The voice detector's edge. Returns the chants this settles: a stretch that
  /// has just ended may owe one more (see [partialShare]).
  int onVoice(bool active) {
    if (active == _active) return 0;
    final now = _now();
    _active = active;

    if (active) {
      _since = now.subtract(lead);
      _counted = 0;
      return 0;
    }

    final since = _since;
    _since = null;
    if (since == null) return 0;
    var effective = now.difference(since) - tail;
    if (effective < Duration.zero) effective = Duration.zero;

    var chants = effective.inMicroseconds ~/ standard.inMicroseconds;
    final rest = effective.inMicroseconds - chants * standard.inMicroseconds;
    if (rest >= standard.inMicroseconds * partialShare) chants += 1;
    return _add(chants - _counted, now);
  }

  /// Call often (every ~100 ms) while the app is listening. Returns the chants
  /// that have become due since the last call — several, if it was called late.
  int tick() {
    final since = _since;
    if (!_active || since == null) return 0;
    final now = _now();
    final due = now.difference(since).inMicroseconds ~/ standard.inMicroseconds;
    return _add(due - _counted, now);
  }

  int _add(int chants, DateTime now) {
    if (chants <= 0) return 0;
    _counted += chants;
    total += chants;
    _lastCountAt = now;
    return chants;
  }

  /// A chant was counted elsewhere (by a heard word): let the phase say so.
  void noteCounted() => _lastCountAt = _now();

  void reset() {
    _active = false;
    _since = null;
    _counted = 0;
    _lastCountAt = null;
    total = 0;
  }
}
