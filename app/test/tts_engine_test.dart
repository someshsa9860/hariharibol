import 'dart:async';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/services/tts/adaptive_tts_engine.dart';
import 'package:hariharibol/services/tts/chunked_speaker.dart';
import 'package:hariharibol/services/tts/platform_tts_engine.dart';
import 'package:hariharibol/services/tts/tts_engine.dart';

/// Synthesis the test controls: each chunk finishes when [release] is called.
class FakeSynth implements TtsSynthesizer {
  FakeSynth(this.log);

  final List<String> log;
  final Map<String, Completer<TtsAudio>> _waiting = {};
  final Set<String> failOn = {};
  bool auto = false;

  @override
  Future<TtsAudio> synthesize(String text, {double rate = 1.0}) {
    log.add('synth:start:$text');
    final done = _waiting[text] = Completer<TtsAudio>();
    if (auto) release(text);
    return done.future;
  }

  void release(String text) {
    if (failOn.contains(text)) {
      _waiting[text]!.completeError(StateError('boom $text'));
    } else {
      _waiting[text]!.complete(TtsAudio(Int16List(10), 22050));
    }
    log.add('synth:end:$text');
  }

  bool started(String text) => _waiting.containsKey(text);

  @override
  Future<void> dispose() async {}
}

class FakeSink implements TtsAudioSink {
  FakeSink(this.log);

  final List<String> log;
  Completer<void>? current;
  int n = 0;
  bool auto = false;

  @override
  Future<void> play(TtsAudio audio) {
    final id = n++;
    log.add('play:start:$id');
    final done = current = Completer<void>();
    if (auto) finish();
    return done.future.then((_) => log.add('play:end:$id'));
  }

  void finish() => current?.complete();

  @override
  Future<void> pause() async => log.add('sink:pause');

  @override
  Future<void> resume() async => log.add('sink:resume');

  @override
  Future<void> stop() async {
    log.add('sink:stop');
    if (current != null && !current!.isCompleted) current!.complete();
  }

  @override
  Future<void> dispose() async {}
}

Future<void> settle() => Future<void>.delayed(const Duration(milliseconds: 5));

