import 'json.dart';

/// The ids the server files etiquette under (`backend/config/etiquette.js`).
/// The API sends an id and an English name; the app words the id itself, in
/// the reader's language (`etiquetteCategoryLabel`).
abstract final class EtiquetteCategory {
  static const temple = 'temple';
  static const deity = 'deity';
  static const prasad = 'prasad';
  static const holyName = 'holy-name';
  static const guruVaishnava = 'guru-vaishnava';
  static const speechMind = 'speech-mind';
  static const dailyLife = 'daily-life';
  static const scripture = 'scripture';
  static const holyPlaces = 'holy-places';
}

/// One piece of devotee etiquette. [body], [reference] and [author] come only
/// with the full item (`GET /etiquette/:id`, and the day's item); the list
/// sends the title and summary alone, so they are empty there.
class Etiquette {
  const Etiquette({
    required this.id,
    required this.slug,
    required this.category,
    required this.title,
    required this.summary,
    this.body = '',
    this.language = 'en',
    this.reference,
    this.author,
    this.sourceName,
    this.sourceUrl,
  });

  factory Etiquette.fromJson(Json json) => Etiquette(
        id: asString(json['id']),
        slug: asString(json['slug']),
        category: asString(json['category']),
        title: asString(json['title']),
        summary: asString(json['summary']),
        body: asString(json['body']),
        language: asString(json['language'], 'en'),
        reference: asStringOrNull(json['reference']),
        author: asStringOrNull(json['author']),
        sourceName: asStringOrNull(json['sourceName']),
        sourceUrl: asStringOrNull(json['sourceUrl']),
      );

  final String id;
  final String slug;
  final String category;
  final String title;
  final String summary;

  /// The full guidance. Empty on a list row.
  final String body;

  /// The language [title], [summary] and [body] are actually in — the reader's
  /// reading language, or English where there is no translation yet.
  final String language;

  /// Where in the scriptures or the writings of the teachers it comes from
  /// ("Śrī Upadeśāmṛta 4"), when it has one.
  final String? reference;

  /// Who it comes from: the speaker of the verse, or the teacher or temple
  /// that published the page ("Śrī Kṛṣṇa", "Hindu Temple of Atlanta"). Never
  /// the book's own author while the app hides that name.
  final String? author;

  /// The site it was drawn from, and its address.
  final String? sourceName;
  final String? sourceUrl;

  bool get hasBody => body.trim().isNotEmpty;
}

/// A category that has published etiquette, with how many.
class EtiquetteCategoryCount {
  const EtiquetteCategoryCount({required this.id, required this.name, required this.count});

  factory EtiquetteCategoryCount.fromJson(Json json) => EtiquetteCategoryCount(
        id: asString(json['id']),
        name: asString(json['name']),
        count: asInt(json['count']),
      );

  final String id;

  /// The English name the server sends — shown only for a category the app has
  /// no words for yet.
  final String name;
  final int count;
}

/// `GET /etiquette`: the categories that have anything, and the items.
class EtiquetteList {
  const EtiquetteList({required this.categories, required this.items});

  factory EtiquetteList.fromJson(Json json) => EtiquetteList(
        categories: [
          for (final c in json['categories'] as List? ?? const [])
            EtiquetteCategoryCount.fromJson(asJson(c) ?? const {}),
        ],
        items: [
          for (final i in json['items'] as List? ?? const []) Etiquette.fromJson(asJson(i) ?? const {}),
        ],
      );

  final List<EtiquetteCategoryCount> categories;
  final List<Etiquette> items;
}

/// `GET /etiquette/today`: the day's item on the reader's own calendar, or
/// none when nothing is published.
class EtiquetteToday {
  const EtiquetteToday({required this.date, this.item});

  factory EtiquetteToday.fromJson(Json json) {
    final item = asJson(json['item']);
    return EtiquetteToday(
      date: asString(json['date']),
      item: item == null ? null : Etiquette.fromJson(item),
    );
  }

  /// `YYYY-MM-DD`, the reader's own day.
  final String date;
  final Etiquette? item;
}
