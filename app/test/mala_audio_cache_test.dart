// Mala recordings kept on the phone (`MalaAudioCache`), and the chant along
// playing the kept file instead of the link (`ChantMalaPlayer`), so it plays
// with no connection. The download is a scripted `HttpClientAdapter`; the
// files are real, in a temporary folder.

import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;

import 'package:hariharibol/core/constants/offline_config.dart';
import 'package:hariharibol/services/chant_mala_player.dart';
import 'package:hariharibol/services/chant_mala_timing.dart';
import 'package:hariharibol/services/mala_audio_cache.dart';

import 'fake_audio_player.dart';
import 'fake_connection_status.dart';

const String link = 'https://media.test/uploads/mala.mp3?signature=old';
const String sameLinkResigned = 'https://media.test/uploads/mala.mp3?signature=fresh';

String linkTo(int n) => 'https://media.test/uploads/mala-$n.mp3?signature=s';

/// Sends a few bytes for any link, or drops the connection while [online] is
/// false.
class _Storage implements HttpClientAdapter {
  final List<String> fetched = [];
  bool online = true;

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    fetched.add(options.uri.toString());
    if (!online) {
      throw DioException(
        requestOptions: options,
        type: DioExceptionType.connectionError,
        error: const SocketException('Network is unreachable'),
      );
    }
    return ResponseBody.fromBytes(Uint8List.fromList([1, 2, 3, 4]), 200, headers: {
      Headers.contentTypeHeader: ['audio/mpeg'],
    });
  }

  @override
  void close({bool force = false}) {}
}

/// Waits for the player to reach [phase]; the cache reads real files, so this is
/// not a fixed number of turns of the event loop.
Future<void> untilPhase(ChantMalaPlayer player, ChantMalaPhase phase) async {
  final reached = Completer<void>();
  void check() {
    if (player.state.value.phase == phase && !reached.isCompleted) reached.complete();
  }

  player.state.addListener(check);
  check();
  try {
    await reached.future.timeout(const Duration(seconds: 5));
  } finally {
    player.state.removeListener(check);
  }
}

