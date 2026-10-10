/// Makes stored text fit to be read aloud: no markup, no stray symbols, one
/// space between words.
abstract final class SpeechText {
  static String clean(String? raw) {
    if (raw == null) return '';
    return raw
        .replaceAll(RegExp(r'<[^>]+>'), ' ')
        .replaceAll(RegExp(r'&nbsp;|&#160;'), ' ')
        .replaceAll('&amp;', '&')
        .replaceAll(RegExp(r'[*_#`]+'), '')
        .replaceAll(RegExp(r'[ \t]+'), ' ')
        .replaceAll(RegExp(r'\s*\n\s*'), '\n')
        .trim();
  }
}
