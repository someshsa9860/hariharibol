import 'dart:typed_data';

import '../core/constants/auto_chant_config.dart';

/// Counts how many times a mantra was chanted in a running transcript, by
/// ear rather than by exact words.
///
/// The recogniser is trained on English, so it writes Sanskrit down loosely —
/// "Hari" for "Hare", a dropped syllable when the chant is fast. Both sides are
/// therefore *folded* to a rough sound (see [fold]) and compared with an edit
/// distance. A repetition is credited when a stretch of the transcript matches
/// one of the mantra's phrases by at least [AutoChantConfig.matchThreshold];
/// the next starts where that one ended, so fast back-to-back chanting counts
/// each time through. Pure Dart, no audio — `test/mantra_phrase_matcher_test.dart`.
class MantraPhraseMatcher {
  MantraPhraseMatcher(List<String> phrases)
      : _targets = [
          for (final phrase in phrases)
            if (fold(phrase).isNotEmpty) fold(phrase),
        ];

  final List<String> _targets;

  /// How much of the current transcript earlier repetitions have used up.
  int _consumed = 0;

  bool get hasPhrases => _targets.isNotEmpty;

  /// The phrases as they are compared, spellings folded — what the log shows,
  /// so a mismatch can be read against what the recogniser wrote.
  List<String> get foldedPhrases => List.unmodifiable(_targets);

  /// Repetitions newly completed by [transcript], the running text of the
  /// current utterance (revised as more is heard). [isFinal] once the voice has
  /// stopped, when whatever matches is counted; call [reset] after it.
  int update(String transcript, {bool isFinal = false}) {
    if (_targets.isEmpty) return 0;
    final heard = fold(transcript);
    if (_consumed > heard.length) _consumed = heard.length;

    var completed = 0;
    while (true) {
      final rest = heard.substring(_consumed);
      _Match? best;
      for (final target in _targets) {
        final match = _match(target, rest);
        if (match != null && (best == null || match.ratio > best.ratio)) best = match;
      }
      if (best == null) break;
      final trailing = heard.length - _consumed - best.end;
      final settled = isFinal ||
          best.ratio >= AutoChantConfig.strongMatch ||
          trailing >= AutoChantConfig.settleTrailing * best.length;
      if (!settled) break;
      completed += 1;
      _consumed += best.end;
    }
    return completed;
  }

  /// The utterance ended; the next transcript starts from nothing.
  void reset() => _consumed = 0;

  /// What a phrase has to match by, by its folded length: the floor for a
  /// normal mantra, higher for one so short that half is easy to reach.
  static double needed(int letters) {
    final shortBy =
        letters >= AutoChantConfig.shortPhraseLetters ? 0 : AutoChantConfig.shortPhraseLetters - letters;
    return AutoChantConfig.matchThreshold +
        AutoChantConfig.shortPhraseExtra * shortBy / AutoChantConfig.shortPhraseLetters;
  }

  /// How near the not-yet-counted part of [transcript] comes to the mantra, for
  /// the log: the best score over every phrase and what that phrase needed.
  /// Changes nothing — a score below `needed` is exactly why nothing was counted.
  ({double ratio, double needed})? closest(String transcript) {
    if (_targets.isEmpty) return null;
    final heard = fold(transcript);
    if (heard.length <= _consumed) return null;
    final rest = heard.substring(_consumed);
    ({double ratio, double needed})? best;
    for (final target in _targets) {
      final ratio = _bestRatio(target, rest);
      if (best == null || ratio > best.ratio) best = (ratio: ratio, needed: needed(target.length));
    }
    return best;
  }

  /// The last row of the edit-distance table of [target] against [text] (free
  /// start, free end): entry `j` is the fewest edits to make [target] out of a
  /// stretch of [text] that ends at `j`.
  static Int32List _lastRow(String target, String text) {
    final n = target.length;
    final m = text.length;
    var prev = Int32List(m + 1); // row 0: a match may start anywhere, at no cost
    var cur = Int32List(m + 1);
    for (var i = 1; i <= n; i++) {
      cur[0] = i;
      final ti = target.codeUnitAt(i - 1);
      for (var j = 1; j <= m; j++) {
        final substitute = prev[j - 1] + (ti == text.codeUnitAt(j - 1) ? 0 : 1);
        final skipTarget = prev[j] + 1;
        final skipText = cur[j - 1] + 1;
        var cost = substitute < skipTarget ? substitute : skipTarget;
        if (skipText < cost) cost = skipText;
        cur[j] = cost;
      }
      final swap = prev;
      prev = cur;
      cur = swap;
    }
    return prev;
  }

