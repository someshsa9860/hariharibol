import 'json.dart';
import 'verse.dart';

/// A book — Bhagavad Gita, Srimad Bhagavatam, or a short-form collection.
///
/// `type` is the backend's `ContentType`; [hasCantos] is the one thing the UI
/// actually branches on, since only the Bhagavatam has a canto level.
class Book {
  const Book({
    required this.id,
    required this.slug,
    required this.title,
    required this.bookNumber,
    required this.type,
    this.description,
    this.sourceLanguage,
    this.coverImageUrl,
    this.audioUrl,
    this.totalCantos = 0,
    this.totalChapters = 0,
    this.totalVerses = 0,
    this.tags = const [],
    this.translators = const [],
  });

  final String id;
  final String slug;
  final String title;

  /// 1 = Bhagavad Gita, 2 = Srimad Bhagavatam. Baked into every scraped
  /// `verseId`, so it is the stable identifier, not the slug.
  final int bookNumber;
  final String type;
  final String? description;
  final String? sourceLanguage;
  final String? coverImageUrl;
  final String? audioUrl;
  final int totalCantos;
  final int totalChapters;
  final int totalVerses;
  final List<String> tags;

  /// Who this book's renderings are by. Only `GET /books/:slug` sends this —
  /// the plain listing doesn't, so it is empty there, same as an unpublished
  /// field would be.
  final List<Translator> translators;

  bool get hasCantos => totalCantos > 0;

  factory Book.fromJson(Json json) => Book(
        id: asString(json['id']),
        slug: asString(json['slug']),
        title: asString(json['title']),
        bookNumber: asInt(json['bookNumber']),
        type: asString(json['type']),
        description: asStringOrNull(json['description']),
        sourceLanguage: asStringOrNull(json['sourceLanguage']),
        coverImageUrl: asStringOrNull(json['coverImageUrl']),
        audioUrl: asStringOrNull(json['audioUrl']),
        totalCantos: asInt(json['totalCantos']),
        totalChapters: asInt(json['totalChapters']),
        totalVerses: asInt(json['totalVerses']),
        tags: asStringList(json['tags']),
        translators: asList(json['translators'], Translator.fromJson),
      );
}

/// A canto or a chapter. The backend presents both through `present.section`,
/// so one model covers both levels.
class BookSection {
  const BookSection({
    required this.id,
    required this.number,
    required this.title,
    this.cantoNumber,
    this.summary,
    this.totalChapters,
    this.totalVerses = 0,
  });

  final String id;
  final int number;
  final String title;
  final int? cantoNumber;
  final String? summary;
  final int? totalChapters;
  final int totalVerses;

  factory BookSection.fromJson(Json json) => BookSection(
        id: asString(json['id']),
        number: asInt(json['number']),
        title: asString(json['title']),
        cantoNumber: asIntOrNull(json['cantoNumber']),
        summary: asStringOrNull(json['summary']),
        totalChapters: asIntOrNull(json['totalChapters']),
        totalVerses: asInt(json['totalVerses']),
      );
}

/// `GET /books/:slug/chapters/:number` — the chapter and every verse in it,
/// already resolved to the reader's language. This is the reading screen's
/// one call.
class ChapterReading {
  const ChapterReading({required this.chapter, required this.verses});

  final BookSection chapter;
  final List<Verse> verses;

  factory ChapterReading.fromJson(Json json) => ChapterReading(
        chapter: BookSection.fromJson(asJson(json['chapter']) ?? const {}),
        verses: asList(json['verses'], Verse.fromJson),
      );
}
