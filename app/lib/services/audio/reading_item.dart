import '../../models/verse.dart';

/// One verse as the player sees it: the recording of it being recited.
class ReadingItem {
  const ReadingItem({required this.verse, required this.label});

  final Verse verse;

  /// "2.13" — what the lock screen shows.
  final String label;

  /// Whether there is a recording to play. A verse without one is skipped.
  bool get hasAnything => verse.hasAudio;
}

/// Turns verses into [ReadingItem]s.
abstract final class ReadingItems {
  static List<ReadingItem> build(List<Verse> verses) => [
        for (final verse in verses) ReadingItem(verse: verse, label: _label(verse)),
      ];

  static String _label(Verse verse) {
    final reference = verse.reference;
    return reference.isEmpty ? verse.verseId : reference;
  }
}
