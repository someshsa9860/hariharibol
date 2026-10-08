import 'dart:async';
import 'dart:collection';
import 'dart:convert';
import 'dart:io';
import 'dart:isolate';
import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sherpa_onnx/sherpa_onnx.dart' as sherpa_onnx;

import '../core/constants/auto_chant_config.dart';

/// Runs Silero VAD and the keyword spotter on a background isolate and
/// exposes their output as two plain streams.
///
/// The decode work happens off the UI isolate because it runs for the whole
/// length of a chanting sitting — anywhere from a few minutes to an hour —
/// and nothing about that should ever compete with a frame budget. This
/// mirrors the isolate architecture sherpa-onnx's own Flutter microphone
/// examples use, not a pattern invented for this app.
class MantraDetectionEngine {
  Isolate? _isolate;
  SendPort? _workerPort;
  ReceivePort? _receivePort;

  final _voiceActiveController = StreamController<bool>.broadcast();
  final _keywordDetectedController = StreamController<void>.broadcast();
  final _errorController = StreamController<String>.broadcast();

  /// Voice-activity edges from the VAD — one event per transition, not one
  /// per audio frame.
  Stream<bool> get voiceActive => _voiceActiveController.stream;

  /// One event per completed keyword firing (already de-duplicated by the
  /// spotter's own stream reset — see the worker below).
  Stream<void> get keywordDetected => _keywordDetectedController.stream;

  Stream<String> get errors => _errorController.stream;

  /// Copies the bundled models to disk and starts the worker isolate,
  /// configured to spot [keyword]. Completes once the native engines are
  /// built and ready for audio.
  Future<void> start(MantraKeyword keyword) async {
    final vadConfig = await _prepareVadConfig();
    final kwsConfig = await _prepareKwsConfig(keyword);

    final receivePort = ReceivePort();
    _receivePort = receivePort;
    _isolate = await Isolate.spawn(_workerMain, receivePort.sendPort);

    final ready = Completer<void>();
    receivePort.listen((message) {
      if (message is SendPort) {
        _workerPort = message;
        message.send(_InitRequest(vadConfig, kwsConfig));
      } else if (message is _Ready) {
        if (!ready.isCompleted) ready.complete();
      } else if (message is _VoiceActiveChanged) {
        _voiceActiveController.add(message.active);
      } else if (message is _KeywordDetected) {
        _keywordDetectedController.add(null);
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
    await _keywordDetectedController.close();
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

  Future<sherpa_onnx.KeywordSpotterConfig> _prepareKwsConfig(MantraKeyword keyword) async {
    final encoder = await copyAsset(AutoChantConfig.kwsEncoderAsset);
    final decoder = await copyAsset(AutoChantConfig.kwsDecoderAsset);
    final joiner = await copyAsset(AutoChantConfig.kwsJoinerAsset);
    final tokens = await copyAsset(AutoChantConfig.kwsTokensAsset);

    return sherpa_onnx.KeywordSpotterConfig(
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
      maxActivePaths: AutoChantConfig.kwsMaxActivePaths,
      keywordsScore: AutoChantConfig.kwsBoostScore,
      keywordsThreshold: AutoChantConfig.kwsThreshold,
      keywordsBuf: keyword.tokens,
      keywordsBufSize: utf8.encode(keyword.tokens).length,
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
// boundary. The native VAD and keyword spotter objects are built inside the
// worker itself, from the config carried by [_InitRequest], never passed in.

class _InitRequest {
  const _InitRequest(this.vad, this.kws);
  final sherpa_onnx.VadModelConfig vad;
  final sherpa_onnx.KeywordSpotterConfig kws;
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

class _KeywordDetected {
  const _KeywordDetected();
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
  sherpa_onnx.KeywordSpotter? spotter;
  sherpa_onnx.OnlineStream? stream;
  var voiceWasActive = false;

  final preRoll = Queue<Float32List>();
  var preRollSamples = 0;

  void feedKws(Float32List chunk) {
    stream!.acceptWaveform(samples: chunk, sampleRate: AutoChantConfig.sampleRate);
    while (spotter!.isReady(stream!)) {
      spotter!.decode(stream!);
      final result = spotter!.getResult(stream!);
      if (result.keyword != '') {
        // Reset right away: the keyword's own detection window is now spent,
        // and leaving the stream unreset risks the same firing lingering
        // into the result of the very next decode step.
        spotter!.reset(stream!);
        mainSendPort.send(const _KeywordDetected());
      }
    }
  }

  receivePort.listen((message) {
    if (message is _InitRequest) {
      try {
        sherpa_onnx.initBindings();
        vad = sherpa_onnx.VoiceActivityDetector(config: message.vad, bufferSizeInSeconds: 30);
        spotter = sherpa_onnx.KeywordSpotter(message.kws);
        stream = spotter!.createStream();
        mainSendPort.send(const _Ready());
      } catch (error) {
        mainSendPort.send(_WorkerError('$error'));
      }
    } else if (message is _AudioChunk && vad != null) {
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
              feedKws(chunk);
            }
            preRoll.clear();
            preRollSamples = 0;
          }
        } else if (active) {
          feedKws(message.samples);
        }
      } catch (error) {
        mainSendPort.send(_WorkerError('$error'));
      }
    } else if (message is _DisposeRequest) {
      stream?.free();
      spotter?.free();
      vad?.free();
      receivePort.close();
    }
  });
}
