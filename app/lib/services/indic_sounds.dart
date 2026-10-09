/// Writes Indic (and the few Arabic) letters as the Roman sounds they stand
/// for, so one text can be compared with another whatever script it is in.
///
/// The recogniser that hears Sanskrit (`MantraAccurateModel`) has no language
/// setting: it writes a chant in whichever Indic script it likes — Devanagari
/// `राम`, Gujarati `રામ`, Malayalam `രാമ` — all of them right, none of them the
/// same. The Indic blocks share one code-point layout, so [indicToRoman] first
/// moves every block onto Devanagari, then spells that out.
///
/// Anything that is not one of those letters (Roman text, digits, spaces) passes
/// through untouched, so this is safe to put in front of the Roman folding in
/// `MantraPhraseMatcher.fold`. Pure Dart — `test/indic_sounds_test.dart`.
String indicToRoman(String input) {
  final out = StringBuffer();
  var pendingA = false; // a consonant waiting to learn whether it carries its own "a"

  void flush({bool wordEnd = false}) {
    // Hindi does not say the "a" that ends a word (राम is "ram").
    if (pendingA && !wordEnd) out.write('a');
    pendingA = false;
  }

  for (final rune in input.runes) {
    final char = String.fromCharCode(_toDevanagari(rune));
    if (_consonants.containsKey(char)) {
      flush();
      out.write(_consonants[char]);
      pendingA = true;
    } else if (_matras.containsKey(char)) {
      pendingA = false;
      out.write(_matras[char]);
    } else if (char == _virama) {
      pendingA = false;
    } else if (_vowels.containsKey(char)) {
      flush();
      out.write(_vowels[char]);
    } else if (_nasals.contains(char)) {
      flush();
      out.write('m');
    } else if (char == _visarga) {
      flush();
      out.write('h');
    } else if (char == _nukta) {
      // a dot under a letter: the same letter for our purposes
    } else if (_arabic.containsKey(char)) {
      flush();
      out.write(_arabic[char]);
    } else {
      flush(wordEnd: !_isLetter(rune));
      out.write(char);
    }
  }
  flush(wordEnd: true);
  return out.toString();
}

/// Bengali to Malayalam sit at the same offsets from their block start as
/// Devanagari does from its own, so a letter's Devanagari twin is a subtraction.
int _toDevanagari(int rune) {
  if (rune < 0x0980 || rune > 0x0D7F) return rune;
  final twin = rune - ((rune & ~0x7F) - 0x0900);
  return twin >= 0x0900 && twin <= 0x097F ? twin : rune;
}

bool _isLetter(int rune) =>
    (rune >= 0x41 && rune <= 0x5A) || (rune >= 0x61 && rune <= 0x7A) || rune >= 0xC0;

const _virama = '\u094D';
const _visarga = '\u0903';
const _nukta = '\u093C';
const _nasals = '\u0902\u0901';

const _consonants = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n',
  'च': 'c', 'छ': 'ch', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'ळ': 'l', 'व': 'v',
  'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  // letters with the dot under them, written as one character
  '\u0958': 'k', '\u0959': 'kh', '\u095A': 'g', '\u095B': 'z',
  '\u095C': 'r', '\u095D': 'rh', '\u095E': 'f', '\u095F': 'y',
};

const _vowels = {
  'अ': 'a', 'आ': 'a', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u', 'ऋ': 'ri',
  'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऍ': 'e', 'ऑ': 'o', 'ॐ': 'om',
};

const _matras = {
  'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ri',
  'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॅ': 'e', 'ॉ': 'o',
};

const _arabic = {
  'ر': 'r', 'م': 'm', 'ن': 'n', 'ج': 'j', 'ا': 'a', 'ي': 'y', 'ی': 'y', 'ش': 'sh',
  'س': 's', 'ك': 'k', 'ک': 'k', 'ل': 'l', 'ب': 'b', 'ت': 't', 'د': 'd', 'ه': 'h',
  'ح': 'h', 'ز': 'z', 'ق': 'k', 'ف': 'f', 'ع': 'a', 'ط': 't', 'ص': 's', 'ض': 'd',
  'ذ': 'z', 'ث': 's', 'خ': 'kh', 'غ': 'g', 'و': 'v',
};
