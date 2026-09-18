/// Where the detector currently is in one chanting cycle.
enum AutoChantPhase {
  /// No voice. Nothing is being fed to the keyword spotter.
  idle,

  /// Voice present, watching for the next completed repetition.
  listening,

  /// A repetition was just counted; further detections are debounced until
  /// [MantraRepetitionCounter.cooldown] has passed, so one drawn-out
  /// utterance or a stray re-trigger cannot land as two counts.
  cooldown,
}

/// Turns raw detector events — "is there a voice right now" and "the phrase
/// just fired" — into a repetition count.
///
/// This is the only place in auto-count that decides what counts as one
/// repetition. It knows nothing about audio, models or isolates, which is
/// what makes it possible to test with a scripted sequence of calls rather
/// than a real microphone — see `test/mantra_repetition_counter_test.dart`.
class MantraRepetitionCounter {
  MantraRepetitionCounter({
    required this.cooldown,
    this.detectionsPerRepetition = 1,
    DateTime Function()? now,
  })  : assert(detectionsPerRepetition > 0),
        _now = now ?? DateTime.now;

  /// Minimum time between two counted repetitions. Chanting faster than this
  /// is still heard — it just cannot land two counts inside the window.
  final Duration cooldown;

  /// How many detector firings make up one repetition. 1 for a mantra spotted
  /// whole; more than 1 for a mantra counted by a shorter, more reliable cue
  /// that recurs a fixed number of times inside it — see `AutoChantConfig`'s
  /// mahamantra entry.
  final int detectionsPerRepetition;

  final DateTime Function() _now;

  bool _voiceActive = false;
  DateTime? _lastCountAt;
  int _pending = 0;

  int count = 0;

  /// Derived, never stored, so there is no separate flag that can drift out
  /// of sync with the voice/cooldown state it describes.
  AutoChantPhase get phase {
    if (!_voiceActive) return AutoChantPhase.idle;
    final last = _lastCountAt;
    if (last != null && _now().difference(last) < cooldown) {
      return AutoChantPhase.cooldown;
    }
    return AutoChantPhase.listening;
  }

  /// Feed the detector's voice-activity signal. A drop to silence clears any
  /// partial phrase — a chant interrupted mid-word does not carry a pending
  /// count into the next attempt.
  void onVoiceActive(bool active) {
    _voiceActive = active;
    if (!active) _pending = 0;
  }

  /// The keyword spotter fired. Returns `true` exactly when this firing
  /// completed a repetition — the caller's cue to bump the visible count.
  bool onKeywordDetected() {
    if (!_voiceActive) return false; // a stale event arriving after silence

    final now = _now();
    final last = _lastCountAt;
    if (last != null && now.difference(last) < cooldown) return false;

    _pending += 1;
    if (_pending < detectionsPerRepetition) return false;

    _pending = 0;
    _lastCountAt = now;
    count += 1;
    return true;
  }

  /// Back to a clean slate — used when a session (re)starts.
  void reset() {
    _voiceActive = false;
    _lastCountAt = null;
    _pending = 0;
    count = 0;
  }
}