void main() {
  group('ChunkedSpeaker', () {
    late List<String> log;
    late FakeSynth synth;
    late FakeSink sink;
    late ChunkedSpeaker speaker;

    setUp(() {
      log = [];
      synth = FakeSynth(log);
      sink = FakeSink(log);
      speaker = ChunkedSpeaker(synthesizer: synth, sink: sink);
    });

    test('chunk 2 is being made while chunk 1 plays — no gap', () async {
      final done = speaker.speak(['a', 'b', 'c']);
      await settle();
      expect(synth.started('a'), isTrue);
      expect(synth.started('b'), isTrue, reason: 'next chunk requested at once');
      expect(synth.started('c'), isFalse, reason: 'only one ahead');

      synth.release('a');
      await settle();
      expect(log, contains('play:start:0'));
      expect(synth.started('b'), isTrue);

      // b finishes making while a still plays; c is requested when b's turn comes.
      synth.release('b');
      await settle();
      sink.finish(); // a ends
      await settle();
      expect(log.indexOf('play:start:1'), greaterThan(log.indexOf('play:end:0')));
      expect(synth.started('c'), isTrue, reason: 'c is made while b plays');

      synth.release('c');
      sink.finish();
      await settle();
      sink.finish();
      await done;
      expect(log.where((e) => e.startsWith('play:start')), hasLength(3));
    });

    test('the second chunk starts playing the moment the first ends, if it is ready', () async {
      synth.auto = true;
      sink.auto = true;
      await speaker.speak(['a', 'b', 'c']);
      expect(log.where((e) => e.startsWith('play:end')), hasLength(3));
    });

    test('progress reports each chunk and completion', () async {
      synth.auto = true;
      sink.auto = true;
      final seen = <TtsProgress>[];
      speaker.progress.listen(seen.add);
      await speaker.speak(['a', 'b']);
      await settle();
      expect(seen.map((e) => e.phase), [TtsPhase.started, TtsPhase.chunkStarted, TtsPhase.chunkStarted, TtsPhase.completed]);
      expect(seen[2].chunkIndex, 1);
      expect(seen[2].chunkCount, 2);
    });

    test('pause holds playback; resume carries on', () async {
      synth.auto = true;
      final done = speaker.speak(['a', 'b']);
      await settle();
      await speaker.pause();
      expect(log, contains('sink:pause'));
      expect(speaker.isPaused, isTrue);
      await speaker.resume();
      expect(log, contains('sink:resume'));
      sink.finish();
      await settle();
      sink.finish();
      await done;
      expect(log.where((e) => e.startsWith('play:end')), hasLength(2));
    });

    test('paused while the next chunk is still being made: it does not start until resumed', () async {
      final done = speaker.speak(['a', 'b']);
      await settle();
      synth.release('a');
      await settle();
      expect(log, contains('play:start:0'));
      await speaker.pause();
      sink.finish(); // a ends while paused (as the player would at its end)
      synth.release('b');
      await settle();
      expect(log, isNot(contains('play:start:1')));
      await speaker.resume();
      await settle();
      expect(log, contains('play:start:1'));
      sink.finish();
      await done;
    });

    test('stop ends it at once and nothing further plays', () async {
      final done = speaker.speak(['a', 'b', 'c']);
      await settle();
      synth.release('a');
      await settle();
      await speaker.stop();
      await done;
      synth.release('b');
      await settle();
      expect(log.where((e) => e.startsWith('play:start')), hasLength(1));
    });

    test('a chunk that cannot be made throws with how many were spoken', () async {
      synth
        ..auto = true
        ..failOn.add('b');
      sink.auto = true;
      await expectLater(
        speaker.speak(['a', 'b', 'c']),
        throwsA(isA<TtsException>().having((e) => e.spoken, 'spoken', 1)),
      );
    });

    test('startAt skips what was already spoken', () async {
      synth.auto = true;
      sink.auto = true;
      await speaker.speak(['a', 'b', 'c'], startAt: 2);
      expect(log.where((e) => e.startsWith('synth:start')), ['synth:start:c']);
    });
  });

  group('PlatformTtsEngine', () {
    late FakeApi api;
    late PlatformTtsEngine engine;

    setUp(() {
      api = FakeApi();
      engine = PlatformTtsEngine(api: api);
    });

    test('speaks long text a chunk at a time in the right locale', () async {
      final text = List.filled(30, 'The soul is eternal and never dies.').join(' ');
      await engine.speak(text, language: 'hi');
      expect(api.spoken.length, greaterThan(3));
      expect(api.locales.toSet(), {'hi-IN'});
      expect(api.spoken.join(' '), text);
    });

    test('a pause stops and the same chunk is spoken again on resume', () async {
      api.holdFirst = true;
      final done = engine.speak('One sentence is here for the test. Another sentence follows it for the test.', language: 'en');
      await settle();
      expect(api.spoken, hasLength(1));
      await engine.pause();
      await settle();
      await engine.resume();
      await settle();
      api.holdFirst = false;
      api.releaseAll();
      await done;
      expect(api.spoken.first, api.spoken[1], reason: 'the interrupted chunk is repeated');
    });

    test('stop ends the speech', () async {
      api.holdFirst = true;
      final done = engine.speak('One sentence is here for the test. Another sentence follows it for the test.', language: 'en');
      await settle();
      await engine.stop();
      await done;
      expect(api.spoken, hasLength(1));
    });

    test('Sanskrit is read by the Hindi voice; an unknown code is passed through', () {
      expect(platformLocaleFor('sa'), 'hi-IN');
      expect(platformLocaleFor('en'), 'en-IN');
      expect(platformLocaleFor('xx'), 'xx');
    });

    test('a failure reports how many chunks were spoken', () async {
      api.failAt = 1;
      final text = List.filled(30, 'The soul is eternal and never dies.').join(' ');
      await expectLater(engine.speak(text, language: 'en'), throwsA(isA<TtsException>().having((e) => e.spoken, 'spoken', 1)));
    });
  });

  group('AdaptiveTtsEngine', () {
    late FakeEngine neural;
    late FakeEngine platform;
    late List<String> missing;
    late AdaptiveTtsEngine engine;

    setUp(() {
      neural = FakeEngine('neural')..languages = {'hi'};
      platform = FakeEngine('platform')..languages = {'hi', 'en', 'ta'};
      missing = [];
      engine = AdaptiveTtsEngine(neural: neural, platform: platform, onNeuralMissing: missing.add);
    });

    test('uses the neural voice when one is installed', () async {
      await engine.speak('namaste', language: 'hi');
      expect(neural.spoken, ['namaste']);
      expect(platform.spoken, isEmpty);
      expect(missing, isEmpty);
    });

    test('uses the phone\'s voice at once when none is installed, and asks for the download', () async {
      await engine.speak('vanakkam', language: 'ta');
      expect(neural.spoken, isEmpty);
      expect(platform.spoken, ['vanakkam']);
      expect(missing, ['ta']);
    });

    test('a neural failure part-way carries on in the phone\'s voice from that chunk', () async {
      final sentences = List.generate(6, (i) => 'Sentence number $i is exactly long enough to stand alone as one chunk ok.');
      final text = sentences.join(' ');
      neural.failAfter = 2;
      await engine.speak(text, language: 'hi');
      expect(platform.spoken.single, sentences.skip(2).join(' '));
    });

    test('canSpeak is true if either engine can', () async {
      expect(await engine.canSpeak('hi'), isTrue);
      expect(await engine.canSpeak('ta'), isTrue);
      expect(await engine.canSpeak('zz'), isFalse);
    });

    test('pause, resume and stop go to the engine that is speaking', () async {
      neural.hold = true;
      final done = engine.speak('namaste', language: 'hi');
      await settle();
      await engine.pause();
      await engine.resume();
      expect(neural.calls, ['pause', 'resume']);
      expect(platform.calls, isEmpty);
      await engine.stop();
      neural.hold = false;
      neural.releaseHeld();
      await done;
      expect(neural.calls, contains('stop'));
      expect(platform.calls, contains('stop'));
    });
  });
}

