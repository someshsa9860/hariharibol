import 'package:audio_service/audio_service.dart';

import 'media_session.dart';
import 'reading_playback_controller.dart';

/// Reading aloud, as the system's media controls see it: a media notification and
/// lock screen with previous / pause / stop / next, and the headset buttons.
class ReadingMediaSource implements MediaSource {
  ReadingMediaSource(this._reading);

  final ReadingPlaybackController _reading;

  @override
  Stream<void> get changes => _reading.states;

  @override
  bool get isActive => _reading.state.isActive;

  @override
  bool get isPlaying => _reading.state.isPlaying;

  @override
  bool get isLoading => _reading.state.status == ReadingStatus.loading;

  @override
  bool get canSkip => true;

  @override
  MediaItem? get item {
    final verse = _reading.currentVerse;
    if (!isActive || verse == null) return null;
    return MediaItem(
      id: verse.id,
      title: verse.reference,
      album: verse.book?.title,
    );
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
  Future<void> stop() => _reading.stop();

  @override
  Future<void> next() => _reading.next();

  @override
  Future<void> previous() => _reading.previous();
}
