import 'dart:async';

import 'package:audio_service/audio_service.dart';

import 'reading_playback_controller.dart';

/// The reading player as the system sees it: a media notification and lock
/// screen with previous / pause / stop / next, and the headset buttons.
class ReadingAudioHandler extends BaseAudioHandler {
  ReadingAudioHandler(this._reading) {
    _sub = _reading.states.listen(_onState);
    _onState(_reading.state);
  }

  final ReadingPlaybackController _reading;
  late final StreamSubscription<ReadingState> _sub;

  void _onState(ReadingState state) {
    final active = state.isActive;
    playbackState.add(PlaybackState(
      controls: [
        MediaControl.skipToPrevious,
        if (state.status == ReadingStatus.paused) MediaControl.play else MediaControl.pause,
        MediaControl.stop,
        MediaControl.skipToNext,
      ],
      androidCompactActionIndices: const [0, 1, 3],
      processingState: !active
          ? AudioProcessingState.idle
          : state.status == ReadingStatus.loading
              ? AudioProcessingState.loading
              : AudioProcessingState.ready,
      playing: state.status == ReadingStatus.playing || state.status == ReadingStatus.loading,
    ));

    final verse = _reading.currentVerse;
    if (active && verse != null) {
      mediaItem.add(MediaItem(
        id: verse.id,
        title: verse.reference,
        album: verse.book?.title,
      ));
    }
  }

  @override
  Future<void> play() async {
    if (_reading.state.status == ReadingStatus.paused) {
      await _reading.resume();
    } else if (!_reading.state.isActive) {
      await _reading.playAll(from: _reading.resumeIndex() ?? 0);
    }
  }

  @override
  Future<void> pause() => _reading.pause();

  @override
  Future<void> stop() async {
    await _reading.stop();
    await super.stop();
  }

  @override
  Future<void> skipToNext() => _reading.next();

  @override
  Future<void> skipToPrevious() => _reading.previous();

  Future<void> close() => _sub.cancel();
}

/// Starts the system media service the first time something is read aloud.
/// Idempotent; a phone where it cannot start still reads aloud — only the
/// lock-screen controls are missing.
class ReadingAudioService {
  static Future<ReadingAudioHandler?>? _starting;

  static Future<ReadingAudioHandler?> ensureStarted(
    ReadingPlaybackController controller, {
    required String channelName,
  }) {
    return _starting ??= () async {
      try {
        return await AudioService.init(
          builder: () => ReadingAudioHandler(controller),
          config: AudioServiceConfig(
            androidNotificationChannelId: 'com.sss.ramkrishnahari.reading',
            androidNotificationChannelName: channelName,
            androidStopForegroundOnPause: true,
          ),
        );
      } catch (_) {
        return null;
      }
    }();
  }
}
