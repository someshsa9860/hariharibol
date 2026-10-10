import '../../models/verse.dart';
import 'speech_text.dart';

enum ReadingSection { verse, meaning, purport }

/// Text to speak and the language it is in. A section carries several, best
/// first (the speaking language, then English), because what exists varies:
/// a Hindi meaning with an English purport is common.
class SpokenText {
  const SpokenText(this.language, this.text);

  final String language;
  final String text;
}

/// One verse as the player sees it: its recitation, and what to say after.
class ReadingItem {
  const ReadingItem({
    required this.verse,
    required this.label,
    this.meaning = const [],
    this.purport = const [],
  });

  final Verse verse;

  /// "2.13" — what the lock screen shows.
  final String label;
  final List<SpokenText> meaning;
  final List<SpokenText> purport;

  bool get hasAnything => verse.hasAudio || meaning.isNotEmpty || purport.isNotEmpty;
}

/// Turns verses into [ReadingItem]s.
///
/// [renderings] gives each verse's stored translations in every language
/// (verse row id → rows), so the spoken text follows the *speaking* language
/// whatever language the screen is showing. [displayed] is the fallback for a
/// verse that has none stored (a chapter that came straight from the API).
abstract final class ReadingItems {
  static List<ReadingItem> build(
    List<Verse> verses, {
    required List<String> speakingChain,
    required Map<String, List<SpokenRendering>> renderings,
    bool wordMeanings = false,
  }) {
    return [
      for (final verse in verses)
        ReadingItem(
          verse: verse,
          label: _label(verse),
          meaning: _meaning(verse, speakingChain, renderings[verse.id] ?? const [], wordMeanings),
          purport: _purport(verse, speakingChain, renderings[verse.id] ?? const []),
        ),
    ];
  }

  static String _label(Verse verse) {
    final reference = verse.reference;
    return reference.isEmpty ? verse.verseId : reference;
  }

  static List<SpokenText> _meaning(Verse verse, List<String> chain, List<SpokenRendering> rows, bool words) {
    final out = <SpokenText>[];
    for (final language in chain) {
      final row = rows.where((r) => r.language == language && SpeechText.clean(r.meaning).isNotEmpty).firstOrNull;
      if (row == null) continue;
      final meaning = SpeechText.clean(row.meaning);
      final wordText = words ? SpeechText.clean(verse.wordMeaningsText) : '';
      out.add(SpokenText(language, wordText.isEmpty ? meaning : '$wordText. $meaning'));
    }
    if (out.isEmpty) {
      // Nothing stored in the speaking languages: say what the screen shows.
      final shown = verse.translation;
      final text = SpeechText.clean(shown?.meaning);
      if (shown != null && text.isNotEmpty) out.add(SpokenText(shown.languageCode, text));
    }
    return out;
  }

  static List<SpokenText> _purport(Verse verse, List<String> chain, List<SpokenRendering> rows) {
    final out = <SpokenText>[];
    for (final language in chain) {
      final row = rows.where((r) => r.language == language && SpeechText.clean(r.purport).isNotEmpty).firstOrNull;
      if (row != null) out.add(SpokenText(language, SpeechText.clean(row.purport)));
    }
    if (out.isEmpty) {
      final shown = verse.translation;
      final text = SpeechText.clean(shown?.purport);
      if (shown != null && text.isNotEmpty) out.add(SpokenText(shown.languageCode, text));
    }
    return out;
  }
}

/// One stored rendering, reduced to what speech needs.
class SpokenRendering {
  const SpokenRendering({required this.language, this.meaning, this.purport});

  final String language;
  final String? meaning;
  final String? purport;
}
