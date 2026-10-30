import 'dart:async';

import 'package:audio_service/audio_service.dart';
import 'package:audio_session/audio_session.dart';
import 'package:flutter/foundation.dart';

import 'audio/media_session.dart';
import 'chant_mala_player.dart';

/// A chant recording as the system's media controls see it: play, pause and stop
/// on the lock screen and the notification, with the mantra's name as the title.
/// A recording has no next or previous, so those controls are not offered.
class ChantMediaSource implements MediaSource {
  ChantMediaSource(this._player, {required this._title}) {
    _player.state.addListener(_onState);
  }

  final ChantMalaPlayer _player;
  final String _title;
  final StreamController<void> _changes = StreamController<void>.broadcast();

  void _onState() {
    if (!_changes.isClosed) _changes.add(null);
  }

  @override
  Stream<void> get changes => _changes.stream;

  @override
  bool get isActive => _player.state.value.phase == ChantMalaPhase.ready;

  @override
  bool get isPlaying => _player.state.value.playing;

  @override
  bool get isLoading => _player.state.value.phase == ChantMalaPhase.loading;

  @override
  bool get canSkip => false;

  @override
  MediaItem? get item => MediaItem(id: _title, title: _title);

  @override
  Future<void> play() => _player.play();

  @override
  Future<void> pause() => _player.pause();

  /// Stop goes back to the start, as the card's own stop does.
  @override
  Future<void> stop() => _player.rewind();

  @override
  Future<void> next() async {}

  @override
  Future<void> previous() async {}

  /// Lets go of the player's state. Call it when the chant view closes.
  void dispose() {
    _player.state.removeListener(_onState);
    unawaited(_changes.close());
  }
}

/// Makes the recording a music session the phone keeps playing with the screen
/// off, then hands the lock-screen controls to [source]. A phone that cannot
/// start the session still plays; only the background part is missing.
Future<void> startChantMedia(ChantMediaSource source, {required String channelName}) async {
  try {
    final session = await AudioSession.instance;
    await session.configure(const AudioSessionConfiguration.music());
    await session.setActive(true);
  } catch (error) {
    debugPrint('Chant audio session could not start: $error');
  }
  await MediaSessionService.attach(source, channelName: channelName);
}
