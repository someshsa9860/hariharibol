import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/constants/storage_keys.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/api_failure.dart';
import 'package:hariharibol/models/own_mantra.dart';
import 'package:hariharibol/providers/own_mantra_provider.dart';
import 'package:hariharibol/services/api_client.dart';
import 'package:hariharibol/services/local_store.dart';
import 'package:hariharibol/services/own_mantra_service.dart';
import 'package:hariharibol/widgets/mantra/own_mantra_problem.dart';
import 'package:hive_ce_flutter/hive_flutter.dart';

import 'support/fake_own_mantra_service.dart';

/// One answer the scripted server gives: a status and a JSON body. Status 0 is
/// no connection at all.
class Reply {
  const Reply(this.status, [this.body = const {}]);

  final int status;
  final Object body;
}

class Recorded {
  Recorded(this.path, this.method, this.data);

  final String path;
  final String method;
  final Object? data;
}

class ScriptedServer implements HttpClientAdapter {
  final List<Reply> script = [];
  final List<Recorded> seen = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    seen.add(Recorded(options.path, options.method, options.data));
    final reply = script.removeAt(0);
    if (reply.status == 0) {
      throw DioException(
        requestOptions: options,
        type: DioExceptionType.connectionError,
        error: const SocketException('no route'),
      );
    }
    final text = reply.status == 204 ? '' : jsonEncode(reply.body);
    return ResponseBody.fromString(
      text,
      reply.status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

Reply ok(int status, Object data) => Reply(status, {'success': true, 'data': data});

Reply refused(int status, String code) => Reply(status, {
      'success': false,
      'error': {'code': code, 'message': 'SELECT secret FROM server'},
    });

Map<String, dynamic> suggestionJson(int index, {String status = 'new', String? slug}) => {
      'index': index,
      'name': 'Mantra $index',
      'sanskrit': 'sanskrit $index',
      'transliteration': 'translit $index',
      'kind': 'saint',
      'addressedTo': 'Saint $index',
      'status': status,
      'slug': ?slug,
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory dir;

  setUpAll(() async {
    dir = await Directory.systemTemp.createTemp('hariharibol_own_mantra');
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

  setUp(() => LocalStore.instance.clear());

  group('the models', () {
    test('only a new or shared suggestion can be picked; a held one opens', () {
      expect(suggestion(0).canPick, isTrue);
      expect(suggestion(0, status: 'shared').canPick, isTrue);
      expect(suggestion(0, status: 'yours', slug: 'a').canPick, isFalse);
      expect(suggestion(0, status: 'catalog', slug: 'a').canPick, isFalse);

      expect(suggestion(0, status: 'yours', slug: 'a').canOpen, isTrue);
      expect(suggestion(0, status: 'catalog').canOpen, isFalse, reason: 'nothing to open without a slug');
      expect(suggestion(0, slug: 'a').canOpen, isFalse, reason: 'a pickable one is added, not opened');
    });

    test('a saint is told apart from a deity', () {
      expect(suggestion(0, kind: 'saint').isSaint, isTrue);
      expect(suggestion(0).isSaint, isFalse);
    });

    test('a suggestion with little in it still reads', () {
      final item = MantraSuggestion.fromJson({'index': 3, 'name': 'Om'});
      expect(item.index, 3);
      expect(item.kind, 'deity');
      expect(item.status, 'new');
      expect(item.slug, isNull);
    });

    test('the answer to a search tolerates a missing or odd list', () {
      expect(MantraSuggestions.fromJson({'suggestionId': 'x'}).items, isEmpty);
      expect(MantraSuggestions.fromJson({'items': 'nope'}).items, isEmpty);

      final found = MantraSuggestions.fromJson({
        'suggestionId': 'abc',
        'items': [suggestionJson(0), 'junk', suggestionJson(1, status: 'catalog', slug: 's')],
      });
      expect(found.suggestionId, 'abc');
      expect(found.items.map((item) => item.index), [0, 1]);
      expect(found.items.last.slug, 's');
    });

    test('a result says whether it was added and whether the picture can change', () {
      final mine = ownMantra('a');
      expect(OwnMantraResult(index: 0, status: 'created', mantra: mine).added, isTrue);
      expect(OwnMantraResult(index: 0, status: 'shared', mantra: mine).added, isTrue);
      expect(OwnMantraResult(index: 0, status: 'already', mantra: mine).added, isTrue);
      expect(const OwnMantraResult(index: 0, status: 'failed').added, isFalse);

      expect(OwnMantraResult(index: 0, status: 'created', mantra: mine).canChangePicture, isTrue);
      expect(
        OwnMantraResult(index: 0, status: 'created', mantra: ownMantra('a', mine: false)).canChangePicture,
        isFalse,
        reason: 'a reader who only shares it cannot change it',
      );
      expect(OwnMantraResult(index: 0, status: 'shared', mantra: mine).canChangePicture, isFalse);
      expect(const OwnMantraResult(index: 0, status: 'created').canChangePicture, isFalse);
    });

    test('a result with nothing in it counts as failed, and swaps its mantra', () {
      final result = OwnMantraResult.fromJson({'index': 2});
      expect(result.status, 'failed');
      expect(result.mantra, isNull);

      final next = OwnMantraResult(index: 1, status: 'created', mantra: ownMantra('a'))
          .withMantra(ownMantra('a', imageUrl: 'https://x/y.jpg'));
      expect(next.index, 1);
      expect(next.status, 'created');
      expect(next.mantra!.imageUrl, 'https://x/y.jpg');
    });

    test('a mantra cached before own mantras existed is public and not the reader\'s', () {
      final old = ownMantra('a');
      expect(old.isPrivate, isTrue);

      final cached = ownMantra('b', type: 'PUBLIC', mine: false);
      expect(cached.isPrivate, isFalse);
      expect(cached.imageUrl, isNull);

      // The answer an older server sends has none of the three keys.
      final bare = ownMantra('c');
      final json = <String, dynamic>{'id': bare.id, 'slug': 'c', 'name': 'n', 'text': 't'};
      final plain = ownMantra('c', type: 'PUBLIC', mine: false);
      expect(plain.isMine, isFalse);
      expect(json.containsKey('mantraType'), isFalse);
    });

    test('the picture is cached under its address without the signature', () {
      expect(
        ownMantra('a', imageUrl: 'https://cdn.example/m/a.jpg?X-Amz-Signature=abc&Expires=9').imageCacheKey,
        'https://cdn.example/m/a.jpg',
      );
      expect(ownMantra('a').imageCacheKey, isNull);
    });
  });

  group('what a reader is told', () {
    final text = lookupAppLocalizations(const Locale('en'));

    String say(ApiFailure failure) => ownMantraProblem(text, failure);

    test('a code is worded by the app, never by the server', () {
      expect(
        say(const ApiFailure(kind: FailureKind.validation, code: 'MANTRA_INPUT_NOT_USABLE', message: 'SELECT secret')),
        text.ownMantraErrorNotUsable,
      );
      expect(
        say(const ApiFailure(kind: FailureKind.conflict, code: 'MANTRA_LIMIT', message: 'SELECT secret')),
        text.ownMantraErrorLimit,
      );
      expect(
        say(const ApiFailure(kind: FailureKind.server, code: 'MANTRA_AI_UNAVAILABLE', message: 'SELECT secret')),
        text.ownMantraErrorUnavailable,
      );
      expect(
        say(const ApiFailure(kind: FailureKind.validation, code: 'IMAGE_NOT_USABLE', message: 'SELECT secret')),
        text.ownMantraPictureNotUsable,
      );
      expect(
        say(const ApiFailure(kind: FailureKind.unknown, code: 'IMAGE_TOO_LARGE', message: 'SELECT secret')),
        text.ownMantraPictureTooLarge,
      );
    });

    test('410 and 413 are worded from the status, which the client has no kind for', () {
      expect(
        say(const ApiFailure(kind: FailureKind.unknown, statusCode: 410, message: 'SELECT secret')),
        text.ownMantraErrorExpired,
      );
      expect(
        say(const ApiFailure(kind: FailureKind.unknown, statusCode: 413, message: 'SELECT secret')),
        text.ownMantraPictureTooLarge,
      );
    });

    test('a limit, a refusal and everything else', () {
      expect(say(const ApiFailure(kind: FailureKind.rateLimited)), text.ownMantraErrorLimitReached);
      expect(say(const ApiFailure(kind: FailureKind.forbidden)), text.ownMantraPictureForbidden);
      expect(say(const ApiFailure(kind: FailureKind.network)), text.errorNetwork);
      expect(say(const ApiFailure(kind: FailureKind.timeout)), text.errorTimeout);
      expect(
        say(const ApiFailure(kind: FailureKind.server, message: 'SELECT secret FROM server')),
        text.errorGeneric,
        reason: 'the server\'s own words never reach the reader',
      );
    });
  });

  group('the service', () {
    late ScriptedServer server;
    late OwnMantraService service;

    setUp(() {
      server = ScriptedServer();
      service = OwnMantraService.forTesting(ApiClient.forTesting(adapter: server));
    });

    test('a search sends the words as written and reads the suggestions', () async {
      server.script.add(ok(200, {
        'suggestionId': 'sg-1',
        'items': [suggestionJson(0), suggestionJson(1, status: 'catalog', slug: 'om-namah-shivaya')],
      }));

      final found = await service.suggest('hanuman chalisa');

      expect(server.seen.single.path, '/api/app/mantras/own/suggest');
      expect(server.seen.single.method, 'POST');
      expect(server.seen.single.data, {'text': 'hanuman chalisa'});
      expect(found.suggestionId, 'sg-1');
      expect(found.items, hasLength(2));
      expect(found.items.last.canOpen, isTrue);
    });

    test('a search that found nothing is an empty list, not an error', () async {
      server.script.add(ok(200, {'items': []}));

      final found = await service.suggest('xyz');

      expect(found.items, isEmpty);
      expect(found.suggestionId, '');
    });

    test('choosing sends the handle and the numbers, and reads what became of each', () async {
      server.script.add(ok(201, {
        'items': [
          {
            'index': 0,
            'status': 'created',
            'mantra': {'id': 'm1', 'slug': 'a', 'name': 'A', 'text': 't', 'mantraType': 'PRIVATE', 'isMine': true},
          },
          {'index': 2, 'status': 'failed', 'mantra': null},
          'junk',
        ],
      }));

      final results = await service.create('sg-1', [0, 2]);

      expect(server.seen.single.path, '/api/app/mantras/own');
      expect(server.seen.single.data, {'suggestionId': 'sg-1', 'picks': [0, 2]});
      expect(results, hasLength(2));
      expect(results.first.canChangePicture, isTrue);
      expect(results.last.added, isFalse);
    });

    test('choosing forgets the saved mantra lists, so the new one is on the Jap tab', () async {
      final key = BoxKeys.mantraDetail('om');
      await LocalStore.instance.write(key, 'cached');
      expect(LocalStore.instance.read<String>(key), 'cached');
      server.script.add(ok(201, {'items': []}));

      await service.create('sg-1', [0]);

      expect(LocalStore.instance.read<String>(key), isNull);
    });

    test('a refused choice throws a failure carrying its status and code', () async {
      server.script.add(refused(410, 'GONE'));

      await expectLater(
        service.create('sg-1', [0]),
        throwsA(isA<ApiFailure>().having((f) => f.statusCode, 'status', 410).having((f) => f.code, 'code', 'GONE')),
      );
    });

    test('a refused search keeps the code the app words it by', () async {
      server.script.add(refused(422, 'MANTRA_INPUT_NOT_USABLE'));

      await expectLater(
        service.suggest('?'),
        throwsA(isA<ApiFailure>().having((f) => f.code, 'code', 'MANTRA_INPUT_NOT_USABLE')),
      );
    });

    test('no connection is a network failure', () async {
      server.script.add(const Reply(0));

      await expectLater(
        service.suggest('om'),
        throwsA(isA<ApiFailure>().having((f) => f.kind, 'kind', FailureKind.network)),
      );
    });

    test('a picture goes up as the bytes of one PUT and comes back as the mantra', () async {
      final bytes = Uint8List.fromList([1, 2, 3, 4]);
      await LocalStore.instance.write(BoxKeys.mantraDetail('a'), 'cached');
      server.script.add(ok(200, {
        'id': 'm1',
        'slug': 'a',
        'name': 'A',
        'text': 't',
        'mantraType': 'PRIVATE',
        'isMine': true,
        'imageUrl': 'https://cdn.example/a.jpg?sig=1',
      }));

      final mantra = await service.changeImage('a', bytes);

      expect(server.seen.single.path, '/api/app/mantras/own/a/image');
      expect(server.seen.single.method, 'PUT');
      expect(server.seen.single.data, bytes);
      expect(mantra.imageUrl, 'https://cdn.example/a.jpg?sig=1');
      expect(LocalStore.instance.read<String>(BoxKeys.mantraDetail('a')), isNull);
    });

    test('a picture that is too large is refused with its status', () async {
      server.script.add(refused(413, 'IMAGE_TOO_LARGE'));

      await expectLater(
        service.changeImage('a', Uint8List(4)),
        throwsA(isA<ApiFailure>().having((f) => f.statusCode, 'status', 413)),
      );
    });

    test('leaving is a DELETE that answers with nothing', () async {
      await LocalStore.instance.write(BoxKeys.mantraDetail('a'), 'cached');
      server.script.add(const Reply(204));

      await service.leave('a');

      expect(server.seen.single.path, '/api/app/mantras/own/a');
      expect(server.seen.single.method, 'DELETE');
      expect(LocalStore.instance.read<String>(BoxKeys.mantraDetail('a')), isNull);
    });
  });

  group('the add flow', () {
    late FakeOwnMantraService fake;
    late ProviderContainer container;

    OwnMantraNotifier notifier() => container.read(ownMantraProvider.notifier);
    OwnMantraState state() => container.read(ownMantraProvider);

    setUp(() {
      fake = FakeOwnMantraService()
        ..found = MantraSuggestions(suggestionId: 'sg-1', items: [
          for (var i = 0; i < 6; i++) suggestion(i),
          suggestion(6, status: 'yours', slug: 'held'),
        ]);
      container = ProviderContainer(
        overrides: [ownMantraServiceProvider.overrideWithValue(fake)],
        retry: (_, _) => null,
      );
      addTearDown(container.dispose);
      container.listen(ownMantraProvider, (_, _) {});
    });

    test('it starts at the input', () {
      expect(state().stage, OwnMantraStage.input);
      expect(state().busy, isFalse);
      expect(state().canAdd, isFalse);
    });

    test('a search moves to choosing with what it found, trimmed', () async {
      await notifier().search('  hanuman  ');

      expect(fake.searched, ['hanuman']);
      expect(state().stage, OwnMantraStage.choosing);
      expect(state().text, 'hanuman');
      expect(state().suggestions!.items, hasLength(7));
      expect(state().failure, isNull);
    });

    test('empty words, and a search already going, are ignored', () async {
      await notifier().search('   ');
      expect(fake.searched, isEmpty);
      expect(state().stage, OwnMantraStage.input);

      fake.holdSearch = Completer<MantraSuggestions>();
      final first = notifier().search('one');
      await Future<void>.delayed(Duration.zero);
      expect(state().stage, OwnMantraStage.suggesting);
      expect(state().busy, isTrue);

      await notifier().search('two');
      expect(fake.searched, ['one']);

      fake.holdSearch!.complete(fake.found);
      await first;
      expect(state().stage, OwnMantraStage.choosing);
    });

    test('a failed search goes back to the input with the reason', () async {
      fake.searchFailure = const ApiFailure(kind: FailureKind.validation, code: 'MANTRA_INPUT_NOT_USABLE');

      await notifier().search('?!');

      expect(state().stage, OwnMantraStage.input);
      expect(state().failure!.code, 'MANTRA_INPUT_NOT_USABLE');
      expect(state().suggestions, isNull);
    });

    test('five can be chosen, a sixth cannot, and one can be taken back', () async {
      await notifier().search('om');
      final items = state().suggestions!.items;

      for (var i = 0; i < 5; i++) {
        notifier().toggle(items[i]);
      }
      expect(state().picked, {0, 1, 2, 3, 4});
      expect(state().atMostPicked, isTrue);

      notifier().toggle(items[5]);
      expect(state().picked, {0, 1, 2, 3, 4}, reason: 'a sixth is ignored');

      notifier().toggle(items[2]);
      expect(state().picked, {0, 1, 3, 4});
      expect(state().atMostPicked, isFalse);

      notifier().toggle(items[5]);
      expect(state().picked, {0, 1, 3, 4, 5});
    });

    test('a mantra that is already held cannot be chosen', () async {
      await notifier().search('om');

      notifier().toggle(state().suggestions!.items[6]);

      expect(state().picked, isEmpty);
      expect(state().canAdd, isFalse);
    });

    test('choosing before there is anything to choose does nothing', () async {
      notifier().toggle(suggestion(0));
      await notifier().addChosen();

      expect(state().picked, isEmpty);
      expect(fake.created, isEmpty);
    });

    test('adding sends the numbers in order and ends on the results', () async {
      fake.made = [
        OwnMantraResult(index: 0, status: 'created', mantra: ownMantra('a')),
        OwnMantraResult(index: 2, status: 'shared', mantra: ownMantra('b', mine: false)),
      ];
      await notifier().search('om');
      notifier().toggle(state().suggestions!.items[2]);
      notifier().toggle(state().suggestions!.items[0]);
      expect(state().canAdd, isTrue);

      await notifier().addChosen();

      expect(fake.createdFor, ['sg-1']);
      expect(fake.created.single, [0, 2]);
      expect(state().stage, OwnMantraStage.done);
      expect(state().results, hasLength(2));
    });

    test('suggestions that expired send the reader back to search again, keeping the words', () async {
      fake.createFailure = const ApiFailure(kind: FailureKind.unknown, statusCode: 410);
      await notifier().search('om');
      notifier().toggle(state().suggestions!.items[0]);

      await notifier().addChosen();

      expect(state().stage, OwnMantraStage.input);
      expect(state().text, 'om');
      expect(state().suggestions, isNull);
      expect(state().picked, isEmpty);
      expect(state().failure!.statusCode, 410);
    });

    test('any other failure keeps the choices so the reader can try again', () async {
      fake.createFailure = const ApiFailure(kind: FailureKind.server, code: 'MANTRA_AI_UNAVAILABLE');
      await notifier().search('om');
      notifier().toggle(state().suggestions!.items[1]);

      await notifier().addChosen();

      expect(state().stage, OwnMantraStage.choosing);
      expect(state().picked, {1});
      expect(state().failure!.code, 'MANTRA_AI_UNAVAILABLE');

      notifier().toggle(state().suggestions!.items[3]);
      expect(state().failure, isNull, reason: 'a new choice clears the old complaint');
    });

    test('a new picture replaces the mantra in its result', () async {
      fake.made = [OwnMantraResult(index: 0, status: 'created', mantra: ownMantra('a'))];
      await notifier().search('om');
      notifier().toggle(state().suggestions!.items[0]);
      await notifier().addChosen();

      notifier().pictureChanged(ownMantra('a', imageUrl: 'https://x/new.jpg'));

      expect(state().results.single.mantra!.imageUrl, 'https://x/new.jpg');
      expect(state().results.single.status, 'created');
    });
  });
}
