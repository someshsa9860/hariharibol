import 'json.dart';

/// Who rendered a translation. Only ever shown next to their own text — an
/// acharya's purport and our own explanation are different things and the UI
/// must never let them look alike.
class Translator {
  const Translator({required this.id, required this.slug, required this.name, this.imageUrl});

  final String id;
  final String slug;
  final String name;
  final String? imageUrl;

  factory Translator.fromJson(Json json) => Translator(
        id: asString(json['id']),
        slug: asString(json['slug']),
        name: asString(json['name']),
        // Reference rows send `imageUrl`; the nested translator sends the raw
        // `imagePath`, which is not fetchable — so only a signed URL is kept.
        imageUrl: asStringOrNull(json['imageUrl']),
      );
}

/// One rendering of a verse, in one language, by one translator.
class VerseTranslation {
  const VerseTranslation({
    required this.id,
    required this.languageCode,
    required this.type,
    this.meaning,
    this.purport,
    this.sourceRef,
    this.translator,
  });

  final String id;
  final String languageCode;
  final String type;
  final String? meaning;

  /// The commentary. Long — screens should treat it as an expandable section,
  /// not something to render inside a card.
  final String? purport;
  final String? sourceRef;
  final Translator? translator;

  bool get hasPurport => (purport ?? '').trim().isNotEmpty;

  factory VerseTranslation.fromJson(Json json) => VerseTranslation(
        id: asString(json['id']),
        languageCode: asString(json['languageCode']),
        type: asString(json['type']),
        meaning: asStringOrNull(json['meaning']),
        purport: asStringOrNull(json['purport']),
        sourceRef: asStringOrNull(json['sourceRef']),
        translator: asJson(json['translator']) == null
            ? null
            : Translator.fromJson(asJson(json['translator'])!),
      );
}

/// Our own plain-language note. Deliberately a different model from
/// [VerseTranslation] so it can never be presented as commentary.
class VerseExplanation {
  const VerseExplanation({required this.text, required this.source});

  final String text;

  /// `EDITORIAL` or `AI` — the UI labels the second one as such.
  final String source;

  bool get isGenerated => source.toUpperCase() == 'AI';

  factory VerseExplanation.fromJson(Json json) => VerseExplanation(
        text: asString(json['text']),
        source: asString(json['source'], 'EDITORIAL'),
      );
}

/// The book and chapter a verse sits in, as sent inline with it.
class VerseBookRef {
  const VerseBookRef({required this.id, required this.slug, required this.title, required this.bookNumber});

  final String id;
  final String slug;
  final String title;
  final int bookNumber;

  factory VerseBookRef.fromJson(Json json) => VerseBookRef(
        id: asString(json['id']),
        slug: asString(json['slug']),
        title: asString(json['title']),
        bookNumber: asInt(json['bookNumber']),
      );
}

class VerseChapterRef {
  const VerseChapterRef({required this.id, required this.number, required this.title});

  final String id;
  final int number;
  final String title;

  factory VerseChapterRef.fromJson(Json json) => VerseChapterRef(
        id: asString(json['id']),
        number: asInt(json['number']),
        title: asString(json['title']),
      );
}

/// A verse, already resolved into the reader's languages by the API.
class Verse {
  const Verse({
    required this.id,
    required this.verseId,
    required this.bookNumber,
    required this.type,
    this.cantoNumber,
    this.chapterNumber,
    this.verseNumber,
    this.verseNumberEnd,
    this.sanskrit,
    this.transliteration,
    this.wordMeanings,
    this.audioUrl,
    this.tags = const [],
    this.book,
    this.chapter,
    this.translation,
    this.availableTranslations = const [],
    this.explanation,
  });

  final String id;

  /// The human reference — `1.2.13` for Gita, `2.10.1.5-7` for a Bhagavatam
  /// range. Every scraped file is keyed on it, so it is what the app routes on.
  final String verseId;
  final int bookNumber;
  final String type;
  final int? cantoNumber;
  final int? chapterNumber;
  final int? verseNumber;

  /// Set when the verse covers a range, e.g. 5–7 presented as one.
  final int? verseNumberEnd;

  final String? sanskrit;
  final String? transliteration;
  final String? wordMeanings;
  final String? audioUrl;
  final List<String> tags;

  final VerseBookRef? book;
  final VerseChapterRef? chapter;

  /// The rendering chosen for this reader.
  final VerseTranslation? translation;

  /// The others they can switch to, without their text.
  final List<VerseTranslation> availableTranslations;

  final VerseExplanation? explanation;

  /// "Bhagavad Gita · 2.13" — the citation, with the book set off from the
  /// numbering. The same parts as [reference], punctuated for display.
  String get citation {
    final title = book?.title;
    final numbering = _numbering;
    if (title == null || title.isEmpty) return numbering.isEmpty ? verseId : numbering;
    return numbering.isEmpty ? title : '$title \u00B7 $numbering';
  }

  /// "Bhagavad Gita 2.13" — what a card shows under the Sanskrit.
  String get reference {
    final title = book?.title;
    final numbering = _numbering;
    if (title == null || title.isEmpty) return numbering.isEmpty ? verseId : numbering;
    return numbering.isEmpty ? title : '$title $numbering';
  }

  /// "2.13", or "2.10.1.5-7" for a Bhagavatam range.
  String get _numbering => <String>[
        if (cantoNumber != null) '$cantoNumber',
        if (chapterNumber != null) '$chapterNumber',
        if (verseNumber != null)
          verseNumberEnd != null ? '$verseNumber-$verseNumberEnd' : '$verseNumber',
      ].join('.');

  factory Verse.fromJson(Json json) => Verse(
        id: asString(json['id']),
        verseId: asString(json['verseId']),
        bookNumber: asInt(json['bookNumber']),
        type: asString(json['type']),
        cantoNumber: asIntOrNull(json['cantoNumber']),
        chapterNumber: asIntOrNull(json['chapterNumber']),
        verseNumber: asIntOrNull(json['verseNumber']),
        verseNumberEnd: asIntOrNull(json['verseNumberEnd']),
        sanskrit: asStringOrNull(json['sanskrit']),
        transliteration: asStringOrNull(json['transliteration']),
        wordMeanings: asStringOrNull(json['wordMeanings']),
        audioUrl: asStringOrNull(json['audioUrl']),
        tags: asStringList(json['tags']),
        book: asJson(json['book']) == null ? null : VerseBookRef.fromJson(asJson(json['book'])!),
        chapter: asJson(json['chapter']) == null
            ? null
            : VerseChapterRef.fromJson(asJson(json['chapter'])!),
        translation: asJson(json['translation']) == null
            ? null
            : VerseTranslation.fromJson(asJson(json['translation'])!),
        availableTranslations: asList(json['availableTranslations'], VerseTranslation.fromJson),
        explanation: asJson(json['explanation']) == null
            ? null
            : VerseExplanation.fromJson(asJson(json['explanation'])!),
      );
}
