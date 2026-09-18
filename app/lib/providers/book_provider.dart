import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/api_failure.dart';
import '../models/book.dart';
import '../models/verse.dart';
import '../services/book_offline_service.dart';
import '../services/book_service.dart';

/// Every published book. Fetched once and kept — the library changes about as
/// often as the content does, not on every tab visit.
final booksProvider = FutureProvider<List<Book>>((ref) {
  return BookService.instance.list();
});

/// One book, by slug — the book detail screen.
final bookDetailProvider = FutureProvider.family.autoDispose<Book, String>((ref, slug) {
  return BookService.instance.get(slug);
});

/// A book's cantos. Empty for a book with no canto level.
final bookCantosProvider = FutureProvider.family.autoDispose<List<BookSection>, String>((ref, slug) {
  return BookService.instance.cantos(slug);
});

/// A book's chapters, optionally scoped to one canto. A record key rather
/// than a bespoke class — Dart records already have structural `==` and
/// `hashCode`, which is all a family key needs.
final bookChaptersProvider =
    FutureProvider.family.autoDispose<List<BookSection>, ({String slug, int? canto})>((ref, args) {
  return BookService.instance.chapters(args.slug, canto: args.canto);
});

/// True if a failure is worth falling back to the offline copy for — no
/// connection at all, or the connection timed out. Anything else (a 404, a
/// validation error) is a real answer from the server and offline data would
/// only hide it.
bool _isOfflineFallbackWorthy(ApiFailure failure) =>
    failure.kind == FailureKind.network || failure.kind == FailureKind.timeout;

/// The reading screen's one call: a chapter and every verse in it. Tries the
/// network first and silently saves what it gets back; falls back to the
/// offline copy — see `BookOfflineService` — only when the network itself is
/// the problem.
final chapterReadingProvider = FutureProvider.family
    .autoDispose<ChapterReading, ({String slug, int number, int? canto})>((ref, args) async {
  try {
    final reading = await BookService.instance.chapter(args.slug, args.number, canto: args.canto);
    unawaited(BookOfflineService.instance.cacheChapterRead(reading));
    return reading;
  } on ApiFailure catch (failure) {
    if (!_isOfflineFallbackWorthy(failure)) rethrow;
    final offline =
        await BookOfflineService.instance.readChapterOffline(args.slug, args.number, canto: args.canto);
    if (offline == null) rethrow;
    return offline;
  }
});

/// A short work's reading screen: every verse of a book with no chapters.
/// Same network-first, offline-fallback shape as [chapterReadingProvider].
final bookVersesProvider = FutureProvider.family.autoDispose<List<Verse>, String>((ref, slug) async {
  try {
    final verses = await BookService.instance.verses(slug);
    unawaited(BookOfflineService.instance.cacheShortWorkRead(verses));
    return verses;
  } on ApiFailure catch (failure) {
    if (!_isOfflineFallbackWorthy(failure)) rethrow;
    final offline = await BookOfflineService.instance.readVersesOffline(slug);
    if (offline == null) rethrow;
    return offline;
  }
});

enum BookDownloadPhase { idle, downloading, done, failed }

class BookDownloadState {
  const BookDownloadState({this.phase = BookDownloadPhase.idle, this.progress = 0});

  final BookDownloadPhase phase;

  /// 0–1. 0 while [phase] is still [BookDownloadPhase.downloading] and no
  /// chapter has completed yet — the UI shows an indeterminate spinner then.
  final double progress;
}

/// Drives the book detail screen's download action: whether [slug] is already
/// saved offline, and the progress of saving it when it is not.
///
/// Riverpod 3 hands a family's argument to the notifier's constructor, not to
/// `build` — so the slug is a field, and `build` keeps the no-argument
/// signature `AsyncNotifier` declares.
class BookDownloadNotifier extends AsyncNotifier<BookDownloadState> {
  BookDownloadNotifier(this._slug);

  final String _slug;

  @override
  Future<BookDownloadState> build() async {
    final book = await ref.read(bookDetailProvider(_slug).future);
    final downloaded = await BookOfflineService.instance.isDownloaded(book);
    return BookDownloadState(
      phase: downloaded ? BookDownloadPhase.done : BookDownloadPhase.idle,
      progress: downloaded ? 1 : 0,
    );
  }

  Future<void> start() async {
    // Waits for the initial `isDownloaded` check in `build()` to settle first
    // — otherwise a tap that lands before it resolves could race the state
    // this method is about to set with the one `build()` is about to produce.
    await future;
    if (state.value?.phase == BookDownloadPhase.downloading) return;

    final book = await ref.read(bookDetailProvider(_slug).future);
    state = const AsyncData(BookDownloadState(phase: BookDownloadPhase.downloading));
    try {
      await BookOfflineService.instance.downloadBook(
        book,
        onProgress: (progress) =>
            state = AsyncData(BookDownloadState(phase: BookDownloadPhase.downloading, progress: progress)),
      );
      state = const AsyncData(BookDownloadState(phase: BookDownloadPhase.done, progress: 1));
    } catch (_) {
      state = const AsyncData(BookDownloadState(phase: BookDownloadPhase.failed));
      rethrow;
    }
  }
}

final bookDownloadProvider =
    AsyncNotifierProvider.family<BookDownloadNotifier, BookDownloadState, String>(BookDownloadNotifier.new);
