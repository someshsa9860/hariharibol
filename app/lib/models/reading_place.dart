import 'json.dart';

/// Where a reader stopped in one book: the canto (the Bhagavatam only), the
/// chapter, and the verse nearest the top of the screen when they left.
///
/// Kept on the phone, one per book, so opening a book again lands in the same
/// place without choosing a canto, a chapter and a verse a second time.
class ReadingPlace {
  const ReadingPlace({required this.chapter, required this.verse, this.canto});

  final int? canto;
  final int chapter;
  final int verse;

  /// Same chapter, a different verse.
  ReadingPlace atVerse(int verse) =>
      ReadingPlace(canto: canto, chapter: chapter, verse: verse);

  @override
  bool operator ==(Object other) =>
      other is ReadingPlace &&
      other.canto == canto &&
      other.chapter == chapter &&
      other.verse == verse;

  @override
  int get hashCode => Object.hash(canto, chapter, verse);

  Json toJson() => {
    if (canto != null) 'canto': canto,
    'chapter': chapter,
    'verse': verse,
  };

  /// Null for anything that does not name a chapter — a stored place is never
  /// worth crashing the Read tab over, and a stale one simply starts the book
  /// from the top.
  static ReadingPlace? fromJson(dynamic raw) {
    final json = asJson(raw);
    if (json == null) return null;
    final chapter = asInt(json['chapter']);
    if (chapter <= 0) return null;
    return ReadingPlace(
      canto: asIntOrNull(json['canto']),
      chapter: chapter,
      verse: asInt(json['verse'], 1).clamp(1, 1 << 20),
    );
  }
}
