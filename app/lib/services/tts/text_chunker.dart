import '../../core/constants/tts_config.dart';

/// Splits long text into sentence-sized pieces to speak one after another, so
/// the next piece can be made while this one plays and the first words are
/// heard at once instead of after the whole purport is synthesised.
abstract final class TextChunker {
  // Ends of sentences in Latin and Indic scripts: . ? ! ; the danda । and double danda ॥
  static final RegExp _sentenceEnd = RegExp(r'(?<=[.!?।॥۔])\s+|\n+');
  static final RegExp _clauseEnd = RegExp(r'(?<=[,;:—])\s+');

  static List<String> split(
    String text, {
    int maxChars = TtsConfig.maxChunkChars,
    int minChars = TtsConfig.minChunkChars,
  }) {
    final cleaned = text.replaceAll(RegExp(r'[ \t]+'), ' ').trim();
    if (cleaned.isEmpty) return const [];

    // 1. Sentences, any longer than the limit broken at clauses, then at spaces.
    final pieces = <String>[];
    for (final sentence in cleaned.split(_sentenceEnd)) {
      final s = sentence.trim();
      if (s.isEmpty) continue;
      pieces.addAll(s.length <= maxChars ? [s] : _breakLong(s, maxChars));
    }

    // 2. Short pieces joined to a neighbour while the result still fits.
    final chunks = <String>[];
    for (final piece in pieces) {
      if (chunks.isNotEmpty && (chunks.last.length < minChars) && chunks.last.length + 1 + piece.length <= maxChars) {
        chunks[chunks.length - 1] = '${chunks.last} $piece';
      } else {
        chunks.add(piece);
      }
    }
    // A short last piece joins the one before it.
    if (chunks.length > 1 && chunks.last.length < minChars && chunks[chunks.length - 2].length + 1 + chunks.last.length <= maxChars) {
      final last = chunks.removeLast();
      chunks[chunks.length - 1] = '${chunks.last} $last';
    }
    return chunks;
  }

  static List<String> _breakLong(String sentence, int maxChars) {
    final out = <String>[];
    var current = '';
    void flush() {
      if (current.isNotEmpty) out.add(current);
      current = '';
    }

    for (final clause in sentence.split(_clauseEnd)) {
      if (clause.length > maxChars) {
        flush();
        out.addAll(_breakAtSpaces(clause, maxChars));
        continue;
      }
      if (current.isEmpty) {
        current = clause;
      } else if (current.length + 1 + clause.length <= maxChars) {
        current = '$current $clause';
      } else {
        flush();
        current = clause;
      }
    }
    flush();
    return out;
  }

  static List<String> _breakAtSpaces(String text, int maxChars) {
    final out = <String>[];
    var current = '';
    for (final word in text.split(' ')) {
      if (word.length > maxChars) {
        // An unbroken run (no spaces at all): cut it, never loop forever.
        if (current.isNotEmpty) out.add(current);
        current = '';
        for (var i = 0; i < word.length; i += maxChars) {
          out.add(word.substring(i, i + maxChars > word.length ? word.length : i + maxChars));
        }
        continue;
      }
      if (current.isEmpty) {
        current = word;
      } else if (current.length + 1 + word.length <= maxChars) {
        current = '$current $word';
      } else {
        out.add(current);
        current = word;
      }
    }
    if (current.isNotEmpty) out.add(current);
    return out;
  }
}
