import 'dart:async';

import '../../core/constants/tts_config.dart';
import 'tts_engine.dart';

/// Makes speech from text. Runs off the UI thread in the real engine.
abstract class TtsSynthesizer {
  Future<TtsAudio> synthesize(String text, {double rate = 1.0});
  Future<void> dispose();
}

/// Plays made speech. [play] completes when the audio has finished, or was
/// stopped; pausing leaves it pending.
abstract class TtsAudioSink {
  Future<void> play(TtsAudio audio);
  Future<void> pause();
  Future<void> resume();
  Future<void> stop();
  Future<void> dispose();
}

/// Speaks a list of chunks with no gap between them: while chunk N plays, chunk
/// N+1 (up to [lookahead] ahead) is already being made.
///
/// Synthesis is a [Future] that starts the moment it is asked for, so asking
/// for the next one *before* awaiting the player is the whole trick.
class ChunkedSpeaker {
  ChunkedSpeaker({required this.synthesizer, required this.sink, this.lookahead = TtsConfig.lookahead});

  final TtsSynthesizer synthesizer;
  final TtsAudioSink sink;
  final int lookahead;

  final StreamController<TtsProgress> _progress = StreamController<TtsProgress>.broadcast();
  Stream<TtsProgress> get progress => _progress.stream;

  bool _stopped = false;
  Completer<void>? _pauseGate;

  bool get isPaused => _pauseGate != null;

  /// Speaks [chunks] from [startAt]. Completes when the last one has finished or
  /// [stop] was called; throws [TtsException] (with how many were spoken) if one
  /// cannot be made or played.
  Future<void> speak(List<String> chunks, {int startAt = 0, double rate = 1.0}) async {
    _stopped = false;
    _pauseGate = null;
    if (startAt >= chunks.length) return;

    _progress.add(TtsProgress(TtsPhase.started, chunkIndex: startAt, chunkCount: chunks.length));

    // Futures already running, keyed by chunk index. Errors are held until the
    // chunk is reached, so an unneeded one (after a stop) never goes unhandled.
    final making = <int, Future<TtsAudio>>{};
    Future<TtsAudio> make(int i) => making.putIfAbsent(i, () {
          final future = synthesizer.synthesize(chunks[i], rate: rate);
          future.ignore();
          return future;
        });

    for (var i = startAt; i < chunks.length; i++) {
      final ahead = i + lookahead < chunks.length ? i + lookahead : chunks.length - 1;
      for (var k = i; k <= ahead; k++) {
        make(k);
      }

      final TtsAudio audio;
      try {
        audio = await make(i);
      } catch (error) {
        _progress.add(TtsProgress(TtsPhase.failed, chunkIndex: i, chunkCount: chunks.length, error: error));
        if (_stopped) return;
        throw TtsException('could not make speech', spoken: i, cause: error);
      }
      if (_stopped) return;

      // Paused while that chunk was being made: hold here, not mid-sentence.
      final gate = _pauseGate;
      if (gate != null) await gate.future;
      if (_stopped) return;

      _progress.add(TtsProgress(TtsPhase.chunkStarted, chunkIndex: i, chunkCount: chunks.length));
      try {
        await sink.play(audio);
      } catch (error) {
        _progress.add(TtsProgress(TtsPhase.failed, chunkIndex: i, chunkCount: chunks.length, error: error));
        if (_stopped) return;
        throw TtsException('could not play speech', spoken: i, cause: error);
      }
      if (_stopped) return;
      making.remove(i);
    }
    _progress.add(TtsProgress(TtsPhase.completed, chunkIndex: chunks.length - 1, chunkCount: chunks.length));
  }

  Future<void> pause() async {
    if (_pauseGate != null || _stopped) return;
    _pauseGate = Completer<void>();
    await sink.pause();
    _progress.add(const TtsProgress(TtsPhase.paused));
  }

  Future<void> resume() async {
    final gate = _pauseGate;
    if (gate == null) return;
    _pauseGate = null;
    await sink.resume();
    if (!gate.isCompleted) gate.complete();
    _progress.add(const TtsProgress(TtsPhase.resumed));
  }

  Future<void> stop() async {
    _stopped = true;
    final gate = _pauseGate;
    _pauseGate = null;
    if (gate != null && !gate.isCompleted) gate.complete();
    await sink.stop();
    _progress.add(const TtsProgress(TtsPhase.stopped));
  }

  Future<void> dispose() async {
    await stop();
    await synthesizer.dispose();
    await sink.dispose();
    await _progress.close();
  }
}
