import 'dart:async';

import 'package:flutter_tts/flutter_tts.dart';

import 'text_chunker.dart';
import 'tts_engine.dart';

/// The phone's own speech — what is used until a neural voice is installed, and
/// for any language no installed voice covers. A narrow interface so the engine
/// is tested without a plugin.
abstract class PlatformSpeechApi {
  Future<bool> isAvailable(String locale);

  /// Speaks [text]; completes when it ends, is stopped, or fails (then throws).
  Future<void> speak(String text, {required String locale, required double rate});
  Future<void> stop();
}

class FlutterTtsApi implements PlatformSpeechApi {
  FlutterTtsApi({FlutterTts? tts}) : _provided = tts;

  final FlutterTts? _provided;

  // Created on first use: building a FlutterTts opens a platform channel, and
  // an app that never speaks should not pay for that at start.
  late final FlutterTts _tts = _provided ?? FlutterTts();
  bool _ready = false;

  Future<void> _init() async {
    if (_ready) return;
    _ready = true;
    await _tts.awaitSpeakCompletion(true);
  }

  @override
  Future<bool> isAvailable(String locale) async {
    try {
      final result = await _tts.isLanguageAvailable(locale);
      return result == true || result == 1;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<void> speak(String text, {required String locale, required double rate}) async {
    await _init();
    await _tts.setLanguage(locale);
    // flutter_tts rates run 0–1 with 0.5 as normal on both platforms.
    await _tts.setSpeechRate((0.5 * rate).clamp(0.1, 1.0));
    final result = await _tts.speak(text);
    if (result == 0) throw const TtsException('the phone refused to speak');
  }

  @override
  Future<void> stop() async {
    await _tts.stop();
  }
}

/// Region the phone's voices are usually filed under. Sanskrit has no voice of
/// its own; the Hindi one reads Devanagari.
const Map<String, String> platformLocales = {
  'en': 'en-IN',
  'hi': 'hi-IN',
  'sa': 'hi-IN',
  'bn': 'bn-IN',
  'ta': 'ta-IN',
  'te': 'te-IN',
  'kn': 'kn-IN',
  'mr': 'mr-IN',
  'gu': 'gu-IN',
  'ml': 'ml-IN',
  'pa': 'pa-IN',
  'or': 'or-IN',
  'ur': 'ur-IN',
  'ne': 'ne-NP',
};

String platformLocaleFor(String language) => platformLocales[language] ?? language;

/// Speaks chunk by chunk so it can pause: stopping the phone's voice mid-chunk
/// loses its place, so a pause stops after remembering which chunk was playing
/// and resume speaks that chunk again.
class PlatformTtsEngine implements TtsEngine {
  PlatformTtsEngine({PlatformSpeechApi? api}) : _api = api ?? FlutterTtsApi();

  final PlatformSpeechApi _api;
  final StreamController<TtsProgress> _progress = StreamController<TtsProgress>.broadcast();

  @override
  String get id => 'platform';

  @override
  Stream<TtsProgress> get progress => _progress.stream;

  int _run = 0;
  bool _paused = false;
  bool _interrupted = false;
  Completer<void>? _resumeGate;

  @override
  Future<bool> canSpeak(String language) => _api.isAvailable(platformLocaleFor(language));

  @override
  Future<void> speak(String text, {required String language, double rate = 1.0}) async {
    final chunks = TextChunker.split(text);
    if (chunks.isEmpty) return;
    final run = ++_run;
    _paused = false;
    final locale = platformLocaleFor(language);

    _progress.add(TtsProgress(TtsPhase.started, chunkCount: chunks.length));
    var i = 0;
    while (i < chunks.length) {
      if (run != _run) return;
      _progress.add(TtsProgress(TtsPhase.chunkStarted, chunkIndex: i, chunkCount: chunks.length));
      try {
        await _api.speak(chunks[i], locale: locale, rate: rate);
      } catch (error) {
        if (run != _run) return;
        throw TtsException('platform speech failed', spoken: i, cause: error);
      }
      if (run != _run) return;

      if (_interrupted) {
        // Cut short by a pause: this chunk plays again from its start once resumed.
        _interrupted = false;
        if (_paused) {
          final gate = _resumeGate = Completer<void>();
          await gate.future;
          if (run != _run) return;
        }
        continue;
      }
      i++;
    }
    if (run == _run) _progress.add(TtsProgress(TtsPhase.completed, chunkIndex: chunks.length - 1, chunkCount: chunks.length));
  }

  @override
  Future<void> pause() async {
    if (_paused) return;
    _paused = true;
    _interrupted = true;
    await _api.stop();
    _progress.add(const TtsProgress(TtsPhase.paused));
  }

  @override
  Future<void> resume() async {
    if (!_paused) return;
    _paused = false;
    final gate = _resumeGate;
    _resumeGate = null;
    if (gate != null && !gate.isCompleted) gate.complete();
    _progress.add(const TtsProgress(TtsPhase.resumed));
  }

  @override
  Future<void> stop() async {
    _run++;
    _paused = false;
    _interrupted = false;
    final gate = _resumeGate;
    _resumeGate = null;
    if (gate != null && !gate.isCompleted) gate.complete();
    await _api.stop();
    _progress.add(const TtsProgress(TtsPhase.stopped));
  }

  @override
  Future<void> dispose() async {
    await stop();
    await _progress.close();
  }
}
