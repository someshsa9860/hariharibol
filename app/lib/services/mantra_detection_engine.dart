import 'dart:async';
import 'dart:collection';
import 'dart:io';
import 'dart:isolate';
import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sherpa_onnx/sherpa_onnx.dart' as sherpa_onnx;

import '../core/constants/auto_chant_config.dart';
import 'auto_chant_log.dart';
import 'chant_word_engine.dart' show WordTranscript;
import 'mantra_accurate_model.dart';

/// Runs Silero VAD and an on-device speech recogniser on a background isolate
/// and exposes their output as plain streams: when a voice starts and stops,
/// and what it said.
///
/// What was said is matched to the open mantra on the main isolate (see
/// `MantraPhraseMatcher`), so this class knows nothing about any mantra — one
/// engine serves them all, and a mantra needs no model of its own.
///
/// The work happens off the UI isolate because it runs for the whole length of
/// a chanting sitting — anywhere from a few minutes to an hour. This mirrors
/// the isolate architecture sherpa-onnx's own Flutter microphone examples use.
class MantraDetectionEngine {
  Isolate? _isolate;
  SendPort? _workerPort;
  bool _accurate = false;
  ReceivePort? _receivePort;

  final _voiceActiveController = StreamController<bool>.broadcast();
  final _transcriptController = StreamController<WordTranscript>.broadcast();
  final _errorController = StreamController<String>.broadcast();

  /// Voice-activity edges from the VAD — one event per transition, not one
  /// per audio frame.
  Stream<bool> get voiceActive => _voiceActiveController.stream;

  /// The running transcript of the current stretch of voice (revised as more
  /// is heard), and a final one when the voice stops.
  Stream<WordTranscript> get transcripts => _transcriptController.stream;

  Stream<String> get errors => _errorController.stream;

  /// Whether this run uses the downloaded recogniser (decides what a transcript
  /// has to match by). Known once [start] has completed.
  bool get isAccurate => _accurate;

  /// Copies the bundled models to disk and starts the worker isolate.
  /// Completes once the native engines are built and ready for audio.
  Future<void> start() async {
    final clock = Stopwatch()..start();
    final accurateFiles = await MantraAccurateModel().installed();
    _accurate = accurateFiles != null;
    AutoChantLog.info(
      _accurate
          ? 'engine: using the downloaded sharper recogniser'
          : 'engine: copying the bundled models to disk',
    );
    final vadConfig = await _prepareVadConfig();
    final asrConfig = accurateFiles == null ? await _prepareRecognizerConfig() : null;
    final accurateConfig = accurateFiles == null ? null : _accurateRecognizerConfig(accurateFiles);
    AutoChantLog.info('engine: models on disk after ${clock.elapsedMilliseconds} ms, starting the worker isolate');

    final receivePort = ReceivePort();
    _receivePort = receivePort;
    // The same port takes the worker's own messages, an uncaught error in it
    // (a two-item list: error, stack) and its exit (null) — so a worker that
    // dies is heard about instead of leaving the screen "listening" to nothing.
    _isolate = await Isolate.spawn(
      _workerMain,
      receivePort.sendPort,
      onError: receivePort.sendPort,
      onExit: receivePort.sendPort,
    );

    final ready = Completer<void>();
    receivePort.listen((message) {
      if (message is SendPort) {
        _workerPort = message;
        message.send(_InitRequest(vadConfig, asrConfig, accurateConfig));
      } else if (message is _Ready) {
        AutoChantLog.info('engine: ready after ${clock.elapsedMilliseconds} ms');
        if (!ready.isCompleted) ready.complete();
      } else if (message is _VoiceActiveChanged) {
        _voiceActiveController.add(message.active);
      } else if (message is WordTranscript) {
        _transcriptController.add(message);
      } else if (message is _WorkerLog) {
        message.warn ? AutoChantLog.warn(message.text) : AutoChantLog.info(message.text);
      } else if (message is _WorkerError) {
        AutoChantLog.error('worker reported an error', message.message);
        _errorController.add(message.message);
        if (!ready.isCompleted) ready.completeError(message.message);
      } else if (message is List) {
        final reason = message.isEmpty ? 'unknown error' : '${message.first}';
        AutoChantLog.error('worker isolate crashed', reason, message.length > 1 ? message[1] : null);
        _errorController.add(reason);
        if (!ready.isCompleted) ready.completeError(reason);
      } else if (message == null) {
        AutoChantLog.warn('worker isolate exited');
        _errorController.add('the worker isolate exited');
        if (!ready.isCompleted) ready.completeError('the worker isolate exited before it was ready');
      }
    });
    return ready.future;
  }

