import 'dart:math' as math;

import 'mantra_repetition_counter.dart' show AutoChantPhase;

/// Counts chants from nothing but "is someone making sound right now".
///
/// Every mantra has a standard time for one chant. While there is sound, one
/// chant is counted for each standard time that passes; when the sound stops the
/// counting stops, and when it comes back it starts again. No words are
/// recognised — the voice detector is the only input, which is why this works
/// for Sanskrit as well as for anything else.
///
/// A chanter gets quicker as a sitting goes on, so the time a chant is taken to
/// last shrinks by [speedUpPerChant] with each one counted, down to
/// [fastestShare] of [standard]. The pace belongs to the sitting, not to one
/// stretch of sound: it is kept through silences and through [reset].
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
    this.speedUpPerChant = 0,
    this.fastestShare = 1,
    DateTime Function()? now,
  })  : assert(standard > Duration.zero),
        assert(speedUpPerChant >= 0 && speedUpPerChant < 1),
        assert(fastestShare > 0 && fastestShare <= 1),
        _now = now ?? DateTime.now;

  /// How long the first chant of a sitting takes at an ordinary pace.
  final Duration standard;

  /// The share of its time each chant takes off the next one: 0.01 makes every
  /// chant 1% quicker than the one before. 0 keeps every chant [standard].
  final double speedUpPerChant;

  /// The quickest a chant is ever taken to be, as a share of [standard], so a
  /// long sitting is not counted faster than anyone can chant.
  final double fastestShare;

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

  /// Chants counted in the sitting so far — what the pace is read from. Unlike
  /// [total] it survives [reset], which is also what switching auto count off
  /// and on calls.
  int _sitting = 0;

  /// [_sitting] when the current stretch of sound began, so every chant in the
  /// stretch is timed from the pace it began at.
  int _stretchBase = 0;

  /// Chants counted since [reset].
  int total = 0;

  /// How long the [index]th chant of the sitting (from 0) is taken to last.
  Duration standardAt(int index) {
    if (speedUpPerChant <= 0) return standard;
    final share = math.pow(1 - speedUpPerChant, index).toDouble();
    return standard * (share < fastestShare ? fastestShare : share);
  }

  /// How long the next chant is taken to last.
  Duration get currentStandard => standardAt(_sitting);

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
      _stretchBase = _sitting;
      return 0;
    }

    final since = _since;
    _since = null;
    if (since == null) return 0;
    var effective = now.difference(since) - tail;
    if (effective < Duration.zero) effective = Duration.zero;

    final settled = _settle(effective);
    var chants = settled.chants;
    if (settled.rest >= settled.next * partialShare) chants += 1;
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

  /// The whole chants [elapsed] of sound in this stretch makes, each taking the
  /// time its place in the sitting calls for; what is left over; and how long
  /// the chant that leftover is a part of takes.
  ({int chants, Duration rest, Duration next}) _settle(Duration elapsed) {
    var rest = elapsed;
    var chants = 0;
    while (true) {
      final next = standardAt(_stretchBase + chants);
      if (rest < next) return (chants: chants, rest: rest, next: next);
      rest -= next;
      chants += 1;
    }
  }

  int _add(int chants, DateTime now) {
    if (chants <= 0) return 0;
    _counted += chants;
    _sitting += chants;
    total += chants;
    _lastCountAt = now;
    return chants;
  }

  /// Forgets the count and any sound in progress. The pace the sitting has
  /// reached is kept — coming back to the screen does not make a chanter slow.
  void reset() {
    _active = false;
    _since = null;
    _counted = 0;
    _stretchBase = _sitting;
    _lastCountAt = null;
    total = 0;
  }
}
