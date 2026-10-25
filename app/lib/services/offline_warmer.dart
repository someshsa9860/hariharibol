import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

import '../core/constants/api_paths.dart';
import '../core/constants/offline_config.dart';
import '../core/constants/storage_keys.dart';
import '../models/book.dart';
import '../repositories/book_repository.dart';
import 'book_service.dart';
import 'book_sync_manager.dart';
import 'calendar_service.dart';
import 'etiquette_service.dart';
import 'favorite_service.dart';
import 'issue_service.dart';
import 'local_store.dart';
import 'mala_audio_cache.dart';
import 'mantra_service.dart';
import 'reel_service.dart';
import 'reference_service.dart';
import 'response_cache.dart';
import 'sadhana_service.dart';
import 'sloka_service.dart';
import 'user_service.dart';

/// Fetches ahead what a reader might open with no connection, so it is saved
/// before it is needed — not only the screens they happened to open.
///
/// One pass asks for the library's shape (every book, its cantos and chapters),
/// the calendar from last month to three months on, today's etiquette and every
/// item of it, the reader's own mantra in full (what the counter opens on), and
/// the small things other screens start from (the mantras, the book-reel look,
/// the issues, the languages, the reader's summary and favourites). Each answer
/// is saved by the service that asked (`getOrSaved`), so nothing here stores
/// anything itself.
///
/// **Books on Wi-Fi.** On Wi-Fi every book is also queued for the offline
/// library (`BookSyncManager.syncBook`), not only the ones the reader opened; a
/// short work is saved whole (`BookRepository.shortWork`), and the reader's
/// mantra's mala recording is downloaded (`MalaAudioCache`). On mobile data
/// only the books already opened download, as before, and a recording only
/// once it has been played.
///
/// A pass that could not reach the server is not counted, and every step
/// swallows its own failure: a pass never throws. See "Offline" in
/// app/CLAUDE.md.
class OfflineWarmer {
  OfflineWarmer({
    BookService? books,
    CalendarService? calendar,
    EtiquetteService? etiquette,
    List<Future<void> Function()>? others,
    Future<bool> Function()? onWifi,
    Future<void> Function(String slug)? downloadBook,
    Future<void> Function(String slug, List<String> chain)? saveShortWork,
    Future<void> Function({required bool onWifi})? chantMantra,
    DateTime Function()? clock,
  })  : _books = books ?? BookService.instance,
        _calendar = calendar ?? CalendarService.instance,
        _etiquette = etiquette ?? EtiquetteService.instance,
        _others = others ?? _everyScreenStart(),
        _onWifi = onWifi ?? _wifi,
        _downloadBook = downloadBook ?? ((slug) => BookSyncManager.instance.syncBook(slug)),
        _saveShortWork = saveShortWork ?? ((slug, chain) => BookRepository.instance.shortWork(slug, chain: chain)),
        _chantMantra = chantMantra ?? _readersMantra,
        _clock = clock ?? DateTime.now;

  static final OfflineWarmer instance = OfflineWarmer();

  final BookService _books;
  final CalendarService _calendar;
  final EtiquetteService _etiquette;
  final List<Future<void> Function()> _others;
  final Future<bool> Function() _onWifi;
  final Future<void> Function(String slug) _downloadBook;
  final Future<void> Function(String slug, List<String> chain) _saveShortWork;
  final Future<void> Function({required bool onWifi}) _chantMantra;
  final DateTime Function() _clock;

  Future<void>? _running;

  /// One pass, in [appLanguage] (the calendar) and [readingChain] (etiquette,
  /// short works). Unless [force], a pass within `OfflineConfig.warmInterval`
  /// of the last one that reached the server does nothing. One runs at a time;
  /// a call made while one runs waits for it and is then judged the same way.
  Future<void> warm({required String appLanguage, required List<String> readingChain, bool force = false}) async {
    while (_running != null) {
      await _running;
    }
    if (!force && !_due()) return;

    final pass = _pass(appLanguage, readingChain);
    _running = pass;
    try {
      await pass;
    } finally {
      _running = null;
    }
  }

  bool _due() {
    final at = LocalStore.instance.read<int>(BoxKeys.offlineWarmedAt);
    if (at == null) return true;
    return _clock().difference(DateTime.fromMillisecondsSinceEpoch(at)) >= OfflineConfig.warmInterval;
  }

