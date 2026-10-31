import 'json.dart';

/// The ids the server files prayers under (`backend/config/prayer.js`). The
/// API sends an id and an English name; the app words the id itself, in the
/// reader's language (`prayerCategoryLabel`).
abstract final class PrayerCategory {
  static const morning = 'morning';
  static const evening = 'evening';
  static const meals = 'meals';
  static const guru = 'guru';
  static const deity = 'deity';
  static const aarti = 'aarti';
  static const peace = 'peace';
  static const other = 'other';
}

/// How a script on offer is made.
///
/// [original] is the prayer as it was written, in its own language and script.
/// [stored] is a writing the server holds for every verse (the same sounds in
/// Roman or Tamil letters, say). [rule] is a writing the phone can make itself from the
/// Devanagari original (`fromDevanagari`), where a verse may carry its own
/// corrected spelling instead.
enum PrayerScriptKind { original, rule, stored }

/// One way the reader can see a prayer's text: the original, or a script.
class PrayerScript {
  const PrayerScript({required this.code, required this.kind, this.languages = const []});

  /// Null for a kind the app does not know: a newer server may add one, and
  /// the script is left out rather than the prayer.
  static PrayerScript? tryParse(Json json) {
    final kind = switch (asString(json['kind'])) {
      'original' => PrayerScriptKind.original,
      'rule' => PrayerScriptKind.rule,
      'stored' => PrayerScriptKind.stored,
      _ => null,
    };
    final code = asString(json['code']);
    if (kind == null || code.isEmpty) return null;
    return PrayerScript(code: code, kind: kind, languages: asStringList(json['languages']));
  }

  /// `original`, or a language code (`en`, `bn`, `ta`).
  final String code;
  final PrayerScriptKind kind;

  /// For the original only: the languages whose readers are shown it as it was
  /// written (a Hindi or Marathi reader reads a Sanskrit prayer in Devanagari).
  final List<String> languages;

  static const originalCode = 'original';

  bool get isOriginal => kind == PrayerScriptKind.original;
}

/// One verse of a prayer, as it was written, with the other writings the
/// server holds for it.
class PrayerVerse {
  const PrayerVerse({
    required this.id,
    required this.position,
    required this.text,
    this.meaning,
    this.renderings = const {},
  });

  factory PrayerVerse.fromJson(Json json) {
    final renderings = asJson(json['renderings']) ?? const {};
    return PrayerVerse(
      id: asString(json['id']),
      position: asInt(json['position']),
      text: asString(json['text']),
      meaning: asStringOrNull(json['meaning']),
      renderings: {
        for (final entry in renderings.entries)
          if (asString(entry.value).isNotEmpty) entry.key: asString(entry.value),
      },
    );
  }

  final String id;

  /// 1-based place in the prayer.
  final int position;

  /// The verse in the prayer's own language and script.
  final String text;

  /// What it means, in the reader's reading language, else English. Null when
  /// nobody has written it.
  final String? meaning;

  /// Language code → the verse written that way. For a stored script it is the
  /// text; for a rule script it is a corrected spelling of this one verse.
  final Map<String, String> renderings;
}

/// A prayer. [about], [reference], [author], the source and the verses come
/// only with the full prayer (`GET /prayers/:id`); a list row has the title,
/// summary and [verseCount] alone.
class Prayer {
  const Prayer({
    required this.id,
    required this.slug,
    required this.category,
    required this.title,
    required this.summary,
    this.about = '',
    this.author,
    this.reference,
    this.sourceName,
    this.sourceUrl,
    this.sourceLanguage = 'sa',
    this.verseCount = 0,
    this.scripts = const [],
    this.verses = const [],
  });

  factory Prayer.fromJson(Json json) {
    final verses = [
      for (final v in json['verses'] as List? ?? const []) PrayerVerse.fromJson(asJson(v) ?? const {}),
    ];
    return Prayer(
      id: asString(json['id']),
      slug: asString(json['slug']),
      category: asString(json['category']),
      title: asString(json['title']),
      summary: asString(json['summary']),
      about: asString(json['about']),
      author: asStringOrNull(json['author']),
      reference: asStringOrNull(json['reference']),
      sourceName: asStringOrNull(json['sourceName']),
      sourceUrl: asStringOrNull(json['sourceUrl']),
      sourceLanguage: asString(json['sourceLanguage'], 'sa'),
      // A list row says how many it has; the full prayer counts its own.
      verseCount: json.containsKey('verseCount') ? asInt(json['verseCount']) : verses.length,
      scripts: [
        for (final s in json['scripts'] as List? ?? const []) ?PrayerScript.tryParse(asJson(s) ?? const {}),
      ],
      verses: verses,
    );
  }

  final String id;
  final String slug;
  final String category;
  final String title;
  final String summary;

  /// A few lines on what the prayer is and when it is said. Empty on a list row.
  final String about;

  /// Who composed it ("Śrī Śaṅkarācārya"), when known.
  final String? author;

  /// Where it comes from ("Padma Purāṇa"), when it has one.
  final String? reference;

  /// The site it was drawn from, and its address.
  final String? sourceName;
  final String? sourceUrl;

  /// The language of the original text (`sa`).
  final String sourceLanguage;
  final int verseCount;

  /// The scripts on offer, the original first. Empty on a list row.
  final List<PrayerScript> scripts;
  final List<PrayerVerse> verses;

  bool get hasAbout => about.trim().isNotEmpty;

  /// Whether there is anything to choose between: a prayer offering only its
  /// original has no script bar.
  bool get offersScripts => scripts.any((s) => !s.isOriginal);

  /// Whether any verse has a meaning to show.
  bool get hasMeanings => verses.any((v) => (v.meaning ?? '').trim().isNotEmpty);

  /// The script entry for [code], if the prayer offers it.
  PrayerScript? script(String code) {
    for (final script in scripts) {
      if (script.code == code) return script;
    }
    return null;
  }
}

/// A category that has published prayers, with how many.
class PrayerCategoryCount {
  const PrayerCategoryCount({required this.id, required this.name, required this.count});

  factory PrayerCategoryCount.fromJson(Json json) => PrayerCategoryCount(
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

/// `GET /prayers`: the categories that have anything, and the prayers.
class PrayerList {
  const PrayerList({required this.categories, required this.items});

  factory PrayerList.fromJson(Json json) => PrayerList(
        categories: [
          for (final c in json['categories'] as List? ?? const [])
            PrayerCategoryCount.fromJson(asJson(c) ?? const {}),
        ],
        items: [
          for (final i in json['items'] as List? ?? const []) Prayer.fromJson(asJson(i) ?? const {}),
        ],
      );

  final List<PrayerCategoryCount> categories;
  final List<Prayer> items;
}