  /// Forwards one audio chunk to the worker. A no-op once [stop] has run.
  void acceptWaveform(Float32List samples) {
    _workerPort?.send(_AudioChunk(samples));
  }

  Future<void> stop() async {
    if (_isolate != null) AutoChantLog.info('engine: stopping the worker isolate');
    _workerPort?.send(const _DisposeRequest());
    _isolate?.kill(priority: Isolate.immediate);
    _receivePort?.close();
    _isolate = null;
    _workerPort = null;
    _receivePort = null;
  }

  Future<void> dispose() async {
    await stop();
    await _voiceActiveController.close();
    await _transcriptController.close();
    await _errorController.close();
  }

  // ── Asset preparation (main isolate — needs the Flutter asset bundle) ──

  Future<sherpa_onnx.VadModelConfig> _prepareVadConfig() async {
    final model = await copyAsset(AutoChantConfig.vadModelAsset);
    return sherpa_onnx.VadModelConfig(
      sileroVad: sherpa_onnx.SileroVadModelConfig(
        model: model,
        threshold: AutoChantConfig.vadThreshold,
        minSilenceDuration: AutoChantConfig.vadMinSilenceDurationSeconds,
        minSpeechDuration: AutoChantConfig.vadMinSpeechDurationSeconds,
        maxSpeechDuration: AutoChantConfig.vadMaxSpeechDurationSeconds,
      ),
      sampleRate: AutoChantConfig.sampleRate,
      numThreads: 1,
      debug: false,
    );
  }

  Future<sherpa_onnx.OnlineRecognizerConfig> _prepareRecognizerConfig() async {
    final encoder = await copyAsset(AutoChantConfig.kwsEncoderAsset);
    final decoder = await copyAsset(AutoChantConfig.kwsDecoderAsset);
    final joiner = await copyAsset(AutoChantConfig.kwsJoinerAsset);
    final tokens = await copyAsset(AutoChantConfig.kwsTokensAsset);

    return sherpa_onnx.OnlineRecognizerConfig(
      model: sherpa_onnx.OnlineModelConfig(
        transducer: sherpa_onnx.OnlineTransducerModelConfig(
          encoder: encoder,
          decoder: decoder,
          joiner: joiner,
        ),
        tokens: tokens,
        numThreads: 1,
        debug: false,
      ),
    );
  }

  sherpa_onnx.OfflineRecognizerConfig _accurateRecognizerConfig(AccurateModelFiles files) {
    return sherpa_onnx.OfflineRecognizerConfig(
      model: sherpa_onnx.OfflineModelConfig(
        omnilingual: sherpa_onnx.OfflineOmnilingualAsrCtcModelConfig(model: files.model),
        tokens: files.tokens,
        numThreads: AutoChantConfig.accurateThreads,
        debug: false,
      ),
    );
  }

  /// Copies one asset to app-support storage and returns its real filesystem
  /// path — the native side needs a path, not an asset bundle key. Skips the
  /// copy when a file of the same size is already there.
  static Future<String> copyAsset(String assetPath) async {
    final dir = await getApplicationSupportDirectory();
    final target = p.join(dir.path, assetPath);
    final data = await rootBundle.load(assetPath);
    final file = File(target);
    if (!await file.exists() || await file.length() != data.lengthInBytes) {
      await file.create(recursive: true);
      await file.writeAsBytes(data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes));
    }
    return target;
  }
}

// ── Isolate protocol ───────────────────────────────────────────────────────
//
// Every message class here is plain data (strings, numbers, typed lists) —
// deliberately, since only plain data survives being sent across an isolate
// boundary. The native VAD and recogniser objects are built inside the worker
// itself, from the config carried by [_InitRequest], never passed in.

class _InitRequest {
  const _InitRequest(this.vad, this.asr, this.accurate);
  final sherpa_onnx.VadModelConfig vad;

