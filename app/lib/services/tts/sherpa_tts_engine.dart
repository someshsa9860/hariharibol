import 'dart:async';

import 'chunked_speaker.dart';
import 'pcm_sink.dart';
import 'sherpa_synthesizer.dart';
import 'text_chunker.dart';
import 'tts_engine.dart';
import 'tts_model_manager.dart';

typedef SynthesizerFactory = Future<TtsSynthesizer> Function(InstalledVoice voice);

/// The offline neural voice. Speaks with whatever installed voice covers the
/// language, made in an isolate and played chunk by chunk with no gap.
class SherpaTtsEngine implements TtsEngine {
  SherpaTtsEngine({
    required this._manager,
    SynthesizerFactory? synthesizerFactory,
    TtsAudioSink Function()? sinkFactory,
    this.idleRelease = const Duration(minutes: 2),
  })  : _factory = synthesizerFactory ?? _sherpa,
        _sinkFactory = sinkFactory ?? JustAudioPcmSink.new;

  final TtsModelManager _manager;
  final SynthesizerFactory _factory;
  final TtsAudioSink Function() _sinkFactory;

  /// The loaded voice is released after this long unused; it holds tens of MB.
  final Duration idleRelease;

  static Future<TtsSynthesizer> _sherpa(InstalledVoice voice) =>
      SherpaSynthesizer.start(modelDir: voice.dir, spec: voice.spec);

  final StreamController<TtsProgress> _progress = StreamController<TtsProgress>.broadcast();
  StreamSubscription<TtsProgress>? _forwarding;
  ChunkedSpeaker? _speaker;
  TtsAudioSink? _sink;
  String? _voiceId;
  Timer? _idle;

  @override
  String get id => 'sherpa';

  @override
  Stream<TtsProgress> get progress => _progress.stream;

  @override
  Future<bool> canSpeak(String language) async => await _manager.installedFor(language) != null;

  @override
  Future<void> speak(String text, {required String language, double rate = 1.0}) async {
    final voice = await _manager.installedFor(language);
    if (voice == null) throw const TtsException('no voice installed for this language');
    final chunks = TextChunker.split(text);
    if (chunks.isEmpty) return;

    _idle?.cancel();
    final speaker = await _speakerFor(voice);
    try {
      await speaker.speak(chunks, rate: rate);
    } finally {
      _idle?.cancel();
      _idle = Timer(idleRelease, _release);
    }
  }

  Future<ChunkedSpeaker> _speakerFor(InstalledVoice voice) async {
    if (_speaker != null && _voiceId == voice.spec.id) return _speaker!;
    await _release();
    final TtsSynthesizer synth;
    try {
      synth = await _factory(voice);
    } catch (error) {
      throw TtsException('could not load the voice', cause: error);
    }
    _sink ??= _sinkFactory();
    final speaker = ChunkedSpeaker(synthesizer: synth, sink: _sink!);
    _forwarding = speaker.progress.listen(_progress.add);
    _speaker = speaker;
    _voiceId = voice.spec.id;
    return speaker;
  }

  Future<void> _release() async {
    final speaker = _speaker;
    _speaker = null;
    _voiceId = null;
    await _forwarding?.cancel();
    _forwarding = null;
    if (speaker != null) {
      await speaker.stop();
      await speaker.synthesizer.dispose();
    }
  }

  @override
  Future<void> pause() async => _speaker?.pause();

  @override
  Future<void> resume() async => _speaker?.resume();

  @override
  Future<void> stop() async => _speaker?.stop();

  @override
  Future<void> dispose() async {
    _idle?.cancel();
    await _release();
    await _sink?.dispose();
    _sink = null;
    await _progress.close();
  }
}
