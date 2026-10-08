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
import 'chant_word_engine.dart' show WordTranscript;

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

  /// Copies the bundled models to disk and starts the worker isolate.
  /// Completes once the native engines are built and ready for audio.
  Future<void> start() async {
    final vadConfig = await _prepareVadConfig();
    final asrConfig = await _prepareRecognizerConfig();

    final receivePort = ReceivePort();
    _receivePort = receivePort;
    _isolate = await Isolate.spawn(_workerMain, receivePort.sendPort);

    final ready = Completer<void>();
    receivePort.listen((message) {
      if (message is SendPort) {
        _workerPort = message;
        message.send(_InitRequest(vadConfig, asrConfig));
      } else if (message is _Ready) {
        if (!ready.isCompleted) ready.complete();
      } else if (message is _VoiceActiveChanged) {
        _voiceActiveController.add(message.active);
      } else if (message is WordTranscript) {
        _transcriptController.add(message);
      } else if (message is _WorkerError) {
        _errorController.add(message.message);
        if (!ready.isCompleted) ready.completeError(message.message);
      }
    });
    return ready.future;
  }

  /// Forwards one audio chunk to the worker. A no-op once [stop] has run.
  void acceptWaveform(Float32List samples) {
    _workerPort?.send(_AudioChunk(samples));
  }

  Future<void> stop() async {
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
  const _InitRequest(this.vad, this.asr);
  final sherpa_onnx.VadModelConfig vad;
  final sherpa_onnx.OnlineRecognizerConfig asr;
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
  var voiceWasActive = false;
  var lastText = '';

  final preRoll = Queue<Float32List>();
  var preRollSamples = 0;

  void closeUtterance() {
    final text = recognizer!.getResult(stream!).text.trim();
    if (text.isNotEmpty || lastText.isNotEmpty) {
      mainSendPort.send(WordTranscript(text, isFinal: true));
    }
    recognizer!.reset(stream!);
    lastText = '';
  }

  void feedRecognizer(Float32List chunk) {
    stream!.acceptWaveform(samples: chunk, sampleRate: AutoChantConfig.sampleRate);
    while (recognizer!.isReady(stream!)) {
      recognizer!.decode(stream!);
    }
    final text = recognizer!.getResult(stream!).text.trim();
    if (text != lastText) {
      lastText = text;
      mainSendPort.send(WordTranscript(text, isFinal: false));
    }
    // An hour of unbroken chanting must not become one unbounded string.
    if (text.length > AutoChantConfig.maxTranscriptLetters) closeUtterance();
  }

  receivePort.listen((message) {
    if (message is _InitRequest) {
      try {
        sherpa_onnx.initBindings();
        vad = sherpa_onnx.VoiceActivityDetector(config: message.vad, bufferSizeInSeconds: 30);
        recognizer = sherpa_onnx.OnlineRecognizer(message.asr);
        stream = recognizer!.createStream();
        mainSendPort.send(const _Ready());
      } catch (error) {
        mainSendPort.send(_WorkerError('$error'));
      }
    } else if (message is _AudioChunk && vad != null && recognizer != null) {
      try {
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
        if (active != voiceWasActive) {
          voiceWasActive = active;
          mainSendPort.send(_VoiceActiveChanged(active));
          if (active) {
            for (final chunk in preRoll) {
              feedRecognizer(chunk);
            }
            preRoll.clear();
            preRollSamples = 0;
          } else {
            // The recogniser holds back its last few syllables until it has
            // heard a little more; silence lets them out.
            feedRecognizer(Float32List(AutoChantConfig.endPaddingSamples));
            closeUtterance();
          }
        } else if (active) {
          feedRecognizer(message.samples);
        }
      } catch (error) {
        mainSendPort.send(_WorkerError('$error'));
      }
    } else if (message is _DisposeRequest) {
      stream?.free();
      recognizer?.free();
      vad?.free();
      stream = null;
      recognizer = null;
      vad = null;
      receivePort.close();
    }
  });
}
