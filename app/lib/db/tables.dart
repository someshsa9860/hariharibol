import 'package:drift/drift.dart';

// The offline library.
//
// One shape for everything a reader can open: a book, the units it is cut into
// for download, the verses in them and every language each verse has been
// rendered in. Text is stored once per language (not once per reader), so
// changing the reading language never needs a download — the other languages
// are already here.
//
// Written by exactly one thing, `BookDao.replaceUnit`, in one transaction per
// unit. Nothing else inserts verses.

@DataClassName('BookRecord')
class Books extends Table {
  TextColumn get id => text()();
  TextColumn get slug => text().unique()();
  TextColumn get title => text()();

  /// `{ "hi": "…" }` as JSON text, or null.
  TextColumn get titleI18n => text().nullable()();
  IntColumn get bookNumber => integer()();

  /// `chapter`, `canto`, or null when the book is not cut into download units
  /// (a short work, saved whole from the API).
  TextColumn get unitType => text().nullable()();

  /// How many units the server's manifest lists — what "n of m downloaded" is
  /// measured against.
  IntColumn get totalUnits => integer().withDefault(const Constant(0))();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

/// A canto or a chapter. [downloadUnitId] is the unit it arrived in: a canto's
/// own id for a canto and for each chapter inside it, a chapter's own id for a
/// book cut by chapter. Replacing a unit replaces exactly the rows that share it.
@DataClassName('UnitRecord')
class Units extends Table {
  TextColumn get id => text()();
  TextColumn get bookId => text()();

  /// `canto` or `chapter`.
  TextColumn get kind => text()();
  IntColumn get number => integer()();
  IntColumn get cantoNumber => integer().nullable()();
  TextColumn get downloadUnitId => text()();
  TextColumn get title => text()();
  TextColumn get titleI18n => text().nullable()();
  TextColumn get summary => text().nullable()();
  TextColumn get summaryI18n => text().nullable()();
  IntColumn get totalVerses => integer().withDefault(const Constant(0))();

  @override
  Set<Column> get primaryKey => {id};
}

@DataClassName('VerseRecord')
@TableIndex(name: 'verses_by_unit', columns: {#bookId, #unitId, #verseNumber})
@TableIndex(name: 'verses_by_chapter', columns: {#chapterId, #verseNumber})
class Verses extends Table {
  TextColumn get id => text()();
  TextColumn get verseId => text().unique()();
  TextColumn get bookId => text()();

  /// The download unit this verse was delivered in. For a short work saved from
  /// the API it is `short:<bookId>`.
  TextColumn get unitId => text()();
  TextColumn get chapterId => text().nullable()();
  IntColumn get cantoNumber => integer().nullable()();
  IntColumn get chapterNumber => integer().nullable()();
  IntColumn get verseNumber => integer()();
  IntColumn get verseNumberEnd => integer().nullable()();
  TextColumn get type => text().withDefault(const Constant('SHLOKA'))();
  TextColumn get sanskrit => text().nullable()();
  TextColumn get transliteration => text().nullable()();

  /// JSON text: `[{ "word": …, "meaning": … }]`. Language-neutral.
  TextColumn get wordMeanings => text().nullable()();

  /// An S3 key from the offline file; a playable link needs `/audio-urls`.
  TextColumn get audioPath => text().nullable()();

  /// A playable link, when the verse came from an API response that had one.
  TextColumn get audioUrl => text().nullable()();
  TextColumn get tagsJson => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

/// One verse rendered in one language by one translator. A verse has several
/// (the Gita in English by two acharyas, in Hindi by a third); the reader's
/// language chain picks between them.
@DataClassName('TranslationRecord')
@TableIndex(name: 'translations_by_verse_language', columns: {#verseRowId, #languageCode})
@TableIndex(name: 'translations_by_language', columns: {#languageCode})
class VerseTranslations extends Table {
  TextColumn get id => text()();
  TextColumn get verseRowId => text()();
  TextColumn get languageCode => text()();

  /// `TRANSLATION`, `COMMENTARY` or `POETIC_EXPANSION`.
  TextColumn get type => text().withDefault(const Constant('TRANSLATION'))();
  TextColumn get translatorId => text().nullable()();
  TextColumn get translatorSlug => text().nullable()();
  TextColumn get translatorName => text().nullable()();
  TextColumn get meaning => text().nullable()();
  TextColumn get purport => text().nullable()();
  TextColumn get sourceRef => text().nullable()();
  TextColumn get audioPath => text().nullable()();
  IntColumn get displayOrder => integer().withDefault(const Constant(0))();

  @override
  Set<Column> get primaryKey => {id};
}

/// Where each download unit stands. A row means "the server lists this unit";
/// `done` means its verses are in [Verses] at exactly this [version] and [hash].
@DataClassName('DownloadStateRecord')
class DownloadStates extends Table {
  @override
  String get tableName => 'download_state';

  TextColumn get bookId => text()();
  TextColumn get unitId => text()();

  /// `chapter` or `canto`.
  TextColumn get unitType => text()();
  IntColumn get unitNumber => integer().withDefault(const Constant(0))();

  /// `pending`, `downloading`, `done` or `failed` — see [UnitStatus].
  TextColumn get status => text().withDefault(const Constant('pending'))();
  IntColumn get version => integer().withDefault(const Constant(0))();
  TextColumn get hash => text().nullable()();
  DateTimeColumn get downloadedAt => dateTime().nullable()();
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
  TextColumn get lastError => text().nullable()();

  @override
  Set<Column> get primaryKey => {bookId, unitId};
}

enum UnitStatus {
  pending,
  downloading,
  done,
  failed;

  static UnitStatus parse(String? value) =>
      UnitStatus.values.firstWhere((s) => s.name == value, orElse: () => UnitStatus.pending);
}
