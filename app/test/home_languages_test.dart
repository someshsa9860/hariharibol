// The dashboard follows the reading language. A phone changes its own reading
// language at once and tells the account a moment later, so Home used to come
// back in the language just left; the call now names the languages itself, the
// saved copy is only used in the language it was made for, and the feed is built
// again the moment the reading language changes.
//
// The server is a scripted `HttpClientAdapter`. Its `date` field stands in for
// "what language this was shaped in": it echoes the `languages` it was asked for.

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/constants/storage_keys.dart';
import 'package:hariharibol/models/home_feed.dart';
import 'package:hariharibol/providers/home_provider.dart';
import 'package:hariharibol/providers/language_settings_provider.dart';
import 'package:hariharibol/services/api_client.dart';
import 'package:hariharibol/services/home_service.dart';
import 'package:hariharibol/services/local_store.dart';
import 'package:hive_ce_flutter/hive_flutter.dart';

class _Server implements HttpClientAdapter {
  final List<RequestOptions> requests = [];

  /// Keyed by the first language asked for. An answer waits on its gate, to make
  /// two requests finish out of order.
  final Map<String, Completer<void>> gates = {};

  /// First languages for which the server cannot be reached.
  final Set<String> down = {};

  String _asked(RequestOptions options) => (options.queryParameters['languages'] as String?) ?? '';

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final asked = _asked(options);
    final first = asked.split(',').first;
    await gates[first]?.future;
    if (down.contains(first)) {
      throw DioException(requestOptions: options, type: DioExceptionType.connectionError);
    }
    return ResponseBody.fromString(
      jsonEncode({
        'success': true,
        'data': {'date': asked},
      }),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory dir;
  late _Server server;
  late HomeService service;

  setUpAll(() async {
    dir = await Directory.systemTemp.createTemp('hariharibol_home_languages');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/path_provider'),
      (call) async => dir.path,
    );
    await LocalStore.instance.init();
  });

  tearDownAll(() async {
    await Hive.close();
    if (dir.existsSync()) dir.deleteSync(recursive: true);
  });

  setUp(() async {
    await LocalStore.instance.clear();
    server = _Server();
    service = HomeService.forTesting(ApiClient.forTesting(adapter: server));
  });

  group('the service', () {
    test('asks for the reading chain', () async {
      final feed = await service.fetch(languages: ['hi', 'en']);
      expect(server.requests.single.queryParameters, {'languages': 'hi,en'});
      expect(feed.date, 'hi,en');
    });

    test('no languages, no parameter — the account\'s own stand', () async {
      await service.fetch();
      expect(server.requests.single.queryParameters, isEmpty);
    });

    test('the saved copy is only offered in the language it was made for', () async {
      await service.fetch(languages: ['hi', 'en']);

      expect(service.cached(languages: ['hi', 'en'])?.date, 'hi,en');
      expect(service.cached(languages: ['mr', 'en']), isNull);
      expect(service.cached(languages: ['hi', 'ta', 'en']), isNull);
    });

    test('asked for with no language, any saved copy will do', () async {
      await service.fetch(languages: ['hi', 'en']);
      expect(service.cached()?.date, 'hi,en');
    });

    test('nothing saved, nothing offered', () {
      expect(service.cached(), isNull);
      expect(service.cached(languages: ['en']), isNull);
    });
  });

  group('the provider', () {
    /// A Home tab that reads in [code]: the choice is stored first, as it is on a
    /// phone that has already been used, then the feed is listened to.
    Future<ProviderContainer> reading(String code) async {
      await LocalStore.instance.write(BoxKeys.languageReading, code);
      final c = ProviderContainer(overrides: [homeServiceProvider.overrideWithValue(service)]);
      addTearDown(c.dispose);
      c.listen(homeFeedProvider, (_, _) {});
      return c;
    }

    String language(AsyncValue<HomeFeed> feed) => feed.requireValue.date.split(',').first;

    test('is built in the reader\'s reading chain', () async {
      final c = await reading('hi');
      expect(language(AsyncData(await c.read(homeFeedProvider.future))), 'hi');
    });

    test('changing the reading language builds it again at once, in the new one', () async {
      final c = await reading('hi');
      await c.read(homeFeedProvider.future);

      await c.read(languageSettingsProvider.notifier).setReading('mr');
      final feed = await c.read(homeFeedProvider.future);

      expect(feed.date.split(',').first, 'mr');
      expect(server.requests.last.queryParameters['languages'], startsWith('mr'));
    });

    test('while the new language loads, the old screen stays', () async {
      final c = await reading('hi');
      await c.read(homeFeedProvider.future);

      final gate = server.gates['mr'] = Completer<void>();
      await c.read(languageSettingsProvider.notifier).setReading('mr');
      await Future<void>.delayed(Duration.zero);

      final during = c.read(homeFeedProvider);
      expect(during.isLoading, isTrue);
      expect(language(during), 'hi', reason: 'the view keeps this on screen rather than a spinner');

      gate.complete();
      expect(language(AsyncData(await c.read(homeFeedProvider.future))), 'mr');
    });

    test('a saved copy in the same language is shown first, then refreshed', () async {
      await (await reading('hi')).read(homeFeedProvider.future);
      server.requests.clear();

      // The next launch: a fresh container, the copy already on the phone, and
      // the network held up. The copy is what the first frame draws.
      final gate = server.gates['hi'] = Completer<void>();
      final c = await reading('hi');
      expect(language(AsyncData(await c.read(homeFeedProvider.future))), 'hi');

      await Future<void>.delayed(const Duration(milliseconds: 20));
      expect(server.requests, hasLength(1), reason: 'and it is replaced when the network answers');
      gate.complete();
    });

    test('a saved copy in another language is never shown as the answer', () async {
      await (await reading('hi')).read(homeFeedProvider.future);

      // The phone now reads Marathi; the only copy saved is Hindi.
      server.gates['mr'] = Completer<void>();
      final c = await reading('mr');
      await Future<void>.delayed(Duration.zero);

      expect(c.read(homeFeedProvider).hasValue, isFalse, reason: 'Hindi must not stand in for Marathi');
      server.gates['mr']!.complete();
      expect(language(AsyncData(await c.read(homeFeedProvider.future))), 'mr');
    });

    test('an answer in the language just left cannot land on the one chosen', () async {
      await (await reading('hi')).read(homeFeedProvider.future);

      // The next launch draws the saved Hindi copy and refreshes it, slowly...
      final slow = server.gates['hi'] = Completer<void>();
      final c = await reading('hi');
      await c.read(homeFeedProvider.future);

      // ...the reader switches to Marathi while that is still away...
      await c.read(languageSettingsProvider.notifier).setReading('mr');
      expect(language(AsyncData(await c.read(homeFeedProvider.future))), 'mr');

      // ...and the Hindi answer arrives late.
      slow.complete();
      await Future<void>.delayed(const Duration(milliseconds: 20));
      expect(language(c.read(homeFeedProvider)), 'mr');
    });

    test('offline in a new language, the last screen stays rather than an error', () async {
      final c = await reading('hi');
      await c.read(homeFeedProvider.future);

      server.down.add('mr');
      await c.read(languageSettingsProvider.notifier).setReading('mr');
      final feed = await c.read(homeFeedProvider.future);

      expect(feed.date.split(',').first, 'hi', reason: 'true but in the language left beats an error');
    });
  });
}
