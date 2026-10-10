import 'dart:async';
import 'dart:io';

import 'package:just_audio/just_audio.dart';

/// Plays one local audio file. [playFile] completes when it has ended, or was
/// stopped; it throws if the file cannot be played.
abstract class FilePlayer {
  Future<void> playFile(File file);
  Future<void> pause();
  Future<void> resume();
  Future<void> stop();
  Future<void> dispose();
}

class JustAudioFilePlayer implements FilePlayer {
  JustAudioFilePlayer({AudioPlayer? player}) : _provided = player;

  final AudioPlayer? _provided;
  late final AudioPlayer _player = _provided ?? AudioPlayer();
  Completer<void>? _playing;

  @override
  Future<void> playFile(File file) async {
    final done = _playing = Completer<void>();
    StreamSubscription<PlayerState>? sub;
    try {
      await _player.setFilePath(file.path);
      sub = _player.playerStateStream.listen((state) {
        if (state.processingState == ProcessingState.completed && !done.isCompleted) done.complete();
      });
      unawaited(_player.play()); // completes on pause too; the state stream says when it is over
      await done.future;
    } finally {
      await sub?.cancel();
      _playing = null;
    }
  }

  @override
  Future<void> pause() => _player.pause();

  @override
  Future<void> resume() async {
    unawaited(_player.play());
  }

  @override
  Future<void> stop() async {
    final done = _playing;
    await _player.stop();
    if (done != null && !done.isCompleted) done.complete();
  }

  @override
  Future<void> dispose() async {
    await stop();
    await _player.dispose();
  }
}
