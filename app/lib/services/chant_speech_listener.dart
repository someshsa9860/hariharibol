import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';

import 'chant_word_engine.dart';
import 'mantra_audio_capture.dart';

/// Why word detection is or is not running. Reasons rather than message
/// strings, so the screen can put its own localised words to each.
enum ChantSpeechState { off, starting, listening, permissionDenied, unavailable }

/// What was heard since the last tap took it.
class HeardChunk {
  const HeardChunk({required this.text, this.confidence});

  final String text;
  final double? confidence;
}

/// Turns the microphone into "what was said since the last tap" — the unit
/// the chant record stores words in.
///
/// Runs entirely on the phone with sherpa-onnx ([ChantWordEngine]), the same
/// library auto-count uses, so it works offline and never hands audio to a
/// Google or Apple speech service.
///
/// The engine delivers a running transcript of the current utterance that is
/// revised as it goes and finalised by a pause, so what is new is worked out by
/// counting words rather than characters: a recogniser rewrites earlier words
/// more readily than it moves their count.
class ChantSpeechListener {
  ChantSpeechListener();

  final MantraAudioCapture _capture = MantraAudioCapture();
  final ChantWordEngine _engine = ChantWordEngine();
  final ValueNotifier<ChantSpeechState> state = ValueNotifier(ChantSpeechState.off);

  StreamSubscription<Float32List>? _audioSub;
  StreamSubscription<WordTranscript>? _transcriptSub;
  StreamSubscription<String>? _errorSub;

  bool _wanted = false;
  bool _disposed = false;

  /// The running transcript of the current utterance, and how many of its
  /// words a tap has already taken.
  List<String> _words = const [];
  int _consumed = 0;

  /// Words left over from an utterance that ended before a tap took them.
  String _carry = '';

  bool get isOn => _wanted;

  Future<void> start() async {
    if (_wanted) return;
    _wanted = true;
    _emit(ChantSpeechState.starting);

    try {
      if (!await _capture.hasPermission()) {
        await _fail(ChantSpeechState.permissionDenied);
        return;
      }
      await _engine.start();
      if (!_wanted) {
        await _release();
        return;
      }
      final audio = await _capture.start();
      _transcriptSub = _engine.transcripts.listen(_onTranscript);
      _errorSub = _engine.errors.listen((_) => unawaited(_fail(ChantSpeechState.unavailable)));
      _audioSub = audio.listen(
        _engine.acceptWaveform,
        onError: (_) => unawaited(_fail(ChantSpeechState.unavailable)),
        onDone: () {
          if (_wanted) unawaited(_fail(ChantSpeechState.unavailable));
        },
      );
      _emit(ChantSpeechState.listening);
    } catch (_) {
      await _fail(ChantSpeechState.unavailable);
    }
  }

  /// Stops listening. Whatever was heard but not yet taken stays available
  /// to one more [takeHeard].
  Future<void> stop() async {
    _wanted = false;
    _stash();
    _emit(ChantSpeechState.off);
    await _release();
  }

  Future<void> dispose() async {
    await stop();
    _disposed = true;
    await _capture.dispose();
    await _engine.dispose();
    state.dispose();
  }

  /// The words since the last call, or null when nothing was heard. Called at
  /// each tap, so the words a tap carries are the ones spoken since the one
  /// before it.
  HeardChunk? takeHeard() {
    final fresh = _words.skip(_consumed).join(' ');
    _consumed = _words.length;
    final text = [_carry, fresh].where((part) => part.isNotEmpty).join(' ').trim();
    _carry = '';
    if (text.isEmpty) return null;
    return HeardChunk(text: text.toLowerCase());
  }

  void _onTranscript(WordTranscript transcript) {
    if (!_wanted) return;
    _words = transcript.text.isEmpty ? const [] : transcript.text.split(RegExp(r'\s+'));
    // A pause ended the utterance: the next transcript starts from zero, so
    // what no tap has taken yet is kept aside first.
    if (transcript.isFinal) _stash();
  }

  Future<void> _fail(ChantSpeechState reason) async {
    _wanted = false;
    _emit(reason);
    await _release();
  }

  Future<void> _release() async {
    await _audioSub?.cancel();
    await _transcriptSub?.cancel();
    await _errorSub?.cancel();
    _audioSub = null;
    _transcriptSub = null;
    _errorSub = null;
    await _capture.stop();
    await _engine.stop();
  }

  /// Everything async here can land after the screen is gone.
  void _emit(ChantSpeechState next) {
    if (!_disposed) state.value = next;
  }

  /// Keeps the words no tap has taken before the transcript is replaced.
  void _stash() {
    final left = _words.skip(_consumed).join(' ');
    if (left.isNotEmpty) _carry = [_carry, left].where((part) => part.isNotEmpty).join(' ');
    _words = const [];
    _consumed = 0;
  }
}
