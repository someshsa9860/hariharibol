import '../core/format/indic_script.dart';
import '../models/mantra.dart';

/// The prayer said at the end of a round by a mantra that has none of its own:
/// **kṛṣṇārpaṇamastu**, "let this be an offering to Kṛṣṇa" (kṛṣṇa-arpaṇam astu).
///
/// Every mantra then has a prayer between its rounds, so a round always ends with
/// a tap the reader makes themselves — and the counter never runs one round into
/// the next on its own. A mantra's own prayer (`Mantra.prayer`, set on the admin
/// Mantras page) is used instead whenever it has one.
///
/// The text is written once, in Devanagari, and shown in the reader's reading
/// language: Devanagari for Hindi, Marathi and Sanskrit, their own letters for the
/// other Indian languages ([fromDevanagari], the same carry-across the reading
/// page uses), Roman letters for English. The name is the app-language string
/// `chantPrayerFallbackName`.
abstract final class FallbackPrayer {
  static const String devanagari = 'कृष्णार्पणमस्तु';
  static const String roman = 'kṛṣṇārpaṇamastu';

  /// How long it takes to say, which is how long the tap that ends it waits.
  static const int standardMs = 3000;

  static const Duration standard = Duration(milliseconds: standardMs);

  /// Languages whose script is Devanagari: nothing to carry across.
  static const _devanagariLanguages = {'hi', 'mr', 'sa'};

  /// The language and the text of the prayer for the first language of
  /// [readingChain] that has a script this can be written in; Roman letters when
  /// none has.
  static ({String language, String text}) textFor(List<String> readingChain) {
    for (final code in readingChain) {
      if (_devanagariLanguages.contains(code)) return (language: code, text: devanagari);
      if (hasIndicScript(code)) return (language: code, text: fromDevanagari(devanagari, code));
      if (code == 'en') return (language: 'en', text: roman);
    }
    return (language: 'en', text: roman);
  }

  /// The prayer as a mantra the counter can show, named [name] (in the app's
  /// language) and written for [readingChain].
  static Mantra of({required String name, required List<String> readingChain}) {
    final written = textFor(readingChain);
    return Mantra(
      id: 'fallback-prayer',
      slug: 'krishnarpanamastu',
      name: name,
      text: written.text,
      textLanguage: written.language,
      transliteration: roman,
      durationMs: standardMs,
    );
  }
}
