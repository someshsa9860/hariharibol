// Fetching ahead for offline use (`OfflineWarmer`): what one pass asks for,
// how often it runs, that a pass which never reached the server is not
// counted, and that books download only on Wi-Fi. The server is a scripted
// `HttpClientAdapter`; the saved answers are the real cache, in memory.

import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/constants/api_paths.dart';
import 'package:hariharibol/core/constants/offline_config.dart';
import 'package:hariharibol/core/constants/storage_keys.dart';
import 'package:hariharibol/services/api_client.dart';
import 'package:hariharibol/services/book_service.dart';
import 'package:hariharibol/services/calendar_service.dart';
import 'package:hariharibol/services/etiquette_service.dart';
import 'package:hariharibol/services/local_store.dart';
import 'package:hariharibol/services/offline_warmer.dart';
import 'package:hariharibol/services/response_cache.dart';

const _chain = ['mr', 'en'];

Map<String, dynamic> _book(String slug, {int cantos = 0, int chapters = 0}) => {
      'id': 'id-$slug',
      'slug': slug,
      'title': slug,
      'type': 'SCRIPTURE',
      'totalCantos': cantos,
      'totalChapters': chapters,
    };

Map<String, dynamic> _item(String id) => {'id': id, 'slug': id, 'category': 'temple', 'title': id, 'summary': id};

/// A library of three books — the Gita (chapters), the Bhagavatam (cantos)
/// and a stotra (neither) — a calendar and two etiquette items. Paths in
/// [failing] answer 500; nothing answers while [online] is false.
class _Server implements HttpClientAdapter {
  final List<RequestOptions> requests = [];
  final Set<String> failing = {};
  bool online = true;

  List<String> get paths => [for (final r in requests) r.path];

  Object? _data(String path) {
    if (path == ApiPaths.books) {
      return [_book('gita', chapters: 18), _book('bhagavatam', cantos: 2, chapters: 4), _book('stotra')];
    }
    if (path.endsWith('/languages')) return ['en', 'mr'];
    if (path.endsWith('/cantos')) {
      return [
        {'id': 'c1', 'number': 1, 'title': 'One'},
        {'id': 'c2', 'number': 2, 'title': 'Two'},
      ];
    }
    if (path.endsWith('/chapters')) return <Object>[];
    if (path.startsWith('${ApiPaths.books}/')) return _book(path.split('/').last);
    if (path == ApiPaths.calendar) return {'today': '2026-10-25', 'days': [], 'festivals': []};
    if (path == ApiPaths.calendarUpcoming) return {'festivals': []};
    if (path == ApiPaths.etiquetteToday) return {'date': '2026-10-25', 'item': _item('e1')};
    if (path == ApiPaths.etiquette) {
      return {
        'categories': [],
        'items': [_item('e1'), _item('e2')],
      };
    }
    if (path.startsWith('${ApiPaths.etiquette}/')) return _item(path.split('/').last);
    return null;
  }

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    requests.add(options);
    if (!online) {
      throw DioException(
        requestOptions: options,
        type: DioExceptionType.connectionError,
        error: const SocketException('Network is unreachable'),
      );
    }
    final fails = failing.contains(options.path);
    final body = fails
        ? {
            'success': false,
            'error': {'code': 'SERVER_ERROR', 'message': 'no'},
          }
        : {'success': true, 'data': _data(options.path)};
    return ResponseBody.fromString(jsonEncode(body), fails ? 500 : 200, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory dir;
  late _Server server;
  late DateTime start;
  late DateTime now;
  late bool wifi;
  late List<String> downloads;
  late List<String> shortWorks;
  late int othersRan;
  late List<bool> chantMantra;
  late OfflineWarmer warmer;

  setUpAll(() async {
    dir = await Directory.systemTemp.createTemp('hariharibol_offline_warmer');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/path_provider'),
      (call) async => dir.path,
    );
    await LocalStore.instance.init();
    await ResponseCache.instance.openInMemory();
  });

  tearDownAll(() {
    if (dir.existsSync()) dir.deleteSync(recursive: true);
  });

  setUp(() async {
    await LocalStore.instance.clear();
    await ResponseCache.instance.clear();
    server = _Server();
    start = DateTime.now();
    now = start;
    wifi = true;
    downloads = [];
    shortWorks = [];
    othersRan = 0;
    chantMantra = [];
    final api = ApiClient.forTesting(adapter: server);
    warmer = OfflineWarmer(
      books: BookService.forTesting(api),
      calendar: CalendarService.forTesting(api),
      etiquette: EtiquetteService.forTesting(api),
      others: [() async => othersRan++],
      onWifi: () async => wifi,
      downloadBook: (slug) async => downloads.add(slug),
      saveShortWork: (slug, chain) async => shortWorks.add('$slug ${chain.join(',')}'),
      chantMantra: ({required onWifi}) async => chantMantra.add(onWifi),
      clock: () => now,
    );
  });

  Future<void> warm({bool force = false}) => warmer.warm(appLanguage: 'mr', readingChain: _chain, force: force);
  int? warmedAt() => LocalStore.instance.read<int>(BoxKeys.offlineWarmedAt);

