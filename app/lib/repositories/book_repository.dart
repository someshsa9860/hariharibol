import 'dart:async';
import 'dart:convert';

import '../core/constants/book_sync_config.dart';
import '../db/app_database.dart';
import '../db/daos/book_dao.dart';
import '../db/daos/download_state_dao.dart';
import '../models/book.dart';
import '../models/book_cache.dart';
import '../models/verse.dart';
import '../services/audio/reading_item.dart';
import '../services/book_service.dart';
import '../services/book_sync_manager.dart';

/// A full-text hit, with the verse it found.
class VerseSearchResult {
  const VerseSearchResult({required this.verse, required this.snippet, required this.language});

  final Verse verse;

  /// The matching passage, terms in `[brackets]`.
  final String snippet;

  /// Language the text matched in; empty when the Sanskrit matched.
  final String language;
}

/// Everything the reading screens ask of the library. The UI never touches the
/// database or the network for book text — it asks here.
///
/// Reads are local first: the weekly export is downloaded silently, so a book
/// someone has opened is on the phone. A unit that is not there yet is fetched
/// at the front of the queue; only when that cannot be done (not exported,
/// offline, too slow) does a read go to the ordinary API.
class BookRepository {
  BookRepository({AppDatabase? db, BookSyncManager? sync, BookService? api})
      : _db = db ?? AppDatabase.instance,
        _syncOverride = sync,
        _api = api ?? BookService.instance;

  static final BookRepository instance = BookRepository();

  final AppDatabase _db;
  final BookSyncManager? _syncOverride;
  final BookService _api;

  BookSyncManager get _sync => _syncOverride ?? BookSyncManager.instance;
  BookDao get _books => _db.bookDao;

  // ── Sync ──────────────────────────────────────────────────────────────

  /// A book was opened: start the silent sync. [current] is the chapter (or
  /// canto, for a book cut by canto) being read.
  void bookOpened(String slug, {int? current}) => _sync.onBookOpened(slug, current: current);

  Stream<SyncSummary> watchSyncSummary(String bookId) => _sync.watchSummary(bookId);
  Stream<List<DownloadStateRecord>> watchUnitStates(String bookId) => _sync.watchStates(bookId);

  Future<String?> bookIdForSlug(String slug) async => (await _books.bookBySlug(slug))?.id;

  // ── Reading a chapter ─────────────────────────────────────────────────

  /// A chapter and its verses, in the reader's language ([chain], best first).
  ///
  /// [canto] is set for a book cut by canto. On the device → returned at once,
  /// and the book's sync is nudged. Not on the device → its unit is queued
  /// first and awaited briefly. Still not → the API.
  Future<ChapterReading> chapter(String slug, int number, {int? canto, required List<String> chain}) async {
    final unitNumber = canto ?? number;

    final local = await readChapterLocal(slug, number, canto: canto, chain: chain);
    if (local != null) {
      bookOpened(slug, current: unitNumber);
      return local;
    }

    bookOpened(slug, current: unitNumber);
    final arrived = await _sync.ensureUnit(slug, unitNumber).timeout(BookSyncConfig.readerWait, onTimeout: () => false);
    if (arrived) {
      final fetched = await readChapterLocal(slug, number, canto: canto, chain: chain);
      if (fetched != null) return fetched;
    }

    return _api.chapter(slug, number, canto: canto);
  }

  Future<ChapterReading?> readChapterLocal(
    String slug,
    int number, {
    int? canto,
    required List<String> chain,
  }) async {
    final book = await _books.bookBySlug(slug);
    if (book == null) return null;
    final unit = await _books.chapter(book.id, number, cantoNumber: canto);
    if (unit == null) return null;

    final rows = await _books.versesOfChapter(unit.id);
    if (rows.isEmpty) return null;
    final translations = await _books.translationsFor(rows.map((r) => r.id));

    return ChapterReading(
      chapter: _section(unit, chain),
      verses: [for (final row in rows) _verse(row, book, unit, translations[row.id] ?? const [], chain)],
    );
  }

  // ── Lists ─────────────────────────────────────────────────────────────

  /// Cantos on the device, or null when none are saved.
  Future<List<BookSection>?> cantosLocal(String slug, {required List<String> chain}) async {
    final book = await _books.bookBySlug(slug);
    if (book == null) return null;
    final cantos = await _books.sections(book.id, 'canto');
    if (cantos.isEmpty) return null;
    final chapters = await _books.sections(book.id, 'chapter');
    return [
      for (final c in cantos)
        _section(c, chain, totalChapters: chapters.where((ch) => ch.cantoNumber == c.number).length),
    ];
  }

