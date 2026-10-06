import '../core/session/app_session.dart';
import '../db/app_database.dart';
import '../models/book.dart';
import '../models/verse.dart';
import 'book_service.dart';

/// Keeps a reader's books available offline.
///
/// Two things happen through here, and neither asks the reader for anything:
///
///   1. Whatever chapter or short work was just read is saved, silently, so
///      it opens again without a connection.
///   2. An explicit "download this book" fetches everything at once, using
///      the fewest requests the book's size allows.
///
/// The language a rendering is saved under is whatever the server actually
/// resolved it to (`VerseTranslation.languageCode`) — never guessed from the
/// reader's settings, so a fallback the server made (say, to English because
/// Hindi has no purport yet) is recorded as what it is.
class BookOfflineService {
  BookOfflineService._();

  static final BookOfflineService instance = BookOfflineService._();

  final AppDatabase _db = AppDatabase.instance;
  final BookService _books = BookService.instance;

  /// Called after every successful chapter fetch. Best-effort: a caching
  /// failure must never be mistaken for a reading one.
  Future<void> cacheChapterRead(ChapterReading reading) async {
    try {
      await _db.cacheChapterReading(reading: reading);
    } catch (_) {
      // Offline reading of this chapter simply stays unavailable.
    }
  }

  /// Called after every successful short-work fetch.
  Future<void> cacheShortWorkRead(List<Verse> verses) async {
    try {
      final languageCode = _resolvedLanguage(verses);
      if (languageCode == null) return;
      await _db.cacheShortWork(verses: verses, languageCode: languageCode);
    } catch (_) {}
  }

  Future<ChapterReading?> readChapterOffline(String slug, int number, {int? canto}) {
    return _db.readChapterOffline(
      bookSlug: slug,
      number: number,
      cantoNumber: canto,
      languageChain: _readingLanguageChain(),
    );
  }

  Future<List<Verse>?> readVersesOffline(String slug) {
    return _db.readVersesOffline(bookSlug: slug, languageChain: _readingLanguageChain());
  }

  /// Whether [book] is already fully saved in the reader's current language —
  /// what the download button checks before doing any work at all.
  Future<bool> isDownloaded(Book book) {
    return _db.isBookDownloaded(book.id, _readingLanguageChain().first);
  }

  /// Fetches every chapter of [book] and saves it, so the whole thing reads
  /// offline without the reader having opened each chapter first.
  ///
  /// A book with no cantos — Bhagavad Gita, or any short work — fits in one
  /// request. Srimad Bhagavatam's translations and purports do not fit the
  /// whole book in one response, so it goes one request per canto: twelve for
  /// the whole work rather than one per chapter (over three hundred). Already
  /// downloaded cantos are skipped, so a retried or resumed download does not
  /// refetch what it already has.
  Future<void> downloadBook(Book book, {void Function(double progress)? onProgress}) async {
    final languageCode = _readingLanguageChain().first;

    if (await _db.isBookDownloaded(book.id, languageCode)) {
      onProgress?.call(1);
      return;
    }

    if (!book.hasCantos && book.totalChapters == 0) {
      final verses = await _books.verses(book.slug);
      await _db.cacheShortWork(verses: verses, languageCode: _resolvedLanguage(verses) ?? languageCode);
      onProgress?.call(1);
      return;
    }

    if (!book.hasCantos) {
      final chapters = await _books.chaptersBulk(book.slug);
      for (final reading in chapters) {
        await _db.cacheChapterReading(reading: reading);
      }
      await _db.markBookDownloaded(book.id, languageCode);
      onProgress?.call(1);
      return;
    }

    final cantos = await _books.cantos(book.slug);
    for (var i = 0; i < cantos.length; i++) {
      final canto = cantos[i];
      if (!await _db.isCantoDownloaded(book.id, canto.number, languageCode)) {
        final chapters = await _books.chaptersBulk(book.slug, canto: canto.number);
        for (final reading in chapters) {
          await _db.cacheChapterReading(reading: reading, cantoNumber: canto.number);
        }
        await _db.markCantoDownloaded(book.id, canto.number, languageCode);
      }
      onProgress?.call((i + 1) / cantos.length);
    }
    await _db.markBookDownloaded(book.id, languageCode);
  }

  String? _resolvedLanguage(List<Verse> verses) {
    for (final verse in verses) {
      final code = verse.translation?.languageCode;
      if (code != null) return code;
    }
    return null;
  }

  /// Mirrors the backend's own `readingChain` (readingLanguage → appLanguage →
  /// "en") so an offline read falls back the same way the API would have.
  List<String> _readingLanguageChain() {
    final user = AppSession.instance.user;
    final codes = <String>[if (user != null) user.readingLanguage, if (user != null) user.appLanguage, 'en'];
    final seen = <String>{};
    return [
      for (final code in codes)
        if (code.isNotEmpty && seen.add(code)) code,
    ];
  }
}