  static double _bestRatio(String target, String text) {
    if (text.isEmpty) return 0;
    final row = _lastRow(target, text);
    var lowest = row[0];
    for (var j = 1; j < row.length; j++) {
      if (row[j] < lowest) lowest = row[j];
    }
    return (target.length - lowest) / target.length;
  }

  /// Best approximate match of [target] anywhere in [text] (free start, free
  /// end). Returns where the earliest good-enough one ends, or null when none
  /// reaches [needed].
  static _Match? _match(String target, String text) {
    final n = target.length;
    final m = text.length;
    if (m == 0) return null;

    final prev = _lastRow(target, text);
    var lowest = prev[0];
    for (var j = 1; j <= m; j++) {
      if (prev[j] < lowest) lowest = prev[j];
    }
    final floor = needed(n);
    final bestRatio = (n - lowest) / n;
    if (bestRatio < floor) return null;

    final cutoff = bestRatio - AutoChantConfig.matchSlack > floor ? bestRatio - AutoChantConfig.matchSlack : floor;
    for (var j = 1; j <= m; j++) {
      final ratio = (n - prev[j]) / n;
      if (ratio >= cutoff) return _Match(ratio, j, n);
    }
    return null;
  }

  static const _digraphs = {
    'SH': 'S',
    'CH': 'C',
    'PH': 'F',
    'TH': 'T',
    'DH': 'D',
    'BH': 'B',
    'KH': 'K',
    'GH': 'G',
    'JH': 'J',
  };

  static const _diacritics = {
    'Ā': 'A', 'ā': 'A', 'Ī': 'I', 'ī': 'I', 'Ū': 'U', 'ū': 'U',
    'Ṛ': 'R', 'ṛ': 'R', 'ṝ': 'R', 'Ṣ': 'S', 'ṣ': 'S', 'Ś': 'S', 'ś': 'S',
    'Ṇ': 'N', 'ṇ': 'N', 'Ṭ': 'T', 'ṭ': 'T', 'Ḍ': 'D', 'ḍ': 'D',
    'Ṁ': 'M', 'ṁ': 'M', 'Ṃ': 'M', 'ṃ': 'M', 'Ḥ': 'H', 'ḥ': 'H',
    'Ñ': 'N', 'ñ': 'N', 'Ṅ': 'N', 'ṅ': 'N',
  };

  /// Letters only, spelling variants folded to one sound: "Hare" and "Hari"
  /// agree, "Krishna" and "Kṛṣṇa" agree, doubled letters collapse, the
  /// aspirate H is dropped, and the vowels fall into three families (A, I, U)
  /// because an English recogniser is least sure about exactly those.
  static String fold(String input) {
    final plain = StringBuffer();
    for (final rune in input.runes) {
      final char = String.fromCharCode(rune);
      plain.write(_diacritics[char] ?? char);
    }
    var s = plain.toString().toUpperCase().replaceAll(RegExp(r'[^A-Z]'), '');
    _digraphs.forEach((from, to) => s = s.replaceAll(from, to));

    final out = StringBuffer();
    String? last;
    for (final char in s.split('')) {
      final folded = switch (char) {
        'W' => 'V',
        'Q' || 'C' => 'K',
        'Z' => 'S',
        'E' || 'I' || 'Y' => 'I',
        'O' || 'U' => 'U',
        _ => char,
      };
      if (folded == 'H' || folded == last) continue;
      out.write(folded);
      last = folded;
    }
    return out.toString();
  }
}

class _Match {
  const _Match(this.ratio, this.end, this.length);
  final double ratio;
  final int end;

  /// Folded length of the phrase that matched.
  final int length;
}