  /// Chapters on the device (of one canto, if given), or null when none are saved.
  /// For a book cut by canto the list is only complete once every canto it
  /// lists has arrived — the caller falls back to the network until then.
  Future<List<BookSection>?> chaptersLocal(String slug, {int? canto, required List<String> chain}) async {
    final book = await _books.bookBySlug(slug);
    if (book == null) return null;
    final chapters = await _books.sections(book.id, 'chapter', cantoNumber: canto);
    if (chapters.isEmpty) return null;
    return [for (final c in chapters) _section(c, chain)];
  }

  // ── Short works (saved whole from the API) ────────────────────────────

  /// A short work's verses: from the API, saved as they arrive; from the device
  /// if the network is the problem. Short works are not in the weekly export.
  Future<List<Verse>> shortWork(String slug, {required List<String> chain}) async {
    try {
      final verses = await _api.verses(slug);
      unawaited(saveShortWork(verses).catchError((_) {}));
      return verses;
    } catch (_) {
      final local = await shortWorkLocal(slug, chain: chain);
      if (local == null) rethrow;
      return local;
    }
  }

  Future<List<Verse>?> shortWorkLocal(String slug, {required List<String> chain}) async {
    final book = await _books.bookBySlug(slug);
    if (book == null) return null;
    final rows = await _books.shortWorkVerses(book.id);
    if (rows.isEmpty) return null;
    final translations = await _books.translationsFor(rows.map((r) => r.id));
    return [for (final row in rows) _verse(row, book, null, translations[row.id] ?? const [], chain)];
  }

  /// Saves an API response for a short work. Replaces the whole work, so a
  /// verse the editors removed does not linger.
  Future<void> saveShortWork(List<Verse> verses) async {
    if (verses.isEmpty) return;
    final book = verses.first.book;
    if (book == null) return;
    final unitId = BookDao.shortWorkUnitId(book.id);

    await _books.replaceUnit(
      UnitPayload(
        schemaVersion: BookSyncConfig.supportedSchemaVersion,
        bookId: book.id,
        bookSlug: book.slug,
        bookTitle: book.title,
        bookNumber: book.bookNumber,
        unitType: 'book',
        unit: PayloadSection(id: unitId, number: 0, title: book.title),
        chapters: const [],
        verses: [
          for (final v in verses)
            PayloadVerse(
              id: v.id,
              verseId: v.verseId,
              verseNumber: v.verseNumber ?? 0,
              verseNumberEnd: v.verseNumberEnd,
              cantoNumber: v.cantoNumber,
              chapterNumber: v.chapterNumber,
              type: v.type,
              sanskrit: v.sanskrit,
              transliteration: v.transliteration,
              wordMeaningsJson: v.wordMeanings.isEmpty ? null : jsonEncode([for (final w in v.wordMeanings) w.toJson()]),
              audioUrl: v.audioUrl,
              tags: v.tags,
              translations: [
                if (v.translation != null)
                  PayloadTranslation(
                    id: v.translation!.id,
                    languageCode: v.translation!.languageCode,
                    type: v.translation!.type,
                    translatorId: v.translation!.translator?.id,
                    translatorSlug: v.translation!.translator?.slug,
                    translatorName: v.translation!.translator?.name,
                    meaning: v.translation!.meaning,
                    purport: v.translation!.purport,
                    sourceRef: v.translation!.sourceRef,
                  ),
              ],
            ),
        ],
      ),
      version: 0,
      hash: '',
    );
  }

  // ── Speech ────────────────────────────────────────────────────────────

  /// Every stored rendering of [verseIds], reduced to what speech needs. The
  /// spoken language is the *speaking* setting, so this returns all languages
  /// and the caller picks — whatever is on screen does not decide what is said.
  Future<Map<String, List<SpokenRendering>>> spokenRenderings(Iterable<String> verseIds) async {
    final rows = await _books.translationsFor(verseIds);
    return {
      for (final entry in rows.entries)
        entry.key: [
          for (final t in entry.value) SpokenRendering(language: t.languageCode, meaning: t.meaning, purport: t.purport),
        ],
    };
  }

