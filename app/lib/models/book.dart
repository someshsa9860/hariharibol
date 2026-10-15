import '../core/format/localised.dart';
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
    this.titleI18n = const {},
    this.descriptionI18n = const {},
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

  /// The title and description in each language that has one, English included.
  /// [title] and [description] were already picked from these for the language
  /// the account had when they were sent; [titleFor] picks again for the
  /// reader's chain, so a change of reading language shows at once.
  final Map<String, String> titleI18n;
  final Map<String, String> descriptionI18n;
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

  /// The title in the first language of [chain] that has one.
  String titleFor(List<String> chain) => pickLocalised(title, titleI18n, chain);

  /// The description in the first language of [chain] that has one, or null.
  String? descriptionFor(List<String> chain) {
    final plain = description;
    if (plain == null) return null;
    return pickLocalised(plain, descriptionI18n, chain);
  }

  factory Book.fromJson(Json json) => Book(
        id: asString(json['id']),
        slug: asString(json['slug']),
        title: asString(json['title']),
        bookNumber: asInt(json['bookNumber']),
        type: asString(json['type']),
        description: asStringOrNull(json['description']),
        titleI18n: parseLocalised(json['titleI18n']),
        descriptionI18n: parseLocalised(json['descriptionI18n']),
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
    this.titleI18n = const {},
    this.summaryI18n = const {},
    this.totalChapters,
    this.totalVerses = 0,
  });

  final String id;
  final int number;
  final String title;
  final int? cantoNumber;
  final String? summary;

  /// The title and summary in each language that has one, English included —
  /// see [Book.titleI18n].
  final Map<String, String> titleI18n;
  final Map<String, String> summaryI18n;
  final int? totalChapters;
  final int totalVerses;

  /// The title in the first language of [chain] that has one.
  String titleFor(List<String> chain) => pickLocalised(title, titleI18n, chain);

  /// The summary in the first language of [chain] that has one, or null.
  String? summaryFor(List<String> chain) {
    final plain = summary;
    if (plain == null) return null;
    return pickLocalised(plain, summaryI18n, chain);
  }

  factory BookSection.fromJson(Json json) => BookSection(
        id: asString(json['id']),
        number: asInt(json['number']),
        title: asString(json['title']),
        cantoNumber: asIntOrNull(json['cantoNumber']),
        summary: asStringOrNull(json['summary']),
        titleI18n: parseLocalised(json['titleI18n']),
        summaryI18n: parseLocalised(json['summaryI18n']),
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
