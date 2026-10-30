import 'dart:async';

import 'package:audio_service/audio_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/services/audio/media_session.dart';

/// A source the test can change by hand and watch the controls answer.
class FakeMediaSource implements MediaSource {
  final StreamController<void> _changes = StreamController<void>.broadcast();

  bool active = true;
  bool playing = false;
  bool loading = false;
  bool skippable = true;
  int plays = 0;
  int pauses = 0;
  int stops = 0;
  int nexts = 0;

  void changed() => _changes.add(null);

  @override
  Stream<void> get changes => _changes.stream;

  @override
  bool get isActive => active;

  @override
  bool get isPlaying => playing;

  @override
  bool get isLoading => loading;

  @override
  bool get canSkip => skippable;

  @override
  MediaItem? get item => active ? const MediaItem(id: 'x', title: 'Om') : null;

  @override
  Future<void> play() async => plays++;

  @override
  Future<void> pause() async => pauses++;

  @override
  Future<void> stop() async => stops++;

  @override
  Future<void> next() async => nexts++;

  @override
  Future<void> previous() async {}
}

void main() {
  test('a source handed the controls shows play when paused and pause when playing', () async {
    final handler = MediaSessionHandler();
    final source = FakeMediaSource();

    handler.attach(source);
    expect(handler.playbackState.value.playing, isFalse);
    expect(handler.playbackState.value.controls, contains(MediaControl.play));

    source.playing = true;
    source.changed();
    await Future<void>.delayed(Duration.zero);
    expect(handler.playbackState.value.playing, isTrue);
    expect(handler.playbackState.value.controls, contains(MediaControl.pause));
    expect(handler.mediaItem.value?.title, 'Om');
  });

  test('controls go to the source they were handed to, and not the earlier one', () async {
    final handler = MediaSessionHandler();
    final reading = FakeMediaSource();
    final chant = FakeMediaSource();

    handler.attach(reading);
    handler.attach(chant);
    await handler.play();

    expect(chant.plays, 1);
    expect(reading.plays, 0);

    // The earlier source's changes no longer reach the controls.
    reading.playing = true;
    reading.changed();
    await Future<void>.delayed(Duration.zero);
    expect(handler.playbackState.value.playing, isFalse);
  });

  test('a source without skip shows no previous or next, and stop is never compact', () {
    final handler = MediaSessionHandler();
    final source = FakeMediaSource()..skippable = false;

    handler.attach(source);

    expect(handler.playbackState.value.controls, isNot(contains(MediaControl.skipToNext)));
    expect(handler.playbackState.value.controls, isNot(contains(MediaControl.skipToPrevious)));
    final compact = handler.playbackState.value.androidCompactActionIndices ?? const <int>[];
    for (final index in compact) {
      expect(handler.playbackState.value.controls[index], isNot(MediaControl.stop));
    }
  });

  test('releasing the source that has the controls drops them to idle', () {
    final handler = MediaSessionHandler();
    final source = FakeMediaSource()..playing = true;

    handler.attach(source);
    handler.release(source);

    expect(handler.playbackState.value.processingState, AudioProcessingState.idle);
    expect(handler.playbackState.value.playing, isFalse);
    expect(handler.mediaItem.value, isNull);
  });

  test('releasing a source that does not have the controls changes nothing', () {
    final handler = MediaSessionHandler();
    final holder = FakeMediaSource()..playing = true;
    final other = FakeMediaSource();

    handler.attach(holder);
    handler.release(other);

    expect(handler.playbackState.value.playing, isTrue);
  });

  test('a loading source shows as loading and playing', () {
    final handler = MediaSessionHandler();
    final source = FakeMediaSource()..loading = true;

    handler.attach(source);

    expect(handler.playbackState.value.processingState, AudioProcessingState.loading);
    expect(handler.playbackState.value.playing, isTrue);
  });

  test('stop and skip are passed on to the source', () async {
    final handler = MediaSessionHandler();
    final source = FakeMediaSource();

    handler.attach(source);
    await handler.stop();
    await handler.skipToNext();

    expect(source.stops, 1);
    expect(source.nexts, 1);
  });
}