  /// The bundled streaming recogniser — or, when [accurate] is set, null.
  final sherpa_onnx.OnlineRecognizerConfig? asr;

  /// The downloaded recogniser, which decodes a stretch of voice once it ends.
  final sherpa_onnx.OfflineRecognizerConfig? accurate;
}

class _AudioChunk {
  const _AudioChunk(this.samples);
  final Float32List samples;
}

class _DisposeRequest {
  const _DisposeRequest();
}

class _Ready {
  const _Ready();
}

class _VoiceActiveChanged {
  const _VoiceActiveChanged(this.active);
  final bool active;
}

class _WorkerError {
  const _WorkerError(this.message);
  final String message;
}

/// A line for the log, written by the worker and printed on the main isolate so
/// every line comes out of one place.
class _WorkerLog {
  const _WorkerLog(this.text, {this.warn = false});
  final String text;
  final bool warn;
}

/// About 0.6 seconds at 16kHz — covers Silero VAD's own onset lag (it only
/// reports "speech" after `minSpeechDuration` of continuous voice), so the
/// first syllable of a mantra is never silently dropped while the gate was
/// still closed.
const _preRollCapSamples = 9600;

void _workerMain(SendPort mainSendPort) {
  final receivePort = ReceivePort();
  mainSendPort.send(receivePort.sendPort);

  sherpa_onnx.VoiceActivityDetector? vad;
  sherpa_onnx.OnlineRecognizer? recognizer;
  sherpa_onnx.OnlineStream? stream;
  sherpa_onnx.OfflineRecognizer? offline;
  var voiceWasActive = false;
  var lastText = '';

  final preRoll = Queue<Float32List>();
  var preRollSamples = 0;

  // The downloaded recogniser's voice so far, waiting for the voice to stop.
  final voiced = <Float32List>[];
  var voicedSamples = 0;
  const maxVoicedSamples = AutoChantConfig.accurateMaxUtteranceSeconds * AutoChantConfig.sampleRate;

  // What the worker has done since it last reported, for the log.
  final clock = Stopwatch()..start();
  var lastReport = Duration.zero;
  var chunksIn = 0;
  var chunksFed = 0;
  var chunksWithVoice = 0;
  var slowestDecodeMs = 0;
  var chunkMs = 0;

  void log(String text, {bool warn = false}) {
    if (AutoChantConfig.logging) mainSendPort.send(_WorkerLog(text, warn: warn));
  }

  void reportIfDue() {
    if (!AutoChantConfig.logging) return;
    if (clock.elapsed - lastReport < AutoChantConfig.logHeartbeat) return;
    lastReport = clock.elapsed;
    log(
      'worker: $chunksIn chunks received, voice present in $chunksWithVoice, '
      '$chunksFed fed to the recogniser, slowest decode $slowestDecodeMs ms',
    );
    // A chunk is $chunkMs of sound; decoding it slower than that falls behind.
    if (chunkMs > 0 && slowestDecodeMs > chunkMs) {
      log(
        'recogniser took $slowestDecodeMs ms on a $chunkMs ms chunk — too slow to keep up in real time',
        warn: true,
      );
    }
    chunksIn = 0;
    chunksFed = 0;
    chunksWithVoice = 0;
    slowestDecodeMs = 0;
  }

  void closeUtterance() {
    final text = recognizer!.getResult(stream!).text.trim();
    if (text.isNotEmpty || lastText.isNotEmpty) {
      mainSendPort.send(WordTranscript(text, isFinal: true));
    }
    recognizer!.reset(stream!);
    lastText = '';
  }

  void feedRecognizer(Float32List chunk) {
    final decodeClock = Stopwatch()..start();
    stream!.acceptWaveform(samples: chunk, sampleRate: AutoChantConfig.sampleRate);
    while (recognizer!.isReady(stream!)) {
      recognizer!.decode(stream!);
    }
    chunksFed += 1;
    if (decodeClock.elapsedMilliseconds > slowestDecodeMs) slowestDecodeMs = decodeClock.elapsedMilliseconds;
    final text = recognizer!.getResult(stream!).text.trim();
    if (text != lastText) {
      lastText = text;
      mainSendPort.send(WordTranscript(text, isFinal: false));
    }
    // An hour of unbroken chanting must not become one unbounded string.
    if (text.length > AutoChantConfig.maxTranscriptLetters) closeUtterance();
  }

  /// Decodes what has been heard since the voice began, as one final transcript.
  void decodeVoiced() {
    if (voiced.isEmpty) return;
    final samples = Float32List(voicedSamples);
    var at = 0;
    for (final chunk in voiced) {
      samples.setAll(at, chunk);
      at += chunk.length;
    }
    voiced.clear();
    voicedSamples = 0;

    final decodeClock = Stopwatch()..start();
    final decodeStream = offline!.createStream();
    decodeStream.acceptWaveform(samples: samples, sampleRate: AutoChantConfig.sampleRate);
    offline!.decode(decodeStream);
    final text = offline!.getResult(decodeStream).text.trim();
    decodeStream.free();
    log('worker: decoded ${samples.length * 1000 ~/ AutoChantConfig.sampleRate} ms of voice in ${decodeClock.elapsedMilliseconds} ms');
    if (text.isNotEmpty) mainSendPort.send(WordTranscript(text, isFinal: true));
  }

  /// Voice that the recogniser should hear: streamed to the bundled one as it
  /// comes, gathered for the downloaded one.
  void hear(Float32List chunk) {
    if (offline == null) {
      feedRecognizer(chunk);
      return;
    }
    voiced.add(chunk);
    voicedSamples += chunk.length;
    if (voicedSamples >= maxVoicedSamples) decodeVoiced();
  }

  receivePort.listen((message) {
    if (message is _InitRequest) {
      try {
        sherpa_onnx.initBindings();
        log('worker: native library loaded after ${clock.elapsedMilliseconds} ms');
        vad = sherpa_onnx.VoiceActivityDetector(config: message.vad, bufferSizeInSeconds: 30);
        log('worker: voice detector built after ${clock.elapsedMilliseconds} ms');
        if (message.accurate != null) {
          offline = sherpa_onnx.OfflineRecognizer(message.accurate!);
        } else {
          recognizer = sherpa_onnx.OnlineRecognizer(message.asr!);
          stream = recognizer!.createStream();
        }
        log('worker: recogniser built after ${clock.elapsedMilliseconds} ms');
        mainSendPort.send(const _Ready());
      } catch (error) {
        mainSendPort.send(_WorkerError('$error'));
      }
    } else if (message is _AudioChunk && vad != null && (recognizer != null || offline != null)) {
      try {
        chunksIn += 1;
        chunkMs = message.samples.length * 1000 ~/ AutoChantConfig.sampleRate;
        preRoll.addLast(message.samples);
        preRollSamples += message.samples.length;
        while (preRollSamples > _preRollCapSamples && preRoll.length > 1) {
          preRollSamples -= preRoll.removeFirst().length;
        }

        vad!.acceptWaveform(message.samples);
        // The VAD buffers every completed speech segment internally until
        // drained — over an hour-long sitting, not draining it is a slow
        // memory leak. Its audio is not needed here, only the drain.
        while (!vad!.isEmpty()) {
          vad!.front();
          vad!.pop();
        }

        final active = vad!.isDetected();
        if (active) chunksWithVoice += 1;
        if (active != voiceWasActive) {
          voiceWasActive = active;
          mainSendPort.send(_VoiceActiveChanged(active));
          if (active) {
            for (final chunk in preRoll) {
              hear(chunk);
            }
            preRoll.clear();
            preRollSamples = 0;
          } else {
            if (offline != null) {
              decodeVoiced();
            } else {
              // The recogniser holds back its last few syllables until it has
              // heard a little more; silence lets them out.
              feedRecognizer(Float32List(AutoChantConfig.endPaddingSamples));
              closeUtterance();
            }
          }
        } else if (active) {
          hear(message.samples);
        }
      } catch (error) {
        mainSendPort.send(_WorkerError('$error'));
      }
      reportIfDue();
    } else if (message is _DisposeRequest) {
      stream?.free();
      recognizer?.free();
      offline?.free();
      vad?.free();
      stream = null;
      recognizer = null;
      offline = null;
      vad = null;
      receivePort.close();
    }
  });
}
