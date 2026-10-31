import '../../models/prayer.dart';
import 'indic_script.dart';
import 'script.dart';

/// Which of a prayer's scripts it opens in.
///
/// The server says what a prayer can be shown in (`Prayer.scripts`) and the
/// phone chooses, so the choice follows the reader without a request:
///
/// 1. the script they last picked ([saved]), if this prayer offers it. A pick
///    is one answer for every prayer, and a prayer that lacks it falls through
///    rather than showing nothing;
/// 2. else the first of their reading languages ([chain], reading → app →
///    English) the prayer can be shown in: the original when it lists that
///    language (a Hindi reader of a Sanskrit prayer is shown Devanagari), or a
///    script of that language's own code;
/// 3. else the original.
String resolvePrayerScript(Prayer prayer, {String? saved, required List<String> chain}) {
  if (saved != null && prayer.script(saved) != null) return saved;
  final original = prayer.script(PrayerScript.originalCode);
  for (final code in chain) {
    if (original != null && original.languages.contains(code)) return PrayerScript.originalCode;
    if (code != PrayerScript.originalCode && prayer.script(code) != null) return code;
  }
  return PrayerScript.originalCode;
}

/// A verse written in [script].
///
/// The original is the verse as it was written. A stored script is the text the
/// server holds for it. A rule script is the verse's own spelling when the
/// server holds one (a correction to what the rule would make), else the
/// Devanagari original carried into that script by [fromDevanagari]. A verse
/// with no stored writing falls back to the original, so a gap shows the
/// prayer, never a blank.
String prayerVerseText(PrayerVerse verse, PrayerScript script) {
  return switch (script.kind) {
    PrayerScriptKind.original => verse.text,
    PrayerScriptKind.stored => verse.renderings[script.code] ?? verse.text,
    PrayerScriptKind.rule => verse.renderings[script.code] ?? fromDevanagari(verse.text, script.code),
  };
}

/// [prayerVerseText] remembered. Converting a verse is cheap but a long prayer
/// is redrawn on every font-size or switch change, and the answer for a
/// verse in a script never changes while the prayer stays on screen.
class PrayerRenderer {
  final _made = <(String, String), String>{};

  String text(PrayerVerse verse, PrayerScript script) =>
      _made.putIfAbsent((verse.id, script.code), () => prayerVerseText(verse, script));
}

/// Whether [text] is written in Roman letters, which take the reading face
/// used for a transliteration. The verse face is made for Devanagari and the
/// other Indian scripts; set in it, English letters would read as something
/// they are not. Judged from the text and not from the script's code, because
/// a stored script can be a Roman writing (`en`) or Devanagari (`hi`).
bool isRomanPrayerText(String text) => sameScript(text, 'a');
