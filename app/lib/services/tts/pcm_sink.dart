import 'dart:async';
import 'dart:io';

import 'package:just_audio/just_audio.dart';
import 'package:path_provider/path_provider.dart';

import 'chunked_speaker.dart';
import 'tts_engine.dart';
import 'wav.dart';

/// Plays synthesised speech through just_audio by writing each chunk to a small
/// WAV file in the temp directory. Files are removed as soon as they are played.
class JustAudioPcmSink implements TtsAudioSink {
  JustAudioPcmSink({AudioPlayer? player}) : _player = player ?? AudioPlayer();

  final AudioPlayer _player;
  Completer<void>? _playing;
  int _counter = 0;
  Directory? _dir;

  Future<File> _write(TtsAudio audio) async {
    _dir ??= await Directory('${(await getTemporaryDirectory()).path}/tts_speech').create(recursive: true);
    final file = File('${_dir!.path}/chunk_${_counter++}.wav');
    await file.writeAsBytes(pcm16ToWav(audio.pcm, audio.sampleRate), flush: false);
    return file;
  }

  @override
  Future<void> play(TtsAudio audio) async {
    final file = await _write(audio);
    final done = _playing = Completer<void>();
    StreamSubscription<PlayerState>? sub;
    try {
      await _player.setFilePath(file.path);
      sub = _player.playerStateStream.listen((state) {
        if (state.processingState == ProcessingState.completed && !done.isCompleted) done.complete();
      });
      // play() itself completes on pause as well as on the end, so it is not
      // awaited: the state stream says when the audio is really over.
      unawaited(_player.play());
      await done.future;
    } finally {
      await sub?.cancel();
      _playing = null;
      unawaited(file.delete().catchError((_) => file));
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
    final dir = _dir;
    if (dir != null && dir.existsSync()) unawaited(dir.delete(recursive: true).catchError((_) => dir));
  }
}
