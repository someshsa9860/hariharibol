import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/api_failure.dart';
import '../models/book.dart';
import '../models/verse.dart';
import '../repositories/book_repository.dart';
import '../services/book_service.dart';
import 'language_chain_provider.dart';

/// Every published book. Fetched once and kept — the library changes about as
/// often as the content does, not on every tab visit.
final booksProvider = FutureProvider<List<Book>>((ref) {
  return BookService.instance.list();
});

/// One book, by slug — the book detail screen. Opening it starts the silent
/// offline sync for the book.
final bookDetailProvider = FutureProvider.family.autoDispose<Book, String>((ref, slug) {
  BookRepository.instance.bookOpened(slug);
  return BookService.instance.get(slug);
});

/// True if a failure is worth falling back to the offline copy for — no
/// connection at all, or the connection timed out. Anything else (a 404, a
/// validation error) is a real answer from the server and offline data would
/// only hide it.
bool _isOfflineFallbackWorthy(ApiFailure failure) =>
    failure.kind == FailureKind.network || failure.kind == FailureKind.timeout;

/// A book's cantos. Empty for a book with no canto level. The device's copy
/// stands in when the network is the problem.
final bookCantosProvider = FutureProvider.family.autoDispose<List<BookSection>, String>((ref, slug) async {
  final chain = ref.read(readingChainProvider);
  try {
    return await BookService.instance.cantos(slug);
  } on ApiFailure catch (failure) {
    if (!_isOfflineFallbackWorthy(failure)) rethrow;
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
    if (!_isOfflineFallbackWorthy(failure)) rethrow;
    final local = await BookRepository.instance.chaptersLocal(args.slug, canto: args.canto, chain: chain);
    if (local == null) rethrow;
    return local;
  }
});

/// The reading screen's one call: a chapter and every verse in it. Read from
/// the device first (see `BookRepository.chapter`); the network only when the
/// chapter is not downloaded and could not be fetched in time.
final chapterReadingProvider = FutureProvider.family
    .autoDispose<ChapterReading, ({String slug, int number, int? canto})>((ref, args) {
  final chain = ref.watch(readingChainProvider);
  return BookRepository.instance.chapter(args.slug, args.number, canto: args.canto, chain: chain);
});

/// A short work's reading screen: every verse of a book with no chapters.
/// Network first (short works are not in the weekly export), the device's copy
/// when offline.
final bookVersesProvider = FutureProvider.family.autoDispose<List<Verse>, String>((ref, slug) {
  final chain = ref.watch(readingChainProvider);
  return BookRepository.instance.shortWork(slug, chain: chain);
});
