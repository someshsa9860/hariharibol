import 'mantra_repetition_counter.dart' show AutoChantPhase;

/// Counts chants from nothing but "is someone making sound right now" — or, with
/// [startSteady], from the clock alone.
///
/// A chant takes [pace]. While there is sound, one chant is counted for each
/// [pace] that passes; when the sound stops the counting stops, and when it comes
/// back it starts again. No words are recognised — the voice detector is the only
/// input, which is why this works for Sanskrit as well as for anything else.
///
/// [pace] is the reader's: the mantra's standard time to begin with, then what
/// they set or what their own rounds showed (`ChantPace`). It can change while
/// counting ([changePace]) without losing or inventing a chant.
///
/// Pure Dart with an injected clock, so a test drives it with a scripted
/// sequence of calls rather than a microphone (`test/voice_chant_counter_test.dart`).
class VoiceChantCounter {
  VoiceChantCounter({
    required Duration pace,
    this.lead = Duration.zero,
    this.tail = Duration.zero,
    this.partialShare = 0.6,
    this.countedFor = const Duration(milliseconds: 900),
    DateTime Function()? now,
  })  : assert(pace > Duration.zero),
        _pace = pace,
        _now = now ?? DateTime.now;

  /// The voice detector reports sound this long after it began (it wants a
  /// moment of it first), so a stretch is taken to have begun this much earlier.
  final Duration lead;

  /// ...and reports silence this long after it ended, which is not chanting.
  final Duration tail;

  /// When a stretch of sound ends, a last, unfinished chant still counts if at
  /// least this share of [pace] was chanted — a short mantra said once and
  /// stopped is one chant, not none.
  final double partialShare;

  /// How long [phase] reads "counted" after a chant.
  final Duration countedFor;

  final DateTime Function() _now;

  Duration _pace;

  bool _active = false;
  DateTime? _since;
  int _counted = 0;
  DateTime? _lastCountAt;

  /// Chants counted since [reset].
  int total = 0;

  /// How long one chant is taken to last.
  Duration get pace => _pace;

  AutoChantPhase get phase {
    if (!_active) return AutoChantPhase.idle;
    final last = _lastCountAt;
    if (last != null && _now().difference(last) < countedFor) return AutoChantPhase.cooldown;
    return AutoChantPhase.listening;
  }

  /// Counts by the clock alone: sound is taken to begin now and not to stop until
  /// [reset] — for counting with no microphone. [lead] does not apply, there being
  /// no detector to wait for.
  void startSteady() {
    if (_active) return;
    _active = true;
    _since = _now();
    _counted = 0;
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

    final settled = _settle(effective);
    var chants = settled.chants;
    if (settled.rest >= _pace * partialShare) chants += 1;
    return _add(chants - _counted, now);
  }

  /// Call often (every ~100 ms) while the app is listening. Returns the chants
  /// that have become due since the last call — several, if it was called late.
  int tick() {
    final since = _since;
    if (!_active || since == null) return 0;
    final now = _now();
    final due = _settle(now.difference(since)).chants;
    return _add(due - _counted, now);
  }

  /// Takes [pace] as the time of one chant from now on, and returns the chants
  /// the old pace had made due. What has been chanted towards the next chant is
  /// kept: it is only measured against the new pace, so changing the pace never
  /// stalls the count (a slower pace set after a long stretch) nor makes it jump
  /// (a quicker one).
  int changePace(Duration pace) {
    assert(pace > Duration.zero);
    final due = tick();
    final since = _since;
    if (_active && since != null) {
      final now = _now();
      var rest = now.difference(since) - _pace * _counted;
      if (rest < Duration.zero) rest = Duration.zero;
      _since = now.subtract(rest);
      _counted = 0;
    }
    _pace = pace;
    return due;
  }

  /// The whole chants [elapsed] of sound in this stretch makes, and what is left
  /// over.
  ({int chants, Duration rest}) _settle(Duration elapsed) {
    final chants = elapsed.inMicroseconds ~/ _pace.inMicroseconds;
    return (chants: chants, rest: elapsed - _pace * chants);
  }

  int _add(int chants, DateTime now) {
    if (chants <= 0) return 0;
    _counted += chants;
    total += chants;
    _lastCountAt = now;
    return chants;
  }

  /// Forgets the count and any sound in progress. The pace is kept.
  void reset() {
    _active = false;
    _since = null;
    _counted = 0;
    _lastCountAt = null;
    total = 0;
  }
}
