import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

import '../models/book.dart';
import '../models/verse.dart';
import 'tables.dart';

part 'app_database.g.dart';

/// The offline library: whatever a reader has opened or explicitly
/// downloaded, kept on the device regardless of network state or sign-out.
///
/// Never cleared on logout — see `AppSession.clear()`, which does not touch
/// this database. A book someone downloaded belongs to the device, not the
/// session.
@DriftDatabase(
  tables: [
    DownloadedBooks,
    DownloadedChapters,
    DownloadedVerses,
    DownloadedVerseTexts,
    CantoDownloads,
    BookDownloads,
  ],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase._() : super(driftDatabase(name: 'hariharibol'));

  static final AppDatabase instance = AppDatabase._();

  @override
  int get schemaVersion => 1;

  // ── Writes ─────────────────────────────────────────────────────────────

  /// Saves one chapter's verses, silently. Called after every successful
  /// chapter fetch — whether the reader is reading normally or this is one
  /// step of an explicit book download — and safe to call again for the same
  /// chapter: it only ever adds or refreshes rows, never removes another
  /// language's.
  Future<void> cacheChapterReading({required ChapterReading reading, int? cantoNumber}) async {
    if (reading.verses.isEmpty) return;
    final book = reading.verses.first.book;
    if (book == null) return;

    await transaction(() async {
      await _upsertBook(id: book.id, slug: book.slug, title: book.title, bookNumber: book.bookNumber);
      await into(downloadedChapters).insertOnConflictUpdate(
        DownloadedChaptersCompanion.insert(
          id: reading.chapter.id,
          bookId: book.id,
          number: reading.chapter.number,
          title: reading.chapter.title,
          cantoNumber: Value(cantoNumber ?? reading.chapter.cantoNumber),
          summary: Value(reading.chapter.summary),
          totalVerses: Value(reading.chapter.totalVerses),
        ),
      );

      for (final verse in reading.verses) {
        await _upsertVerse(bookId: book.id, chapterId: reading.chapter.id, verse: verse);
        await _upsertVerseText(verse);
      }
    });
  }

  /// Saves every verse of a short work — a stotra, aarti, prayer or poem —
  /// which the API already returns in one call, so saving it completes the
  /// book outright.
  Future<void> cacheShortWork({required List<Verse> verses, required String languageCode}) async {
    if (verses.isEmpty) return;
    final book = verses.first.book;
    if (book == null) return;

    await transaction(() async {
      await _upsertBook(id: book.id, slug: book.slug, title: book.title, bookNumber: book.bookNumber);
      for (final verse in verses) {
        await _upsertVerse(bookId: book.id, chapterId: null, verse: verse);
        await _upsertVerseText(verse);
      }
      await into(bookDownloads).insertOnConflictUpdate(
        BookDownloadsCompanion.insert(
          bookId: book.id,
          languageCode: languageCode,
          downloadedAt: DateTime.now(),
        ),
      );
    });
  }

  Future<void> markCantoDownloaded(String bookId, int cantoNumber, String languageCode) {
    return into(cantoDownloads).insertOnConflictUpdate(
      CantoDownloadsCompanion.insert(
        bookId: bookId,
        cantoNumber: cantoNumber,
        languageCode: languageCode,
        downloadedAt: DateTime.now(),
      ),
    );
  }

  Future<void> markBookDownloaded(String bookId, String languageCode) {
    return into(bookDownloads).insertOnConflictUpdate(
      BookDownloadsCompanion.insert(
        bookId: bookId,
        languageCode: languageCode,
        downloadedAt: DateTime.now(),
      ),
    );
  }

  Future<void> _upsertBook({
    required String id,
    required String slug,
    required String title,
    required int bookNumber,
  }) {
    return into(downloadedBooks).insertOnConflictUpdate(
      DownloadedBooksCompanion.insert(id: id, slug: slug, title: title, bookNumber: bookNumber),
    );
  }

  Future<void> _upsertVerse({
    required String bookId,
    required String? chapterId,
    required Verse verse,
  }) {
    return into(downloadedVerses).insertOnConflictUpdate(
      DownloadedVersesCompanion.insert(
        id: verse.id,
        verseId: verse.verseId,
        bookId: bookId,
        bookNumber: verse.bookNumber,
        chapterId: Value(chapterId),
        type: Value(verse.type),
        cantoNumber: Value(verse.cantoNumber),
        chapterNumber: Value(verse.chapterNumber),
        verseNumber: Value(verse.verseNumber),
        verseNumberEnd: Value(verse.verseNumberEnd),
        sanskrit: Value(verse.sanskrit),
        transliteration: Value(verse.transliteration),
        wordMeanings: Value(verse.wordMeanings),
        tagsJson: Value(jsonEncode(verse.tags)),
      ),
    );
  }

  /// Skipped when there is nothing language-specific to save — a verse with
  /// no rendering in any language the reader accepts stays Sanskrit-only.
  Future<void> _upsertVerseText(Verse verse) {
    final translation = verse.translation;
    if (translation == null) return Future.value();

    return into(downloadedVerseTexts).insertOnConflictUpdate(
      DownloadedVerseTextsCompanion.insert(
        verseRowId: verse.id,
        languageCode: translation.languageCode,
        translatorId: Value(translation.translator?.id),
        translatorSlug: Value(translation.translator?.slug),
        translatorName: Value(translation.translator?.name),
        translatorImageUrl: Value(translation.translator?.imageUrl),
        type: Value(translation.type),
        meaning: Value(translation.meaning),
        purport: Value(translation.purport),
        sourceRef: Value(translation.sourceRef),
      ),
    );
  }

  // ── Download state ─────────────────────────────────────────────────────

  Future<bool> isBookDownloaded(String bookId, String languageCode) async {
    final row = await (select(bookDownloads)
          ..where((t) => t.bookId.equals(bookId) & t.languageCode.equals(languageCode)))
        .getSingleOrNull();
    return row != null;
  }

  Future<bool> isCantoDownloaded(String bookId, int cantoNumber, String languageCode) async {
    final row = await (select(cantoDownloads)
          ..where(
            (t) =>
                t.bookId.equals(bookId) &
                t.cantoNumber.equals(cantoNumber) &
                t.languageCode.equals(languageCode),
          ))
        .getSingleOrNull();
    return row != null;
  }

  // ── Offline reads ──────────────────────────────────────────────────────

  /// The chapter reading screen's offline fallback — same shape as
  /// `BookService.chapter()`, read from whatever was cached while online.
  Future<ChapterReading?> readChapterOffline({
    required String bookSlug,
    required int number,
    int? cantoNumber,
    required List<String> languageChain,
  }) async {
    final book = await (select(downloadedBooks)..where((b) => b.slug.equals(bookSlug))).getSingleOrNull();
    if (book == null) return null;

    final chapterQuery = select(downloadedChapters)
      ..where((c) => c.bookId.equals(book.id) & c.number.equals(number));
    if (cantoNumber != null) chapterQuery.where((c) => c.cantoNumber.equals(cantoNumber));
    final chapter = await chapterQuery.getSingleOrNull();
    if (chapter == null) return null;

    final verseRows = await (select(downloadedVerses)
          ..where((v) => v.chapterId.equals(chapter.id))
          ..orderBy([(v) => OrderingTerm.asc(v.verseNumber)]))
        .get();
    if (verseRows.isEmpty) return null;

    final languageCode = await _bestAvailableLanguage(verseRows.first.id, languageChain);
    if (languageCode == null) return null;

    final verses = await Future.wait(
      verseRows.map((row) => _buildVerse(row, book: book, chapter: chapter, languageCode: languageCode)),
    );

    return ChapterReading(
      chapter: BookSection(
        id: chapter.id,
        number: chapter.number,
        title: chapter.title,
        cantoNumber: chapter.cantoNumber,
        summary: chapter.summary,
        totalVerses: chapter.totalVerses,
      ),
      verses: verses,
    );
  }

  /// A short work's offline fallback — same shape as `BookService.verses()`.
  Future<List<Verse>?> readVersesOffline({
    required String bookSlug,
    required List<String> languageChain,
  }) async {
    final book = await (select(downloadedBooks)..where((b) => b.slug.equals(bookSlug))).getSingleOrNull();
    if (book == null) return null;

    final verseRows = await (select(downloadedVerses)
          ..where((v) => v.bookId.equals(book.id) & v.chapterId.isNull())
          ..orderBy([(v) => OrderingTerm.asc(v.verseNumber)]))
        .get();
    if (verseRows.isEmpty) return null;

    final languageCode = await _bestAvailableLanguage(verseRows.first.id, languageChain);
    if (languageCode == null) return null;

    return Future.wait(
      verseRows.map((row) => _buildVerse(row, book: book, chapter: null, languageCode: languageCode)),
    );
  }

  /// The first language in [languageChain] this verse actually has saved,
  /// falling back to whatever it does have — mirrors the server's own
  /// `readingChain` fallback, just against what is on the device instead of
  /// what is in the database.
  Future<String?> _bestAvailableLanguage(String verseRowId, List<String> languageChain) async {
    final rows = await (select(downloadedVerseTexts)..where((t) => t.verseRowId.equals(verseRowId))).get();
    if (rows.isEmpty) return null;
    final available = rows.map((r) => r.languageCode).toSet();
    for (final code in languageChain) {
      if (available.contains(code)) return code;
    }
    return available.first;
  }

  Future<Verse> _buildVerse(
    DownloadedVerse row, {
    required DownloadedBook book,
    required DownloadedChapter? chapter,
    required String languageCode,
  }) async {
    final text = await (select(downloadedVerseTexts)
          ..where((t) => t.verseRowId.equals(row.id) & t.languageCode.equals(languageCode)))
        .getSingleOrNull();

    return Verse(
      id: row.id,
      verseId: row.verseId,
      bookNumber: row.bookNumber,
      type: row.type ?? '',
      cantoNumber: row.cantoNumber,
      chapterNumber: row.chapterNumber,
      verseNumber: row.verseNumber,
      verseNumberEnd: row.verseNumberEnd,
      sanskrit: row.sanskrit,
      transliteration: row.transliteration,
      wordMeanings: row.wordMeanings,
      tags: row.tagsJson == null ? const [] : List<String>.from(jsonDecode(row.tagsJson!) as List),
      book: VerseBookRef(id: book.id, slug: book.slug, title: book.title, bookNumber: book.bookNumber),
      chapter: chapter == null
          ? null
          : VerseChapterRef(id: chapter.id, number: chapter.number, title: chapter.title),
      translation: text == null
          ? null
          : VerseTranslation(
              id: '${row.id}:$languageCode',
              languageCode: languageCode,
              type: text.type ?? 'TRANSLATION',
              meaning: text.meaning,
              purport: text.purport,
              sourceRef: text.sourceRef,
              translator: text.translatorId == null
                  ? null
                  : Translator(
                      id: text.translatorId!,
                      slug: text.translatorSlug ?? '',
                      name: text.translatorName ?? '',
                      imageUrl: text.translatorImageUrl,
                    ),
            ),
    );
  }
}
