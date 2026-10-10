import '../core/navigation/app_routes.dart';
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

/// One word of the word-for-word breakdown: the Sanskrit [word] (null when the
/// source did not split it out) and what it means.
class WordMeaning {
  const WordMeaning({this.word, required this.meaning});

  final String? word;
  final String meaning;

  /// "om — O my Lord".
  String get text => word == null || word!.isEmpty ? meaning : '$word \u2014 $meaning';

  factory WordMeaning.fromJson(Json json) =>
      WordMeaning(word: asStringOrNull(json['word']), meaning: asString(json['meaning']));

  Json toJson() => {'word': word, 'meaning': meaning};

  /// The API sends a list of `{ word, meaning }`; an older shape sent one
  /// string. Either is read; anything else is empty.
  static List<WordMeaning> parse(dynamic value) {
    if (value is List) {
      return value
          .whereType<Map>()
          .map((m) => WordMeaning.fromJson(Map<String, dynamic>.from(m)))
          .where((w) => w.meaning.isNotEmpty || (w.word ?? '').isNotEmpty)
          .toList();
    }
    if (value is String && value.trim().isNotEmpty) return [WordMeaning(meaning: value.trim())];
    return const [];
  }
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
    this.wordMeanings = const [],
    this.audioUrl,
    this.audioPath,
    this.tags = const [],
    this.book,
    this.chapter,
    this.translation,
    this.availableTranslations = const [],
    this.explanation,
    this.favoriteId,
    this.isFavorite = false,
    this.highlightId,
    this.isHighlighted = false,
    this.noteCount = 0,
    this.relatedCount = 0,
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
  final List<WordMeaning> wordMeanings;

  /// A playable link, when the API sent one with the verse.
  final String? audioUrl;

  /// The storage key of the verse's recitation, when the verse came from the
  /// offline files (which carry keys, never links). A link for it is fetched
  /// when it is about to play — see `VerseAudioLinks`.
  final String? audioPath;

  /// Whether there is a recitation to play, now or after fetching its link.
  bool get hasAudio => (audioUrl ?? '').isNotEmpty || (audioPath ?? '').isNotEmpty;

  /// The word-for-word meaning as one passage: "om — O my Lord; namah — …".
  String get wordMeaningsText => wordMeanings.map((w) => w.text).join('; ');
  final List<String> tags;

  final VerseBookRef? book;
  final VerseChapterRef? chapter;

  /// The rendering chosen for this reader.
  final VerseTranslation? translation;

  /// The others they can switch to, without their text.
  final List<VerseTranslation> availableTranslations;

  final VerseExplanation? explanation;

  /// Set when this reader has bookmarked the verse — the id of the
  /// [Favorite] row itself, so removing it needs no extra lookup.
  final String? favoriteId;
  final bool isFavorite;

  /// Set when this reader has highlighted the verse — same shape as
  /// [favoriteId], for the same reason.
  final String? highlightId;
  final bool isHighlighted;

  /// How many of this reader's own notes sit against this verse.
  final int noteCount;

  /// How many curated cross-links lead out of this verse — the reading
  /// screen only shows a "related" affordance when this is above zero.
  final int relatedCount;

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

  /// Where to open this verse in full — the chapter it lives in, scrolled to
  /// its own place in it. Null when there is nowhere to send someone (no book
  /// or chapter attached), which is how a card decides whether to offer a tap
  /// at all rather than promising a screen that does not exist.
  String? get readingPath {
    final slug = book?.slug;
    final chapter = chapterNumber;
    if (slug == null || slug.isEmpty || chapter == null) return null;
    return AppRoutes.chapterPath(slug, chapter, canto: cantoNumber, verse: verseNumber);
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
        wordMeanings: WordMeaning.parse(json['wordMeanings']),
        audioUrl: asStringOrNull(json['audioUrl']),
        audioPath: asStringOrNull(json['audioPath']),
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
        favoriteId: asStringOrNull(json['favoriteId']),
        isFavorite: asBool(json['isFavorite']),
        highlightId: asStringOrNull(json['highlightId']),
        isHighlighted: asBool(json['isHighlighted']),
        noteCount: asInt(json['noteCount']),
        relatedCount: asInt(json['relatedCount']),
      );
}

/// One curated cross-link out of a verse — "Related" in the reading screen.
class RelatedVerse {
  const RelatedVerse({required this.relation, required this.verse, this.note});

  /// `SAME_CONCEPT`, `EXPANDS_ON`, `QUOTED_IN` or `CONTRASTS_WITH` — the
  /// backend's `VerseLinkRelation` enum, as-is; the UI labels it.
  final String relation;
  final String? note;
  final Verse verse;

  factory RelatedVerse.fromJson(Json json) => RelatedVerse(
        relation: asString(json['relation']),
        note: asStringOrNull(json['note']),
        verse: Verse.fromJson(asJson(json['verse']) ?? const {}),
      );
}
