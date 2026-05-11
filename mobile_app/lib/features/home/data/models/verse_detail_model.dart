import 'verse_model.dart';

class WordMeaning {
  final String word;
  final String meaning;

  const WordMeaning({required this.word, required this.meaning});

  factory WordMeaning.fromJson(Map<String, dynamic> json) {
    return WordMeaning(
      word: json['word'] as String? ?? '',
      meaning: json['meaning'] as String? ?? '',
    );
  }
}

class NarrationModel {
  final String id;
  final String saintName;
  final String excerpt;
  final String? fullText;
  final String? audioUrl;

  const NarrationModel({
    required this.id,
    required this.saintName,
    required this.excerpt,
    this.fullText,
    this.audioUrl,
  });

  factory NarrationModel.fromJson(Map<String, dynamic> json) {
    return NarrationModel(
      id: json['id'] as String? ?? '',
      saintName: json['saintName'] as String? ??
          (json['saint'] as Map<String, dynamic>?)?['name'] as String? ??
          'Unknown Saint',
      excerpt: json['excerpt'] as String? ?? json['titleKey'] as String? ?? '',
      fullText: json['fullText'] as String? ?? json['contentKey'] as String?,
      audioUrl: json['audioUrl'] as String?,
    );
  }
}

class VerseDetailModel extends VerseModel {
  final List<WordMeaning> wordMeanings;
  final List<NarrationModel> narrations;
  final bool isFavorited;

  const VerseDetailModel({
    required super.id,
    required super.sanskrit,
    super.transliteration,
    super.translation,
    super.audioUrl,
    required super.categories,
    required super.bookTitle,
    required super.chapterNumber,
    required super.verseNumber,
    this.wordMeanings = const [],
    this.narrations = const [],
    this.isFavorited = false,
  });

  factory VerseDetailModel.fromJson(Map<String, dynamic> json) {
    final wordMeaningsRaw = json['wordMeanings'] as List? ?? [];
    final narrationsRaw = json['narrations'] as List? ?? [];

    return VerseDetailModel(
      id: json['id'] as String? ?? '',
      sanskrit: json['sanskrit'] as String? ?? '',
      transliteration: json['transliteration'] as String?,
      translation: json['translationKey'] as String?,
      audioUrl: json['audioUrl'] as String?,
      categories: List<String>.from(json['categoryKeys'] as List? ?? []),
      bookTitle:
          (json['book'] as Map<String, dynamic>?)?['titleKey'] as String? ??
              'Unknown',
      chapterNumber: json['chapterNumber'] as int? ?? 0,
      verseNumber: json['verseNumber'] as int? ?? 0,
      wordMeanings: wordMeaningsRaw
          .map((e) => WordMeaning.fromJson(e as Map<String, dynamic>))
          .toList(),
      narrations: narrationsRaw
          .map((e) => NarrationModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      isFavorited: json['isFavorited'] as bool? ?? false,
    );
  }

  VerseDetailModel copyWithFavorite(bool favorited) {
    return VerseDetailModel(
      id: id,
      sanskrit: sanskrit,
      transliteration: transliteration,
      translation: translation,
      audioUrl: audioUrl,
      categories: categories,
      bookTitle: bookTitle,
      chapterNumber: chapterNumber,
      verseNumber: verseNumber,
      wordMeanings: wordMeanings,
      narrations: narrations,
      isFavorited: favorited,
    );
  }
}
