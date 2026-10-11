import 'package:flutter/foundation.dart';

import '../core/constants/auto_chant_config.dart';

/// One stretch of voice once it has ended: what the recogniser wrote and how it
/// fared against the mantra.
class HeardUtterance {
  const HeardUtterance({
    required this.text,
    required this.at,
    this.counted = 0,
    this.match,
    this.needed,
  });

  final String text;
  final DateTime at;

  /// Repetitions this stretch of voice added to the count.
  final int counted;

  /// How near the best part of it came to the mantra, 0–1, and what it had to
  /// reach to count. Both null when nothing was compared (word detection only
  /// writes the words down).
  final double? match;
  final double? needed;
}

/// What the microphone is hearing right now and the last few things it heard —
/// the one object the "Heard live" card on the counter watches.
///
/// Fed by auto-count (which also knows how near each stretch came to the
/// mantra) or by word detection (which only has the words). Pure Dart, no
/// audio: `test/heard_words_test.dart`.
class HeardWords extends ChangeNotifier {
  HeardWords({DateTime Function()? now}) : _now = now ?? DateTime.now;

  final DateTime Function() _now;

  bool _voice = false;
  bool _disposed = false;

  /// The running transcript of the stretch of voice still going.
  String _live = '';
  int _liveCounted = 0;
  double? _liveMatch;
  double? _liveNeeded;

  /// Newest first.
  final List<HeardUtterance> _recent = [];

  /// Whether the voice detector hears a voice at this moment. Word detection
  /// has no such detector, so a screen should also treat [live] as "hearing".
  bool get voiceActive => _voice;

  /// What is being said now, trimmed to its last [AutoChantConfig.heardLiveWords]
  /// words; empty between stretches of voice.
  String get live {
    final words = _live.split(RegExp(r'\s+'));
    if (words.length <= AutoChantConfig.heardLiveWords) return _live;
    return words.sublist(words.length - AutoChantConfig.heardLiveWords).join(' ');
  }

  /// What the running stretch has added to the count so far, and the best match
  /// seen within it.
  int get liveCounted => _liveCounted;
  double? get liveMatch => _liveMatch;
  double? get liveNeeded => _liveNeeded;

  /// Finished stretches of voice, newest first, at most [AutoChantConfig.heardKept].
  List<HeardUtterance> get recent => List.unmodifiable(_recent);

  HeardUtterance? get latest => _recent.isEmpty ? null : _recent.first;

  void voice(bool active) {
    if (_voice == active) return;
    _voice = active;
    _notify();
  }

  /// One transcript from the recogniser: the running text of the current stretch
  /// of voice, or its final text once the voice has stopped. [counted] is what
  /// *this* update added to the count; [match] and [needed] say how near the
  /// not-yet-counted text comes to the mantra.
  void hear(String text, {required bool isFinal, int counted = 0, double? match, double? needed}) {
    _liveCounted += counted;
    if (match != null && (_liveMatch == null || match > _liveMatch!)) {
      _liveMatch = match;
      _liveNeeded = needed;
    }

    if (isFinal) {
      final finished = text.trim();
      if (finished.isNotEmpty) {
        _recent.insert(
          0,
          HeardUtterance(
            text: finished,
            at: _now(),
            counted: _liveCounted,
            match: _liveMatch,
            needed: _liveNeeded,
          ),
        );
        if (_recent.length > AutoChantConfig.heardKept) _recent.removeLast();
      }
      _endLive();
    } else {
      _live = text.trim();
    }
    _notify();
  }

  /// A fresh start — a switch turned on again does not show the last sitting's
  /// words.
  void clear() {
    _recent.clear();
    _endLive();
    _voice = false;
    _notify();
  }

  void _endLive() {
    _live = '';
    _liveCounted = 0;
    _liveMatch = null;
    _liveNeeded = null;
  }

  // A stream can deliver one last event after the screen has gone.
  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
