import 'package:drift/drift.dart';

/// One book that has ever been read or explicitly downloaded. Language
/// neutral — a book's identity does not change with the reader's language.
class DownloadedBooks extends Table {
  TextColumn get id => text()();
  TextColumn get slug => text()();
  TextColumn get title => text()();
  IntColumn get bookNumber => integer()();

  @override
  Set<Column> get primaryKey => {id};
}

/// One chapter of a chaptered book (Bhagavad Gita or Srimad Bhagavatam).
/// Language neutral; the text itself lives in [DownloadedVerseTexts].
class DownloadedChapters extends Table {
  TextColumn get id => text()();
  TextColumn get bookId => text()();
  IntColumn get cantoNumber => integer().nullable()();
  IntColumn get number => integer()();
  TextColumn get title => text()();
  TextColumn get summary => text().nullable()();
  IntColumn get totalVerses => integer().withDefault(const Constant(0))();

  @override
  Set<Column> get primaryKey => {id};
}

/// One verse's language-neutral content — Sanskrit, transliteration, word
/// meanings. A short work's verses (stotra, aarti, prayer, poem) have no
/// [chapterId].
class DownloadedVerses extends Table {
  TextColumn get id => text()();
  TextColumn get verseId => text()();
  TextColumn get bookId => text()();
  TextColumn get chapterId => text().nullable()();
  IntColumn get bookNumber => integer()();
  TextColumn get type => text().nullable()();
  IntColumn get cantoNumber => integer().nullable()();
  IntColumn get chapterNumber => integer().nullable()();
  IntColumn get verseNumber => integer().nullable()();
  IntColumn get verseNumberEnd => integer().nullable()();
  TextColumn get sanskrit => text().nullable()();
  TextColumn get transliteration => text().nullable()();
  TextColumn get wordMeanings => text().nullable()();
  TextColumn get tagsJson => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

/// One verse's rendering in one language — kept apart from [DownloadedVerses]
/// so switching the reading language adds a row instead of overwriting the
/// one already there, and both stay after logout.
class DownloadedVerseTexts extends Table {
  TextColumn get verseRowId => text()();
  TextColumn get languageCode => text()();
  TextColumn get translatorId => text().nullable()();
  TextColumn get translatorSlug => text().nullable()();
  TextColumn get translatorName => text().nullable()();
  TextColumn get translatorImageUrl => text().nullable()();
  TextColumn get type => text().nullable()();
  TextColumn get meaning => text().nullable()();
  TextColumn get purport => text().nullable()();
  TextColumn get sourceRef => text().nullable()();

  @override
  Set<Column> get primaryKey => {verseRowId, languageCode};
}

/// Marks one canto as fully saved in one language — Srimad Bhagavatam's
/// download unit, since its translations and purports are too large to fetch
/// as a whole book in one call. Set only by an explicit book download, so a
/// second attempt can skip a canto already finished.
class CantoDownloads extends Table {
  TextColumn get bookId => text()();
  IntColumn get cantoNumber => integer()();
  TextColumn get languageCode => text()();
  DateTimeColumn get downloadedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {bookId, cantoNumber, languageCode};
}

/// Marks one whole book as fully saved in one language — what a "Downloaded"
/// badge reads, and what an explicit download checks before doing any work.
class BookDownloads extends Table {
  TextColumn get bookId => text()();
  TextColumn get languageCode => text()();
  DateTimeColumn get downloadedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {bookId, languageCode};
}
