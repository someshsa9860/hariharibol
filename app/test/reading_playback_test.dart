import 'dart:async';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/models/verse.dart';
import 'package:hariharibol/services/audio/audio_link_resolver.dart';
import 'package:hariharibol/services/book_cache_api.dart';
import 'package:hariharibol/services/audio/file_player.dart';
import 'package:hariharibol/services/audio/reading_item.dart';
import 'package:hariharibol/services/audio/reading_memory.dart';
import 'package:hariharibol/services/audio/reading_playback_controller.dart';
import 'package:hariharibol/services/audio/verse_audio_cache.dart';

Future<void> settle([int ms = 8]) => Future<void>.delayed(Duration(milliseconds: ms));

class FakePlayer implements FilePlayer {
  final List<String> log;
  FakePlayer(this.log);
  bool hold = false;
  Object? failWith;
  Completer<void>? _gate;

  @override
  Future<void> playFile(File file) async {
    log.add('verse:${file.path.split('/').last}');
    if (failWith != null) throw failWith!;
    if (hold) {
      _gate = Completer<void>();
      await _gate!.future;
    }
  }

  void finish() {
    if (_gate != null && !_gate!.isCompleted) _gate!.complete();
  }

  @override
  Future<void> pause() async => log.add('player:pause');

  @override
  Future<void> resume() async => log.add('player:resume');

  @override
  Future<void> stop() async {
    log.add('player:stop');
    finish();
  }

  @override
  Future<void> dispose() async {}
}

class FakeAudio implements VerseAudioCache {
  FakeAudio(this.log);
  final List<String> log;
  final Set<String> missing = {};
  final List<String> prefetched = [];
  Completer<void>? hold;

  @override
  Future<File?> fileFor(Verse verse, {List<Verse> following = const []}) async {
    if (hold != null) await hold!.future;
    if (missing.contains(verse.id) || !verse.hasAudio) return null;
    return File('/cache/${verse.id}.mp3');
  }