  Future<void> _pass(String appLanguage, List<String> chain) async {
    // The book list goes first and says whether the server is there at all:
    // when it is not, the service hands back the saved copy, whose time does
    // not change, and the pass stops without counting.
    final before = ResponseCache.instance.read(ApiPaths.books, null)?.savedAt;
    final books = await _quietly(_books.list);
    final after = ResponseCache.instance.read(ApiPaths.books, null)?.savedAt;
    if (books == null || after == null || after == before) return;

    final wifi = await _quietly(_onWifi) ?? false;
    await _warmBooks(books, chain, wifi: wifi);
    await _warmCalendar(appLanguage);
    await _warmEtiquette(chain);
    await _quietly(() => _chantMantra(onWifi: wifi));
    await _inBatches(_others, (step) => step());

    await LocalStore.instance.write(BoxKeys.offlineWarmedAt, _clock().millisecondsSinceEpoch);
  }

  Future<void> _warmBooks(List<Book> books, List<String> chain, {required bool wifi}) async {
    for (final book in books) {
      await _quietly(() => _books.get(book.slug));
      await _quietly(() => _books.languages(book.slug));

      if (book.hasCantos) {
        final cantos = await _quietly(() => _books.cantos(book.slug)) ?? const <BookSection>[];
        await _inBatches(cantos, (canto) => _books.chapters(book.slug, canto: canto.number));
      } else if (book.totalChapters > 0) {
        await _quietly(() => _books.chapters(book.slug));
      } else {
        // A short work is not in the weekly export: it is saved whole.
        await _quietly(() => _saveShortWork(book.slug, chain));
        continue;
      }

      // Not waited on: the download queue runs at its own pace, holds still
      // when the network is not allowed, and carries on after a restart.
      if (wifi) unawaited(_quietly(() => _downloadBook(book.slug)));
    }
  }

  Future<void> _warmCalendar(String language) async {
    final now = _clock();
    await Future.wait([
      for (var i = -OfflineConfig.calendarMonthsBefore; i <= OfflineConfig.calendarMonthsAfter; i++)
        _quietly(() => _calendar.month(DateTime(now.year, now.month + i), language: language)),
      _quietly(() => _calendar.upcoming(language: language)),
    ]);
  }

  Future<void> _warmEtiquette(List<String> chain) async {
    await _quietly(() => _etiquette.today(chain));
    final list = await _quietly(() => _etiquette.list(chain));
    if (list == null) return;

    final now = _clock();
    final due = [
      for (final item in list.items)
        if (_etiquette.itemSavedAt(item.id, chain) case final at
            when at == null || now.difference(at) >= OfflineConfig.itemRefreshAfter)
          item.id,
    ];
    await _inBatches(due, (id) => _etiquette.item(id, chain));
  }

  /// [step] for each of [items], `OfflineConfig.warmConcurrency` at a time.
  static Future<void> _inBatches<T>(List<T> items, Future<void> Function(T item) step) async {
    for (var i = 0; i < items.length; i += OfflineConfig.warmConcurrency) {
      await Future.wait([
        for (final item in items.skip(i).take(OfflineConfig.warmConcurrency)) _quietly(() => step(item)),
      ]);
    }
  }

  static Future<T?> _quietly<T>(Future<T> Function() step) async {
    try {
      return await step();
    } catch (error) {
      if (kDebugMode) debugPrint('[OfflineWarmer] $error');
      return null;
    }
  }

  static Future<bool> _wifi() async {
    final results = await Connectivity().checkConnectivity();
    return results.any((r) => r == ConnectivityResult.wifi || r == ConnectivityResult.ethernet);
  }

  /// Today's practice, and the mantra it chants in full — what the counter
  /// opens on — and on Wi-Fi that mantra's mala recording, so the chant along
  /// plays with no connection.
  static Future<void> _readersMantra({required bool onWifi}) async {
    final slug = (await SadhanaService.instance.today()).chantMantraSlug;
    if (slug == null) return;
    final mantra = await MantraService.instance.get(slug);
    if (onWifi && mantra.hasMalaAudio) await MalaAudioCache.instance.save(mantra.malaAudioUrl!);
  }

  /// What the other screens open on. Each saves its own answer.
  static List<Future<void> Function()> _everyScreenStart() => [
        MantraService.instance.categories,
        MantraService.instance.list,
        ReelService.instance.bookStyle,
        IssueService.instance.list,
        ReferenceService.instance.languages,
        UserService.instance.summary,
        FavoriteService.instance.list,
        SlokaService.instance.moodToday,
      ];
}