void main() {
  late Directory tmp;
  late Directory folder;
  late _Storage storage;
  late MalaAudioCache cache;

  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('hariharibol_mala_audio');
    folder = Directory(p.join(tmp.path, 'mala_audio'));
    storage = _Storage();
    cache = MalaAudioCache(directory: () async => folder, dio: Dio()..httpClientAdapter = storage);
  });

  tearDown(() async {
    if (tmp.existsSync()) await tmp.delete(recursive: true);
  });

  group('the cache', () {
    test('a recording is named by its link without the signature, and keeps its extension', () {
      expect(MalaAudioCache.nameFor(link), MalaAudioCache.nameFor(sameLinkResigned));
      expect(MalaAudioCache.nameFor(link), isNot(MalaAudioCache.nameFor(linkTo(1))));
      expect(MalaAudioCache.nameFor(link), endsWith('.mp3'));
    });

    test('saved once, then found under any signature of the same link', () async {
      expect(await cache.file(link), isNull);

      final saved = await cache.save(link);
      expect(saved, isNotNull);
      expect(await saved!.readAsBytes(), [1, 2, 3, 4]);
      expect((await cache.file(sameLinkResigned))?.path, saved.path);

      await cache.save(sameLinkResigned);
      expect(storage.fetched, hasLength(1), reason: 'kept already, so not downloaded again');
    });

    test('two saves at once make one download', () async {
      await Future.wait([cache.save(link), cache.save(link)]);
      expect(storage.fetched, hasLength(1));
    });

    test('a download that fails keeps nothing, half a file included', () async {
      storage.online = false;
      expect(await cache.save(link), isNull);
      expect(await cache.file(link), isNull);
      expect(folder.existsSync() ? folder.listSync() : const <FileSystemEntity>[], isEmpty);
    });

    test('past the limit the one played least recently goes', () async {
      final base = DateTime(2026, 10, 1);
      for (var i = 0; i < OfflineConfig.maxSavedRecordings; i++) {
        final file = await cache.save(linkTo(i));
        await file!.setLastModified(base.add(Duration(minutes: i)));
      }
      // The oldest is played again, so the next oldest is the one to go.
      await cache.file(linkTo(0));
      await Future<void>.delayed(const Duration(milliseconds: 20));

      await cache.save(linkTo(99));

      expect(await cache.file(linkTo(0)), isNotNull);
      expect(await cache.file(linkTo(1)), isNull);
      expect(await cache.file(linkTo(99)), isNotNull);
      expect(folder.listSync(), hasLength(OfflineConfig.maxSavedRecordings));
    });

    test('forget drops the file', () async {
      await cache.save(link);
      await cache.forget(link);
      expect(await cache.file(link), isNull);
    });
  });

  group('the chant along', () {
    final timing = ChantMalaTiming(start: Duration.zero, end: const Duration(minutes: 1), chants: 10);

    ChantMalaPlayer playerOn(FakeAudioPlayer fake, {Future<String?> Function()? refreshUrl}) =>
        ChantMalaPlayer(url: link, timing: timing, cache: cache, refreshUrl: refreshUrl, player: fake);

    test('a kept recording plays from the file, with no connection', () async {
      final kept = await cache.save(link);
      storage.online = false;
      final fake = FakeAudioPlayer(length: const Duration(minutes: 1));
      final player = playerOn(fake, refreshUrl: () async => throw const SocketException('offline'));

      await player.load();

      expect(fake.opened, ['file:${kept!.path}']);
      expect(player.state.value.phase, ChantMalaPhase.ready);
      await player.dispose();
    });

    test('with nothing kept the link plays, and the recording is saved for next time', () async {
      final fake = FakeAudioPlayer(length: const Duration(minutes: 1));
      final player = playerOn(fake);

      await player.load();
      await cache.save(link); // the download the player started

      expect(fake.opened, [link]);
      expect(storage.fetched, hasLength(1));
      expect(await cache.file(link), isNotNull);
      await player.dispose();
    });

    test('a kept file that will not play is dropped and the link tried', () async {
      final kept = await cache.save(link);
      final fake = FakeAudioPlayer(length: const Duration(minutes: 1))..brokenUrls.add(kept!.path);
      final player = playerOn(fake);

      await player.load();

      expect(fake.opened, ['file:${kept.path}', link]);
      expect(player.state.value.phase, ChantMalaPhase.ready);
      await player.dispose();
    });

    test('with nothing kept and no connection the card says it could not open', () async {
      final fake = FakeAudioPlayer(length: const Duration(minutes: 1))..brokenUrls.add(link);
      final player = playerOn(fake, refreshUrl: () async => throw const SocketException('offline'));

      await player.load();

      expect(player.state.value.phase, ChantMalaPhase.failed);
      expect(await cache.file(link), isNull);
      await player.dispose();
    });
  });

  group('the chant along and the connection', () {
    final timing = ChantMalaTiming(start: Duration.zero, end: const Duration(minutes: 1), chants: 10);
    late FakeConnectionStatus connection;
    late FakeAudioPlayer fake;
    late ChantMalaPlayer player;

    setUp(() {
      connection = FakeConnectionStatus();
      fake = FakeAudioPlayer(length: const Duration(minutes: 1));
      player = ChantMalaPlayer(
        url: link,
        timing: timing,
        cache: cache,
        connection: connection,
        player: fake,
      );
    });

    tearDown(() => player.dispose());

    test('with no connection and nothing kept it is unavailable, and nothing is opened', () async {
      connection.isOnline = false;

      await player.load();

      expect(player.state.value.phase, ChantMalaPhase.unavailable);
      expect(fake.opened, isEmpty);
    });

    test('it loads by itself when the connection returns', () async {
      connection.isOnline = false;
      await player.load();

      connection.turn(on: true);
      await untilPhase(player, ChantMalaPhase.ready);

      expect(fake.opened, [link]);
    });

    test('a kept recording plays with no connection and is not hidden', () async {
      final kept = await cache.save(link);
      connection.isOnline = false;

      await player.load();

      expect(player.state.value.phase, ChantMalaPhase.ready);
      expect(fake.opened, ['file:${kept!.path}']);

      // Going offline or coming back changes nothing for it.
      connection.turn(on: true);
      connection.turn(on: false);
      await pumpEventQueue();
      expect(player.state.value.phase, ChantMalaPhase.ready);
      expect(fake.opened, hasLength(1));
    });

    test('a try that did not work is dropped when the connection goes, and made again when it returns', () async {
      fake.brokenUrls.add(link);
      await player.load();
      expect(player.state.value.phase, ChantMalaPhase.failed);

      connection.turn(on: false);
      await untilPhase(player, ChantMalaPhase.unavailable);

      fake.brokenUrls.clear();
      connection.turn(on: true);
      await untilPhase(player, ChantMalaPhase.ready);
    });

    test('a failed try is made again when the connection returns, without being asked', () async {
      fake.brokenUrls.add(link);
      await player.load();
      expect(player.state.value.phase, ChantMalaPhase.failed);

      fake.brokenUrls.clear();
      connection.turn(on: true);
      await untilPhase(player, ChantMalaPhase.ready);
    });

    test('a link that fails because the connection went is unavailable, not failed', () async {
      fake.brokenUrls.add(link);
      // Online when the try begins, gone by the time it has failed.
      connection
        ..isOnline = false
        ..answers.add(true);

      await player.load();

      expect(player.state.value.phase, ChantMalaPhase.unavailable);
    });

    test('once it is playing, losing the connection does not take it away', () async {
      await player.load();
      await player.play();

      connection.turn(on: false);
      await pumpEventQueue();

      expect(player.state.value.phase, ChantMalaPhase.ready);
      expect(player.isPlaying, isTrue);
    });

    test('after it is disposed a returning connection opens nothing', () async {
      connection.isOnline = false;
      await player.load();
      await player.dispose();

      connection.turn(on: true);
      await pumpEventQueue();

      expect(fake.opened, isEmpty);
    });
  });
}