  @override
  void prefetch(Verse verse, {List<Verse> following = const []}) => prefetched.add(verse.id);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Verse verse(int n, {bool audio = true}) => Verse(
      id: 'v$n',
      verseId: '1.1.$n',
      bookNumber: 1,
      type: 'SHLOKA',
      verseNumber: n,
      audioPath: audio ? 'k$n.mp3' : null,
    );

ReadingItem item(int n, {bool audio = true}) => ReadingItem(verse: verse(n, audio: audio), label: '1.$n');

void main() {
  late List<String> log;
  late FakePlayer player;
  late FakeAudio audio;
  late InMemoryReadingMemory memory;
  late ReadingPlaybackController c;
  late List<ReadingState> states;

  setUp(() {
    log = [];
    player = FakePlayer(log);
    audio = FakeAudio(log);
    memory = InMemoryReadingMemory();
    c = ReadingPlaybackController(player: player, audio: audio, memory: memory);
    states = [];
    c.states.listen(states.add);
  });

  List<String> heard() => log.where((e) => e.startsWith('verse:')).toList();

  test('one verse: its recitation, and it stops', () async {
    c.load([item(1), item(2)], context: 'ch1');
    await c.playVerse(0);
    expect(heard(), ['verse:v1.mp3']);
    expect(c.state.status, ReadingStatus.idle);
  });

  test('nothing but the recording is played — no speech of any kind', () async {
    c.load([item(1)], context: 'ch1');
    await c.playVerse(0);
    expect(log.where((e) => e.startsWith('say[') || e.startsWith('tts:')), isEmpty);
  });

  test('state names the verse while it is heard, then goes idle', () async {
    c.load([item(1)], context: 'ch1');
    await c.playVerse(0);
    await settle();
    final playing = states.where((s) => s.status == ReadingStatus.playing).toList();
    expect(playing.map((s) => s.verseId), ['v1']);
    expect(states.first.status, ReadingStatus.loading);
    expect(states.first.verseId, 'v1');
    expect(states.last.status, ReadingStatus.idle);
  });

  test('a verse with no recording plays nothing', () async {
    c.load([item(1, audio: false)], context: 'ch1');
    await c.playVerse(0);
    expect(heard(), isEmpty);
    expect(c.state.status, ReadingStatus.idle);
  });

  test('a recitation that cannot be fetched is skipped, not fatal', () async {
    audio.missing.add('v1');
    c.load([item(1)], context: 'ch1');
    await c.playVerse(0);
    expect(heard(), isEmpty);
    expect(c.state.status, ReadingStatus.idle);
  });

  test('a recitation that will not play is skipped', () async {
    player.failWith = StateError('bad file');
    c.load([item(1)], context: 'ch1');
    await c.playVerse(0);
    expect(heard(), ['verse:v1.mp3']);
    expect(c.state.status, ReadingStatus.idle);
  });

  test('auto-play runs verse after verse in order, then ends', () async {
    c.load([item(1), item(2), item(3)], context: 'ch1');
    await c.playAll();
    expect(heard(), ['verse:v1.mp3', 'verse:v2.mp3', 'verse:v3.mp3']);
    expect(c.state.status, ReadingStatus.idle);
  });

  test('auto-play steps over a verse with no recording', () async {
    c.load([item(1), item(2, audio: false), item(3)], context: 'ch1');
    await c.playAll();
    expect(heard(), ['verse:v1.mp3', 'verse:v3.mp3']);
  });

  test('auto-play can start part-way', () async {
    c.load([item(1), item(2), item(3)], context: 'ch1');
    await c.playAll(from: 2);
    expect(heard(), ['verse:v3.mp3']);
  });

  test('the next verse\'s recitation is fetched ahead of time', () async {
    c.load([item(1), item(2), item(3)], context: 'ch1');
    await c.playVerse(0);
    expect(audio.prefetched, ['v2']);
  });

  test('pause during the recitation pauses the player', () async {
    player.hold = true;
    c.load([item(1)], context: 'ch1');
    final done = c.playVerse(0);
    await settle();
    await c.pause();
    expect(c.state.status, ReadingStatus.paused);
    expect(log, contains('player:pause'));
    await c.resume();
    expect(c.state.status, ReadingStatus.playing);
    expect(log, contains('player:resume'));
    player.hold = false;
    player.finish();
    await done;
    expect(c.state.status, ReadingStatus.idle);
  });

  test('paused while the recitation is still loading: it does not start until resume', () async {
    audio.hold = Completer<void>();
    c.load([item(1)], context: 'ch1');
    final done = c.playVerse(0);
    await settle();
    expect(c.state.status, ReadingStatus.loading);
    await c.pause();
    audio.hold!.complete();
    await settle(20);
    expect(heard(), isEmpty, reason: 'nothing starts while paused');

    await c.resume();
    await done;
    expect(heard(), ['verse:v1.mp3']);
  });

  test('paused between verses: the next one waits for resume', () async {
    player.hold = true;
    c.load([item(1), item(2)], context: 'ch1');
    final done = c.playAll();
    await settle();
    await c.pause();
    player.hold = false;
    player.finish();
    await settle(20);
    expect(heard(), ['verse:v1.mp3'], reason: 'verse 2 waits while paused');

    await c.resume();
    await done;
    expect(heard(), ['verse:v1.mp3', 'verse:v2.mp3']);
  });

  test('next skips to the following verse, keeping auto-play', () async {
    player.hold = true;
    c.load([item(1), item(2), item(3)], context: 'ch1');
    unawaited(c.playAll());
    await settle();
    expect(c.state.index, 0);

    unawaited(c.next());
    await settle();
    expect(c.state.index, 1);
    expect(c.state.autoplay, isTrue);
    player.hold = false;
    player.finish();
    await settle(40);
    expect(heard(), containsAll(['verse:v1.mp3', 'verse:v2.mp3', 'verse:v3.mp3']));
  });

  test('previous goes back one, and stays at the first', () async {
    player.hold = true;
    c.load([item(1), item(2)], context: 'ch1');
    unawaited(c.playVerse(1));
    await settle();
    expect(c.state.index, 1);
    unawaited(c.previous());
    await settle();
    expect(c.state.index, 0);
    unawaited(c.previous());
    await settle();
    expect(c.state.index, 0);
    await c.stop();
  });

  test('next at the last verse stops', () async {
    player.hold = true;
    c.load([item(1)], context: 'ch1');
    unawaited(c.playAll());
    await settle();
    await c.next();
    expect(c.state.status, ReadingStatus.idle);
  });

  test('stop ends everything and nothing more is played', () async {
    player.hold = true;
    c.load([item(1), item(2)], context: 'ch1');
    final done = c.playAll();
    await settle();
    await c.stop();
    await done;
    final before = heard().length;
    await settle(30);
    expect(heard().length, before);
    expect(c.state.status, ReadingStatus.idle);
  });

  test('starting another verse cancels the first cleanly', () async {
    player.hold = true;
    c.load([item(1), item(2)], context: 'ch1');
    unawaited(c.playVerse(0));
    await settle();
    player.hold = false;
    unawaited(c.playVerse(1));
    await settle(40);
    expect(heard(), ['verse:v1.mp3', 'verse:v2.mp3']);
    expect(c.state.index, isNull, reason: 'verse 2 finished and the player went idle');
    expect(c.state.status, ReadingStatus.idle);
  });

  test('the last verse played is remembered per chapter', () async {
    c.load([item(1), item(2), item(3)], context: 'ch7');
    await c.playVerse(1);
    expect(memory.lastVerseId('ch7'), 'v2');
    expect(c.resumeIndex(), 1);

    c.load([item(1), item(2), item(3)], context: 'other');
    expect(c.resumeIndex(), isNull);
  });

  test('a remembered verse no longer in the chapter is ignored', () async {
    await memory.remember('ch1', 'gone');
    c.load([item(1)], context: 'ch1');
    expect(c.resumeIndex(), isNull);
  });

  test('loading a different chapter stops what is playing', () async {
    player.hold = true;
    c.load([item(1)], context: 'a');
    unawaited(c.playVerse(0));
    await settle();
    c.load([item(1)], context: 'b');
    await settle();
    expect(c.state.status, ReadingStatus.idle);
  });

  test('nothing to play: out-of-range index is ignored', () async {
    c.load([item(1)], context: 'a');
    await c.playVerse(5);
    expect(heard(), isEmpty);
  });

  group('ReadingItems.build', () {
    test('one item per verse, labelled with its reference', () {
      final items = ReadingItems.build([verse(1), verse(2)]);
      expect(items.map((i) => i.verse.id), ['v1', 'v2']);
      expect(items.map((i) => i.label), everyElement(isNotEmpty));
    });

    test('only a verse with a recording has anything to play', () {
      final items = ReadingItems.build([verse(1), verse(2, audio: false)]);
      expect(items.map((i) => i.hasAnything), [true, false]);
    });

    test('a translation on screen is never something to play', () {
      final v = Verse(
        id: 'v1', verseId: '1', bookNumber: 1, type: 'S',
        translation: const VerseTranslation(id: 't', languageCode: 'mr', type: 'T', meaning: 'अर्थ', purport: 'टीप'),
      );
      expect(ReadingItems.build([v]).single.hasAnything, isFalse);
    });
  });

  group('AudioLinkResolver', () {
    test('a verse that arrived with a link needs no request', () async {
      final api = FakeLinkApi();
      final r = AudioLinkResolver(api: api);
      final v = Verse(id: 'v', verseId: '1', bookNumber: 1, type: 'S', audioUrl: 'https://cdn/x.mp3');
      expect(await r.linkFor(v), 'https://cdn/x.mp3');
      expect(api.calls, isEmpty);
    });

    test('keys are traded for links in one batch with the verses that follow, then remembered', () async {
      final api = FakeLinkApi();
      final r = AudioLinkResolver(api: api);
      Verse k(int n) => Verse(
            id: 'v$n', verseId: '$n', bookNumber: 1, type: 'S', audioPath: 'k$n',
            book: const VerseBookRef(id: 'b', slug: 'bg', title: 'BG', bookNumber: 1),
          );
      expect(await r.linkFor(k(1), following: [k(2), k(3)]), 'https://s3/v1');
      expect(api.calls.single, ['v1', 'v2', 'v3']);
      expect(await r.linkFor(k(2)), 'https://s3/v2');
      expect(api.calls, hasLength(1), reason: 'already known');
    });

    test('a link past its life is asked for again', () async {
      var now = DateTime(2026);
      final api = FakeLinkApi();
      final r = AudioLinkResolver(api: api, clock: () => now, ttl: const Duration(minutes: 10));
      final v = Verse(
        id: 'v1', verseId: '1', bookNumber: 1, type: 'S', audioPath: 'k',
        book: const VerseBookRef(id: 'b', slug: 'bg', title: 'BG', bookNumber: 1),
      );
      await r.linkFor(v);
      now = now.add(const Duration(minutes: 11));
      await r.linkFor(v);
      expect(api.calls, hasLength(2));
    });

    test('a verse with no audio gets null', () async {
      expect(await AudioLinkResolver(api: FakeLinkApi()).linkFor(verse(1, audio: false)), isNull);
    });
  });

  group('VerseAudioCache.keyOf', () {
    test('is the storage key, or a link without its signature', () {
      expect(VerseAudioCache.keyOf(verse(1)), 'k1.mp3');
      final signed = Verse(id: 'v', verseId: '1', bookNumber: 1, type: 'S', audioUrl: 'https://cdn.test/a/b.mp3?X-Amz-Signature=abc&Expires=1');
      final later = Verse(id: 'v', verseId: '1', bookNumber: 1, type: 'S', audioUrl: 'https://cdn.test/a/b.mp3?X-Amz-Signature=zzz&Expires=2');
      expect(VerseAudioCache.keyOf(signed), VerseAudioCache.keyOf(later), reason: 'a new signature is the same recording');
      expect(VerseAudioCache.keyOf(verse(1, audio: false)), isNull);
    });
  });
}

class FakeLinkApi implements BookCacheApi {
  final List<List<String>> calls = [];

  @override
  Future<Map<String, String>> audioUrls(String book, List<String> verseIds) async {
    calls.add(verseIds);
    return {for (final id in verseIds) id: 'https://s3/$id'};
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