  test('one pass saves the library\'s shape, the calendar, etiquette and the rest', () async {
    await warm();

    expect(server.paths, containsAll([
      ApiPaths.books,
      ApiPaths.book('gita'), ApiPaths.bookLanguages('gita'), ApiPaths.bookChapters('gita'),
      ApiPaths.book('bhagavatam'), ApiPaths.bookCantos('bhagavatam'),
      ApiPaths.book('stotra'), ApiPaths.bookLanguages('stotra'),
      ApiPaths.calendarUpcoming, ApiPaths.etiquetteToday, ApiPaths.etiquette,
      ApiPaths.etiquetteItem('e1'), ApiPaths.etiquetteItem('e2'),
    ]));
    // A short work has no chapters to ask for: it is saved whole instead.
    expect(server.paths, isNot(contains(ApiPaths.bookChapters('stotra'))));
    expect(shortWorks, ['stotra mr,en']);

    final cantoChapters = [
      for (final r in server.requests)
        if (r.path == ApiPaths.bookChapters('bhagavatam')) r.queryParameters['canto'],
    ];
    expect(cantoChapters, unorderedEquals([1, 2]));

    final months = [
      for (final r in server.requests)
        if (r.path == ApiPaths.calendar) r.queryParameters['from'],
    ];
    expect(months.length, OfflineConfig.calendarMonthsBefore + OfflineConfig.calendarMonthsAfter + 1);
    expect(server.requests.where((r) => r.path == ApiPaths.calendar).map((r) => r.queryParameters['language']).toSet(), {'mr'});

    expect(othersRan, 1);
    expect(chantMantra, [true], reason: "the reader's mantra, with its recording on Wi-Fi");
    expect(downloads, ['gita', 'bhagavatam']);
    expect(warmedAt(), start.millisecondsSinceEpoch);
    expect(ResponseCache.instance.read(ApiPaths.bookChapters('bhagavatam'), {'canto': 2}), isNotNull);
  });

  test('on mobile data no book is queued for download, everything else is saved', () async {
    wifi = false;
    await warm();

    expect(downloads, isEmpty);
    expect(chantMantra, [false], reason: 'the mantra is still saved, its recording is not downloaded');
    expect(shortWorks, ['stotra mr,en']);
    expect(server.paths, contains(ApiPaths.etiquetteItem('e2')));
    expect(warmedAt(), isNotNull);
  });

  test('within the interval a pass does nothing, unless forced', () async {
    await warm();
    server.requests.clear();

    now = start.add(const Duration(hours: 1));
    await warm();
    expect(server.requests, isEmpty);

    await warm(force: true);
    expect(server.paths, contains(ApiPaths.books));

    server.requests.clear();
    now = now.add(OfflineConfig.warmInterval);
    await warm();
    expect(server.paths, contains(ApiPaths.books));
  });

  test('a pass that cannot reach the server stops at once and is not counted', () async {
    await warm();
    final firstDownloads = downloads.length;

    server
      ..requests.clear()
      ..online = false;
    now = start.add(OfflineConfig.warmInterval);
    await warm();

    // The book list came back from the saved copy, so nothing more was asked.
    expect(server.paths, [ApiPaths.books]);
    expect(warmedAt(), start.millisecondsSinceEpoch);
    expect(downloads.length, firstDownloads);
    expect(chantMantra, [true]);

    // Still due, so the next chance with a connection runs.
    server
      ..requests.clear()
      ..online = true;
    await warm();
    expect(server.paths, contains(ApiPaths.etiquette));
    expect(warmedAt(), now.millisecondsSinceEpoch);
  });

  test('with nothing saved and no connection, nothing is counted either', () async {
    server.online = false;
    await warm();

    expect(server.paths, [ApiPaths.books]);
    expect(warmedAt(), isNull);
  });

  test('an etiquette item is asked for again only once its copy is old', () async {
    await warm();
    server.requests.clear();

    now = start.add(const Duration(days: 1));
    await warm(force: true);
    expect(server.paths, contains(ApiPaths.etiquette));
    expect(server.paths, isNot(contains(ApiPaths.etiquetteItem('e1'))));

    server.requests.clear();
    now = start.add(OfflineConfig.itemRefreshAfter + const Duration(hours: 1));
    await warm(force: true);
    expect(server.paths, containsAll([ApiPaths.etiquetteItem('e1'), ApiPaths.etiquetteItem('e2')]));
  });

  test('a step that fails does not stop the rest of the pass', () async {
    server.failing.addAll([ApiPaths.calendar, ApiPaths.bookCantos('bhagavatam')]);
    await warm();

    expect(server.paths, contains(ApiPaths.etiquetteItem('e2')));
    expect(othersRan, 1);
    expect(warmedAt(), isNotNull);
  });

  test('two calls at once make one pass', () async {
    await Future.wait([warm(), warm()]);
    expect(server.paths.where((p) => p == ApiPaths.books).length, 1);
  });
}
