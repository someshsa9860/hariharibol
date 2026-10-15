/// Which writing system a piece of text is in, judged by its first letter.
///
/// Enough to tell Devanagari from Latin from Tamil, which is all the reading
/// page needs: a transliteration in the same script as the verse above it adds
/// nothing, so it is not shown (see `VerseBlock`).
///
/// Indian scripts each get a 128-code-point block of their own, so the block
/// number (`rune >> 7`) names the script. Every Latin letter, including the
/// accented ones IAST uses (ā ṛ ś ṣ), is one script.
bool sameScript(String a, String b) {
  final first = _scriptOf(a);
  return first != null && first == _scriptOf(b);
}

/// Whether [text] is Devanagari — Sanskrit, Hindi, Marathi — judged by its first letter.
bool isDevanagari(String text) => _scriptOf(text) == _devanagari;

const _latin = -1;
const _devanagari = 0x0900 >> 7;

int? _scriptOf(String text) {
  for (final rune in text.runes) {
    if (rune < 0x80) {
      final lower = rune | 0x20;
      if (lower >= 0x61 && lower <= 0x7A) return _latin;
      continue;
    }
    // Danda, double danda and the Devanagari digits belong to the script but
    // do not say which one it is: Bengali and Marathi both use them.
    if (rune >= 0x0964 && rune <= 0x096F) continue;
    if (rune < 0x0250 || (rune >= 0x1E00 && rune <= 0x1EFF)) return _latin;
    return rune >> 7;
  }
  return null;
}
