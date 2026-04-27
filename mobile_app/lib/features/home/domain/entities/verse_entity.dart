class VerseEntity {
  final String id;
  final String sanskrit;
  final String? transliteration;
  final String? translation;
  final String? audioUrl;
  final List<String> categories;
  final String bookTitle;
  final int chapterNumber;
  final int verseNumber;

  const VerseEntity({
    required this.id,
    required this.sanskrit,
    this.transliteration,
    this.translation,
    this.audioUrl,
    required this.categories,
    required this.bookTitle,
    required this.chapterNumber,
    required this.verseNumber,
  });
}
