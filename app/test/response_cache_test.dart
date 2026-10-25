// Answers kept for offline use (`ResponseCache`, `getOrSaved`): what is saved,
// when the saved copy stands in for the network, and when it must not. The
// server is a scripted `HttpClientAdapter`; the box is in memory.

import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/constants/api_paths.dart';
import 'package:hariharibol/core/constants/offline_config.dart';
import 'package:hariharibol/models/api_failure.dart';
import 'package:hariharibol/services/api_client.dart';
import 'package:hariharibol/services/calendar_service.dart';
import 'package:hariharibol/services/etiquette_service.dart';
import 'package:hariharibol/services/local_store.dart';
import 'package:hariharibol/services/response_cache.dart';

/// Answers every request with [status] and [data], or as a dropped connection
/// while [online] is false.
class _Server implements HttpClientAdapter {
  final List<RequestOptions> requests = [];
  bool online = true;
  int status = 200;
  Object? data;

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
    final body = status < 400
        ? {'success': true, 'data': data}
        : {
            'success': false,
            'error': {'code': status == 404 ? 'NOT_FOUND' : 'SERVER_ERROR', 'message': 'no'},
          };
    return ResponseBody.fromString(jsonEncode(body), status, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });
  }

  @override
  void close({bool force = false}) {}
}

