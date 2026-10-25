import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/api_failure.dart';
import '../models/book.dart';
import '../models/verse.dart';
import '../repositories/book_repository.dart';
import '../services/book_service.dart';
import '../services/response_cache.dart';
import 'language_chain_provider.dart';
import 'saved_then_fresh.dart';

/// Every published book, the saved copy first and then the network's. Fetched
/// once and kept — the library changes about as often as the content does, not
/// on every tab visit.
final booksProvider = StreamProvider<List<Book>>((ref) {
  final service = BookService.instance;
  return savedThenFresh(service.savedList, service.list);
});

/// One book, by slug — the book detail screen, the saved copy first. Opening it
/// starts the silent offline sync for the book.
final bookDetailProvider = StreamProvider.family.autoDispose<Book, String>((ref, slug) {
  BookRepository.instance.bookOpened(slug);
  final service = BookService.instance;
  return savedThenFresh(() => service.savedBook(slug), () => service.get(slug));
});

/// The reading languages a book has text in. Empty when it cannot be fetched
/// (offline, say), which the reading settings read as "offer every language".
final bookLanguagesProvider = FutureProvider.family.autoDispose<Set<String>, String>((ref, slug) async {
  try {
    return await BookService.instance.languages(slug);
  } on ApiFailure {
    return const <String>{};
  }
});

/// A book's cantos. Empty for a book with no canto level. The saved answer
/// stands in when the server cannot be reached, and the offline library's copy
/// when nothing is saved. A real answer (a 404) is never covered up.
final bookCantosProvider = FutureProvider.family.autoDispose<List<BookSection>, String>((ref, slug) async {
  final chain = ref.read(readingChainProvider);
  try {
    return await BookService.instance.cantos(slug);
  } on ApiFailure catch (failure) {
    if (!serverUnreachable(failure)) rethrow;
    final local = await BookRepository.instance.cantosLocal(slug, chain: chain);
    if (local == null) rethrow;
    return local;
  }
});

/// A book's chapters, optionally scoped to one canto. A record key rather
/// than a bespoke class — Dart records already have structural `==` and
/// `hashCode`, which is all a family key needs.
final bookChaptersProvider =
    FutureProvider.family.autoDispose<List<BookSection>, ({String slug, int? canto})>((ref, args) async {
  final chain = ref.read(readingChainProvider);
  try {
    return await BookService.instance.chapters(args.slug, canto: args.canto);
  } on ApiFailure catch (failure) {
    if (!serverUnreachable(failure)) rethrow;
    final local = await BookRepository.instance.chaptersLocal(args.slug, canto: args.canto, chain: chain);
    if (local == null) rethrow;
    return local;
  }
});

/// Which copy of a chapter is on the device (see `BookDao.watchChapterRevision`).
final chapterRevisionProvider =
    StreamProvider.family.autoDispose<String?, ({String slug, int number, int? canto})>((ref, args) {
  return BookRepository.instance.watchChapterRevision(args.slug, args.number, canto: args.canto);
});

/// The reading screen's one call: a chapter and every verse in it. Read from
/// the device first (see `BookRepository.chapter`); the network only when the
/// chapter is not downloaded and could not be fetched in time.
///
/// Read again when the copy on the device is replaced by a newer one — the sync
/// fetches new text from the server in the background while the old is on screen
/// (a translation added since, a corrected verse) — so the reader sees it without
/// leaving the chapter. The verses stay up while it reloads and nothing is shown.
final chapterReadingProvider = FutureProvider.family
    .autoDispose<ChapterReading, ({String slug, int number, int? canto})>((ref, args) {
  final chain = ref.watch(readingChainProvider);
  ref.listen(chapterRevisionProvider(args), (previous, next) {
    final before = previous?.value;
    final after = next.value;
    // Only a copy replaced by another one counts. Arriving where there was none is
    // the chapter being fetched for this very read, which already has it.
    if (before != null && after != null && before != after) ref.invalidateSelf();
  });
  return BookRepository.instance.chapter(args.slug, args.number, canto: args.canto, chain: chain);
});

/// A short work's reading screen: every verse of a book with no chapters.
/// Network first (short works are not in the weekly export), the device's copy
/// when offline.
final bookVersesProvider = FutureProvider.family.autoDispose<List<Verse>, String>((ref, slug) {
  final chain = ref.watch(readingChainProvider);
  return BookRepository.instance.shortWork(slug, chain: chain);
});
