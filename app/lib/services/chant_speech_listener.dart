import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:speech_to_text/speech_to_text.dart';

/// Why word detection is or is not running. Reasons rather than message
/// strings, so the screen can put its own localised words to each.
enum ChantSpeechState { off, listening, permissionDenied, unavailable }

/// What was heard since the last tap took it.
class HeardChunk {
  const HeardChunk({required this.text, this.confidence});

  final String text;
  final double? confidence;
}

/// Turns the platform's speech recogniser into "what was said since the last
/// tap" — the unit the chant record stores words in.
///
/// Recognisers deliver a running transcript that is revised as they go and
/// that ends after a pause, so the class does two jobs. It restarts listening
/// when a session ends, so a long sitting is one continuous listen from the
/// user's side; and it counts words rather than characters when working out
/// what is new, because a recogniser rewrites earlier words more readily than
/// it moves their count.
class ChantSpeechListener {
  ChantSpeechListener({this.localeId, this.contextualPhrases});

  /// Null follows the device. A device set to a language with no recogniser
  /// simply reports itself unavailable.
  final String? localeId;

  /// Words the recogniser should lean towards — the mantra's own text.
  final List<String>? contextualPhrases;

  /// A pause between restarts, so a recogniser that ends immediately (no
  /// network, no model) does not turn into a tight loop.
  static const Duration _restartDelay = Duration(milliseconds: 400);

  /// How long one listen may run before it is restarted, and how long a
  /// silence ends it. Long, because a sitting is long.
  static const Duration _listenFor = Duration(minutes: 5);
  static const Duration _pauseFor = Duration(seconds: 30);

  final SpeechToText _speech = SpeechToText();
  final ValueNotifier<ChantSpeechState> state = ValueNotifier(ChantSpeechState.off);

  bool _wanted = false;
  bool _ready = false;
  bool _disposed = false;

  /// The running transcript of the current listen, and how many of its words
  /// a tap has already taken.
  List<String> _words = const [];
  int _consumed = 0;

  /// Words left over from a listen that ended before a tap took them.
  String _carry = '';
  double? _confidence;

  Timer? _restartTimer;

  bool get isOn => _wanted;

  Future<void> start() async {
    if (_wanted) return;
    _wanted = true;

    if (!_ready) {
      _ready = await _speech.initialize(
        onStatus: _onStatus,
        onError: _onError,
      );
    }
    if (!_wanted) return;

    if (!_ready) {
      _wanted = false;
      _emit(
        await _speech.hasPermission
            ? ChantSpeechState.unavailable
            : ChantSpeechState.permissionDenied,
      );
      return;
    }

    await _listen();
  }

  /// Stops listening. Whatever was heard but not yet taken stays available
  /// to one more [takeHeard].
  Future<void> stop() async {
    _wanted = false;
    _restartTimer?.cancel();
    _stash();
    _emit(ChantSpeechState.off);
    if (_ready) await _speech.cancel();
  }

  Future<void> dispose() async {
    await stop();
    _disposed = true;
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
    return HeardChunk(text: text, confidence: _confidence);
  }

  /// Everything async here can land after the screen is gone.
  void _emit(ChantSpeechState next) {
    if (!_disposed) state.value = next;
  }

  Future<void> _listen() async {
    if (_disposed || !_wanted || !_ready) return;
    _words = const [];
    _consumed = 0;

    try {
      await _speech.listen(
        onResult: (result) {
          final text = result.recognizedWords.trim();
          _words = text.isEmpty ? const [] : text.split(RegExp(r'\s+'));
          if (result.hasConfidenceRating) _confidence = result.confidence;
        },
        listenOptions: SpeechListenOptions(
          partialResults: true,
          listenMode: ListenMode.dictation,
          listenFor: _listenFor,
          pauseFor: _pauseFor,
          localeId: localeId,
          cancelOnError: false,
          contextualPhrases: contextualPhrases,
        ),
      );
      _emit(ChantSpeechState.listening);
    } catch (_) {
      _wanted = false;
      _emit(ChantSpeechState.unavailable);
    }
  }

  void _onStatus(String status) {
    final ended = status == SpeechToText.doneStatus || status == SpeechToText.notListeningStatus;
    if (!ended || !_wanted) return;
    _scheduleRestart();
  }

  void _onError(Object error) {
    if (!_wanted) return;
    // A silence or a no-match is how a recogniser ends a quiet stretch, not a
    // failure. Anything else keeps the restart loop going too — it has its own
    // delay — until the user turns the switch off.
    _scheduleRestart();
  }

  void _scheduleRestart() {
    _restartTimer?.cancel();
    _stash();
    _restartTimer = Timer(_restartDelay, () => unawaited(_listen()));
  }

  /// Keeps the words no tap has taken before the transcript is replaced.
  void _stash() {
    final left = _words.skip(_consumed).join(' ');
    if (left.isNotEmpty) _carry = [_carry, left].where((part) => part.isNotEmpty).join(' ');
    _words = const [];
    _consumed = 0;
  }
}