class FakeApi implements PlatformSpeechApi {
  final List<String> spoken = [];
  final List<String> locales = [];
  bool holdFirst = false;
  int? failAt;
  final List<Completer<void>> _held = [];

  @override
  Future<bool> isAvailable(String locale) async => true;

  @override
  Future<void> speak(String text, {required String locale, required double rate}) async {
    if (failAt != null && spoken.length == failAt) {
      spoken.add(text);
      throw StateError('engine died');
    }
    spoken.add(text);
    locales.add(locale);
    if (holdFirst && spoken.length == 1) {
      final gate = Completer<void>();
      _held.add(gate);
      await gate.future;
    }
  }

  void releaseAll() {
    for (final gate in _held) {
      if (!gate.isCompleted) gate.complete();
    }
  }

  @override
  Future<void> stop() async => releaseAll();
}

class FakeEngine implements TtsEngine {
  FakeEngine(this.id);

  @override
  final String id;
  Set<String> languages = {};
  final List<String> spoken = [];
  final List<String> calls = [];
  int? failAfter;
  bool hold = false;
  Completer<void>? _gate;

  @override
  Stream<TtsProgress> get progress => const Stream.empty();

  @override
  Future<bool> canSpeak(String language) async => languages.contains(language);

  @override
  Future<void> speak(String text, {required String language, double rate = 1.0}) async {
    if (failAfter != null) throw TtsException('died', spoken: failAfter!);
    spoken.add(text);
    if (hold) {
      _gate = Completer<void>();
      await _gate!.future;
    }
  }

  void releaseHeld() {
    if (_gate != null && !_gate!.isCompleted) _gate!.complete();
  }

  @override
  Future<void> pause() async => calls.add('pause');

  @override
  Future<void> resume() async => calls.add('resume');

  @override
  Future<void> stop() async {
    calls.add('stop');
    releaseHeld();
  }

  @override
  Future<void> dispose() async {}
}
