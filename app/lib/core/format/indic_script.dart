/// Devanagari → another Indic script, for a verse's transliteration.
///
/// A mirror of the server's `fromDevanagari` (`backend/utils/script.js`) — keep the
/// two together; `test/indic_script_test.dart` holds the same cases as the server's
/// `test/pick-transliteration.test.js`.
///
/// The Indic scripts share one layout in Unicode (each block mirrors Devanagari's
/// order), so most of the conversion is a code-point shift. The exceptions —
/// letters a script lacks, and the Om sign — are the tables below. Tamil has no
/// aspirated or voiced consonants, so they collapse onto the plain ones, as they
/// do in everyday Tamil writing of Sanskrit.
library;

const _blockStart = <String, int>{
  'bn': 0x0980,
  'as': 0x0980,
  'pa': 0x0a00,
  'gu': 0x0a80,
  'or': 0x0b00,
  'ta': 0x0b80,
  'te': 0x0c00,
  'kn': 0x0c80,
  'ml': 0x0d00,
};

const _om = <String, String>{
  'bn': 'ওঁ',
  'as': 'ওঁ',
  'pa': 'ਓਂ',
  'gu': 'ૐ',
  'or': 'ଓଁ',
  'ta': 'ௐ',
  'te': 'ఓం',
  'kn': 'ಓಂ',
  'ml': 'ഓം',
};

// Letters whose offset position is empty in the target block.
const _substitute = <String, Map<String, String>>{
  'bn': {'व': 'ব', 'ळ': 'ল'},
  'as': {'व': 'ৱ', 'र': 'ৰ', 'ळ': 'ল'},
  'pa': {'ष': 'ਸ਼', 'ळ': 'ਲ਼', 'ऽ': '', 'ॠ': ''},
  'ta': {
    'ख': 'க', 'ग': 'க', 'घ': 'க', 'छ': 'ச', 'झ': 'ச', 'ठ': 'ட', 'ड': 'ட', 'ढ': 'ட', //
    'थ': 'த', 'द': 'த', 'ध': 'த', 'फ': 'ப', 'ब': 'ப', 'भ': 'ப', 'ऽ': '', 'ँ': '', 'ं': 'ம்',
  },
};

// Vocalic ऋ has no sign in Tamil or Gurmukhi; both write it as ru / ri.
const _vocalicSign = <String, String>{'ta': 'ிரு', 'pa': '੍ਰਿ'};
const _vocalicLetter = <String, String>{'ta': 'ரு', 'pa': 'ਰਿ'};

/// Languages whose own script a Devanagari text can be carried into. Hindi and
/// Marathi are written in Devanagari already, and English is Roman: for those
/// there is nothing to convert.
bool hasIndicScript(String languageCode) => _blockStart.containsKey(languageCode);

/// [text] written in [languageCode]'s script; other characters pass through, and
/// a language this does not know returns [text] unchanged.
String fromDevanagari(String text, String languageCode) {
  final start = _blockStart[languageCode];
  if (start == null) return text;

  final substitute = _substitute[languageCode] ?? const <String, String>{};
  final out = StringBuffer();

  for (final rune in text.runes) {
    final ch = String.fromCharCode(rune);
    if (ch == 'ॐ') {
      out.write(_om[languageCode]);
    } else if (ch == 'ृ' && _vocalicSign.containsKey(languageCode)) {
      out.write(_vocalicSign[languageCode]);
    } else if (ch == 'ऋ' && _vocalicLetter.containsKey(languageCode)) {
      out.write(_vocalicLetter[languageCode]);
    } else if (substitute.containsKey(ch)) {
      out.write(substitute[ch]);
    } else if (rune >= 0x0900 && rune <= 0x097F && ch != '।' && ch != '॥') {
      out.writeCharCode(rune - 0x0900 + start);
    } else {
      out.write(ch);
    }
  }
  return out.toString();
}
