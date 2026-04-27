import '../../../home/domain/entities/verse_entity.dart';

class VerseModel extends VerseEntity {
  const VerseModel({
    required String id,
    required String sanskrit,
    String? transliteration,
    String? translation,
    String? audioUrl,
    required List<String> categories,
    required String bookTitle,
    required int chapterNumber,
    required int verseNumber,
  }) : super(
    id: id,
    sanskrit: sanskrit,
    transliteration: transliteration,
    translation: translation,
    audioUrl: audioUrl,
    categories: categories,
    bookTitle: bookTitle,
    chapterNumber: chapterNumber,
    verseNumber: verseNumber,
  );

  factory VerseModel.fromJson(Map<String, dynamic> json) {
    return VerseModel(
      id: json['id'] as String,
      sanskrit: json['sanskrit'] as String? ?? '',
      transliteration: json['transliteration'] as String?,
      translation: json['translationKey'] as String?,
      audioUrl: json['audioUrl'] as String?,
      categories: List<String>.from(json['categoryKeys'] as List? ?? []),
      bookTitle: json['book']?['titleKey'] ?? 'Unknown',
      chapterNumber: json['chapterNumber'] as int? ?? 0,
      verseNumber: json['verseNumber'] as int? ?? 0,
    );
  }
}
