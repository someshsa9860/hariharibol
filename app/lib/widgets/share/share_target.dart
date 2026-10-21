import '../../core/share_links.dart';
import '../../models/mantra.dart';
import '../../models/verse.dart';

/// What a screen hands to the share studio — the same shape from every entry
/// point, so no screen has its own idea of how to share.
class ShareTarget {
  const ShareTarget({
    required this.type,
    required this.id,
    required this.title,
    this.sanskrit,
    this.transliteration,
    this.meaning,
    this.reference,
  });

  final ShareType type;

  /// Verse id (`1.2.47`), mantra slug or reel id — what the link is made for.
  final String id;
  final String title;
  final String? sanskrit;
  final String? transliteration;
  final String? meaning;
  final String? reference;

  factory ShareTarget.verse(Verse verse, {VerseTranslation? translation}) => ShareTarget(
        type: ShareType.verse,
        id: verse.verseId,
        title: verse.citation,
        sanskrit: verse.sanskrit,
        transliteration: verse.transliteration,
        meaning: (translation ?? verse.translation)?.meaning,
        reference: verse.citation,
      );

  factory ShareTarget.mantra(Mantra mantra) => ShareTarget(
        type: ShareType.mantra,
        id: mantra.slug,
        title: mantra.name,
        sanskrit: mantra.text,
        transliteration: mantra.transliteration,
        meaning: mantra.meaning ?? mantra.description,
        reference: mantra.name,
      );

  factory ShareTarget.reel({required String id, required String title, String? caption}) => ShareTarget(
        type: ShareType.reel,
        id: id,
        title: title,
        meaning: caption,
        reference: title,
      );

  /// The words that go with a link when only text is shared.
  String plainText(String? link) => [
        sanskrit,
        transliteration,
        meaning,
        if ((reference ?? '').isNotEmpty) '— $reference',
        link,
      ].where((part) => part != null && part.trim().isNotEmpty).join('\n\n');
}
