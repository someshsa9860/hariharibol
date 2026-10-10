import 'dart:async';

import 'text_chunker.dart';
import 'tts_engine.dart';

/// The engine the reading player uses: the offline neural voice when one is
/// installed for the language, the phone's own otherwise — and the phone's own
/// again if the neural one fails part-way, carrying on from the chunk it
/// stopped at. Speech is never blocked on a download.
class AdaptiveTtsEngine implements TtsEngine {
  AdaptiveTtsEngine({
    required this._neural,
    required this._platform,
    this.onNeuralMissing,
  }) {
    _subs = [_neural.progress.listen(_progress.add), _platform.progress.listen(_progress.add)];
  }

  final TtsEngine _neural;
  final TtsEngine _platform;

  /// Called (fire and forget) when a language was spoken by the fallback because
  /// no neural voice is installed — the hook that starts the download.
  final void Function(String language)? onNeuralMissing;

  final StreamController<TtsProgress> _progress = StreamController<TtsProgress>.broadcast();
  late final List<StreamSubscription<TtsProgress>> _subs;
  TtsEngine? _active;

  @override
  String get id => 'adaptive';

  @override
  Stream<TtsProgress> get progress => _progress.stream;

  @override
  Future<bool> canSpeak(String language) async => await _neural.canSpeak(language) || await _platform.canSpeak(language);

  @override
  Future<void> speak(String text, {required String language, double rate = 1.0}) async {
    if (await _neural.canSpeak(language)) {
      _active = _neural;
      try {
        await _neural.speak(text, language: language, rate: rate);
        return;
      } on TtsException catch (error) {
        // Carry on from where the neural voice stopped, in the phone's.
        final chunks = TextChunker.split(text);
        final rest = chunks.skip(error.spoken).join(' ');
        if (rest.isEmpty) return;
        _active = _platform;
        await _platform.speak(rest, language: language, rate: rate);
        return;
      }
    }

    onNeuralMissing?.call(language);
    _active = _platform;
    await _platform.speak(text, language: language, rate: rate);
  }

  @override
  Future<void> pause() async => _active?.pause();

  @override
  Future<void> resume() async => _active?.resume();

  @override
  Future<void> stop() async {
    await _neural.stop();
    await _platform.stop();
  }

  @override
  Future<void> dispose() async {
    for (final sub in _subs) {
      await sub.cancel();
    }
    await _neural.dispose();
    await _platform.dispose();
    await _progress.close();
  }
}
