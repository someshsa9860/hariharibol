/// Counts a chant when the recogniser writes one of a mantra's allowed words.
///
/// The phone's recogniser only knows English, so it writes Sanskrit as the nearest
/// English words; a mantra lists the ones it is known to write ([allowed]). Hearing
/// one counts a chant — but never faster than the mantra's standard chanting time
/// ([standard]): a hit sooner than that after the last count is the same chant
/// being heard again (the mahamantra says "Hare" sixteen times in one repetition)
/// and is dropped, so the count keeps the pace the mantra was given.
///
/// Pure Dart with an injected clock (`test/word_chant_counter_test.dart`).
class WordChantCounter {
  WordChantCounter({
    required Iterable<String> allowed,
    required this.standard,
    DateTime Function()? now,
  })  : assert(standard > Duration.zero),
        _allowed = {for (final word in allowed) ..._words(word)},
        _now = now ?? DateTime.now;

  final Duration standard;
  final Set<String> _allowed;
  final DateTime Function() _now;

  /// How many words of the current stretch have been looked at. The recogniser
  /// revises its running transcript, so only words past this are new.
  int _seen = 0;
  DateTime? _lastCountAt;

  int total = 0;

  bool get hasWords => _allowed.isNotEmpty;

  /// When the last chant was counted, for the "counted" moment on screen.
  DateTime? get lastCountAt => _lastCountAt;

  /// Feeds the recogniser's running transcript. Returns 1 when it counts a chant.
  int onTranscript(String text, {required bool isFinal}) {
    final words = _words(text);
    if (words.length < _seen) _seen = words.length; // it revised itself shorter

    var counted = 0;
    for (var i = _seen; i < words.length; i++) {
      if (counted == 0 && _allowed.contains(words[i]) && _due()) counted = 1;
    }
    _seen = isFinal ? 0 : words.length;

    if (counted > 0) {
      _lastCountAt = _now();
      total += counted;
    }
    return counted;
  }

  bool _due() {
    final last = _lastCountAt;
    return last == null || _now().difference(last) >= standard;
  }

  void reset() {
    _seen = 0;
    _lastCountAt = null;
    total = 0;
  }

  static List<String> _words(String text) =>
      text.toLowerCase().split(RegExp(r'[^a-z]+')).where((w) => w.isNotEmpty).toList();
}
