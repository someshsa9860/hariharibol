/// Where the chants fall on a recording of one whole mala.
///
/// The chanting runs from [start] to [end] — an opening prayer before it is not
/// part of the count, and anything after it is not either — and that stretch is
/// split evenly into [chants], so each chant takes `(end - start) / chants`.
/// A chant is counted when it finishes: the first count lands one chant after
/// [start], the last exactly at [end].
///
/// Pure arithmetic with no player in it, so `test/chant_mala_timing_test.dart`
/// can pin the boundaries down.
class ChantMalaTiming {
  ChantMalaTiming({required this.start, required this.end, required this.chants})
    : assert(chants > 0),
      assert(end > start);

  final Duration start;
  final Duration end;
  final int chants;

  Duration get _span => end - start;

  /// How long one chant takes.
  Duration get perChant => Duration(microseconds: _span.inMicroseconds ~/ chants);

  /// Chants finished by [position]: 0 up to the first one's end, [chants] from
  /// the end of the stretch on.
  int chantsDoneAt(Duration position) {
    if (position <= start) return 0;
    if (position >= end) return chants;
    // Multiplied before dividing, so a chant is never rounded short of its end.
    return (position - start).inMicroseconds * chants ~/ _span.inMicroseconds;
  }
}

/// Turns a stream of playback positions into counts, one per chant that
/// finishes while the recording plays.
///
/// Counting only moves forward through a recording, and only by listening. A
/// seek — the listener's own, through [relocate], or any position that jumps
/// further than [continuousStep] between two readings — re-finds its place in
/// the count and counts nothing, so dragging the slider to the middle does not
/// add fifty chants and dragging back does not take them away. Playing a stretch
/// again counts it again, which is right: it is another time through.
class ChantMalaFollower {
  ChantMalaFollower(this.timing, {required this.continuousStep});

  final ChantMalaTiming timing;
  final Duration continuousStep;

  int _counted = 0;
  Duration _last = Duration.zero;

  /// Chants finished at the last position seen.
  int get counted => _counted;

  /// The chants that finished between the last position and this one.
  int advance(Duration position) {
    final jumped = (position - _last).abs() > continuousStep;
    _last = position;

    final done = timing.chantsDoneAt(position);
    if (jumped) {
      _counted = done;
      return 0;
    }
    // Standing still, or a reading that wobbles back a little, neither counts a
    // chant nor takes one away: when playback comes forward over it again it has
    // already been counted.
    if (done <= _counted) return 0;
    final fresh = done - _counted;
    _counted = done;
    return fresh;
  }

  /// Moves to [position] without counting anything on the way.
  void relocate(Duration position) {
    _last = position;
    _counted = timing.chantsDoneAt(position);
  }
}