Map<String, dynamic> _item(String id, {String body = ''}) => {
      'id': id,
      'slug': id,
      'category': 'temple',
      'title': 'Title $id',
      'summary': 'Summary $id',
      'body': body,
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory dir;
  late _Server server;
  late ApiClient api;
  final cache = ResponseCache.instance;

  setUpAll(() async {
    dir = await Directory.systemTemp.createTemp('hariharibol_response_cache');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/path_provider'),
      (call) async => dir.path,
    );
    await LocalStore.instance.init();
    await cache.openInMemory();
  });

  tearDownAll(() {
    if (dir.existsSync()) dir.deleteSync(recursive: true);
  });

  setUp(() async {
    await cache.clear();
    server = _Server();
    api = ApiClient.forTesting(adapter: server);
  });

  group('getOrSaved', () {
    test('a successful answer is saved under its path and query', () async {
      server.data = {'n': 1};
      await api.getOrSaved(ApiPaths.books, query: {'a': 1});

      expect(api.saved(ApiPaths.books, query: {'a': 1})?.data, {'n': 1});
      expect(api.saved(ApiPaths.books), isNull, reason: 'another query is another answer');
    });

    test('with no connection the saved answer comes back in its place', () async {
      server.data = ['gita'];
      await api.getOrSaved(ApiPaths.books);

      server.online = false;
      final response = await api.getOrSaved(ApiPaths.books);
      expect(response.data, ['gita']);
    });

    test('a 5xx is covered by the saved answer too', () async {
      server.data = ['gita'];
      await api.getOrSaved(ApiPaths.books);

      server.status = 503;
      expect((await api.getOrSaved(ApiPaths.books)).data, ['gita']);
    });

    test('a real answer such as a 404 is never covered up', () async {
      server.data = ['gita'];
      await api.getOrSaved(ApiPaths.books);

      server.status = 404;
      await expectLater(
        api.getOrSaved(ApiPaths.books),
        throwsA(isA<ApiFailure>().having((f) => f.kind, 'kind', FailureKind.notFound)),
      );
    });

    test('with nothing saved the failure is thrown as before', () async {
      server.online = false;
      await expectLater(
        api.getOrSaved(ApiPaths.books),
        throwsA(isA<ApiFailure>().having((f) => f.kind, 'kind', FailureKind.network)),
      );
    });

    test('a newer answer replaces the saved one', () async {
      server.data = ['gita'];
      await api.getOrSaved(ApiPaths.books);
      server.data = ['gita', 'bhagavatam'];
      await api.getOrSaved(ApiPaths.books);

      expect(api.saved(ApiPaths.books)?.data, ['gita', 'bhagavatam']);
    });
  });

  group('the box', () {
    test('a query is one key whatever its order, and a null is no parameter', () {
      expect(ResponseCache.keyFor('/p', {'b': 2, 'a': 1, 'c': null}), '/p?a=1&b=2');
      expect(ResponseCache.keyFor('/p', {'c': null}), '/p');
      expect(ResponseCache.keyFor('/p', null), '/p');
    });

    test('an answer too long to keep is not saved', () async {
      await cache.save('/long', null, 'x' * (OfflineConfig.maxSavedResponseLength + 1), null);
      expect(cache.read('/long', null), isNull);
    });

    test('past the limit the oldest go, the newest stays', () async {
      for (var i = 0; i < OfflineConfig.maxSavedResponses; i++) {
        await cache.save('/old/$i', null, i, null);
      }
      await Future<void>.delayed(const Duration(milliseconds: 5));
      await cache.save('/newest', null, 'new', null);

      final kept = [
        for (var i = 0; i < OfflineConfig.maxSavedResponses; i++)
          if (cache.read('/old/$i', null) != null) i,
      ];
      // The box goes back to a batch under the limit, the newest among them.
      expect(kept.length + 1, OfflineConfig.maxSavedResponses - OfflineConfig.evictBatch);
      expect(cache.read('/newest', null)?.data, 'new');
    });

    test('clear wipes everything (sign-out)', () async {
      await cache.save('/a', null, 1, {'page': 1});
      expect(cache.read('/a', null)?.meta, {'page': 1});

      await cache.clear();
      expect(cache.read('/a', null), isNull);
    });
  });

  group('what services hand back saved', () {
    test('the upcoming festivals leave out the days gone by', () async {
      final calendar = CalendarService.forTesting(api);
      server.data = {
        'festivals': [
          {'date': '2026-10-20', 'slug': 'past', 'kind': 'FESTIVAL', 'name': 'Past'},
          {'date': '2026-10-25', 'slug': 'today', 'kind': 'FESTIVAL', 'name': 'Today'},
          {'date': '2026-11-02', 'slug': 'later', 'kind': 'EKADASHI', 'name': 'Later'},
        ],
      };
      await calendar.upcoming(language: 'mr');

      final saved = calendar.savedUpcoming(language: 'mr', now: DateTime(2026, 10, 25, 9));
      expect(saved?.map((f) => f.slug), ['today', 'later']);
      expect(calendar.savedUpcoming(language: 'hi'), isNull, reason: 'saved in another language');
    });

    test('a month is saved under its own dates and language', () async {
      final calendar = CalendarService.forTesting(api);
      server.data = {'today': '2026-10-25', 'location': {'name': 'New Delhi'}, 'days': [], 'festivals': []};
      await calendar.month(DateTime(2026, 10), language: 'en');

      expect(server.requests.single.queryParameters, {'from': '2026-10-01', 'to': '2026-10-31', 'language': 'en'});
      expect(calendar.savedMonth(DateTime(2026, 10, 17), language: 'en')?.placeName, 'New Delhi');
      expect(calendar.savedMonth(DateTime(2026, 11), language: 'en'), isNull);
    });

    test('an etiquette item never opened comes from today, then from the list', () async {
      final etiquette = EtiquetteService.forTesting(api);
      const chain = ['hi', 'en'];

      server.data = {'date': '2026-10-25', 'item': _item('e1', body: 'Long text')};
      await etiquette.today(chain);
      server.data = {
        'categories': [],
        'items': [_item('e1'), _item('e2')],
      };
      await etiquette.list(chain);

      expect(etiquette.savedItem('e1', chain)?.body, 'Long text');
      expect(etiquette.savedItem('e2', chain)?.title, 'Title e2');
      expect(etiquette.savedItem('e3', chain), isNull);
      expect(etiquette.itemSavedAt('e2', chain), isNull, reason: 'its own page was never saved');

      server.data = _item('e2', body: 'Full e2');
      await etiquette.item('e2', chain);
      expect(etiquette.savedItem('e2', chain)?.body, 'Full e2');
      expect(etiquette.itemSavedAt('e2', chain), isNotNull);
    });
  });
}