  // ── Search ────────────────────────────────────────────────────────────

  /// Full-text search over everything downloaded, in the reader's languages
  /// plus the Sanskrit.
  Future<List<VerseSearchResult>> search(String query, {required List<String> chain, String? bookSlug, int limit = 30}) async {
    String? bookId;
    if (bookSlug != null) {
      bookId = (await _books.bookBySlug(bookSlug))?.id;
      if (bookId == null) return const [];
    }
    final hits = await _db.searchDao.search(query, languages: chain, bookId: bookId, limit: limit * 3);

    // One result per verse: its best-ranked match.
    final seen = <String>{};
    final results = <VerseSearchResult>[];
    for (final hit in hits) {
      if (!seen.add(hit.verseRowId)) continue;
      final row = await _books.verseByRowId(hit.verseRowId);
      if (row == null) continue;
      final book = await _books.bookById(row.bookId);
      if (book == null) continue;
      final translations = await _books.translationsFor([row.id]);
      results.add(VerseSearchResult(
        verse: _verse(row, book, null, translations[row.id] ?? const [], chain),
        snippet: hit.snippet,
        language: hit.language,
      ));
      if (results.length >= limit) break;
    }
    return results;
  }

  // ── Building the app's models from rows ───────────────────────────────

  BookSection _section(UnitRecord unit, List<String> chain, {int? totalChapters}) {
    return BookSection(
      id: unit.id,
      number: unit.number,
      title: _localised(unit.title, unit.titleI18n, chain),
      cantoNumber: unit.cantoNumber,
      summary: unit.summary == null ? null : _localised(unit.summary!, unit.summaryI18n, chain),
      totalChapters: totalChapters,
      totalVerses: unit.totalVerses,
    );
  }

  static String _localised(String fallback, String? i18nJson, List<String> chain) {
    if (i18nJson == null) return fallback;
    try {
      final map = jsonDecode(i18nJson);
      if (map is Map) {
        for (final code in chain) {
          final value = map[code];
          if (value is String && value.isNotEmpty) return value;
        }
      }
    } catch (_) {}
    return fallback;
  }

  /// The first stored rendering in the earliest language of [chain] — the same
  /// rule the server applies (`language.pick`), against what is on the device.
  static TranslationRecord? pickTranslation(List<TranslationRecord> rows, List<String> chain) {
    for (final code in chain) {
      for (final row in rows) {
        if (row.languageCode == code) return row;
      }
    }
    return null;
  }

  Verse _verse(VerseRecord row, BookRecord book, UnitRecord? chapter, List<TranslationRecord> rows, List<String> chain) {
    final picked = pickTranslation(rows, chain);
    final allowed = rows.where((t) => chain.contains(t.languageCode)).toList();

    List<WordMeaning> words = const [];
    if (row.wordMeanings != null) {
      try {
        words = WordMeaning.parse(jsonDecode(row.wordMeanings!));
      } catch (_) {}
    }

    VerseTranslation shape(TranslationRecord t, {bool withText = true}) => VerseTranslation(
          id: t.id,
          languageCode: t.languageCode,
          type: t.type,
          meaning: withText ? t.meaning : null,
          purport: withText ? t.purport : null,
          sourceRef: t.sourceRef,
          translator: t.translatorId == null
              ? null
              : Translator(id: t.translatorId!, slug: t.translatorSlug ?? '', name: t.translatorName ?? ''),
        );

    return Verse(
      id: row.id,
      verseId: row.verseId,
      bookNumber: book.bookNumber,
      type: row.type,
      cantoNumber: row.cantoNumber,
      chapterNumber: row.chapterNumber,
      verseNumber: row.verseNumber,
      verseNumberEnd: row.verseNumberEnd,
      sanskrit: row.sanskrit,
      transliteration: row.transliteration,
      wordMeanings: words,
      audioUrl: row.audioUrl,
      audioPath: row.audioPath,
      tags: row.tagsJson == null ? const [] : List<String>.from(jsonDecode(row.tagsJson!) as List),
      book: VerseBookRef(id: book.id, slug: book.slug, title: book.title, bookNumber: book.bookNumber),
      chapter: chapter == null ? null : VerseChapterRef(id: chapter.id, number: chapter.number, title: chapter.title),
      translation: picked == null ? null : shape(picked),
      availableTranslations: [for (final t in allowed) shape(t, withText: false)],
    );
  }
}
