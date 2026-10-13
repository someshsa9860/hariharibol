import 'dart:async';
import 'dart:io';
import 'dart:isolate';
import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sherpa_onnx/sherpa_onnx.dart' as sherpa_onnx;

import '../core/constants/auto_chant_config.dart';

/// Runs Silero VAD on a background isolate and says when a voice starts and
/// stops. That is all it does: nothing is recognised, so it knows nothing about
/// any mantra or language, and one engine serves them all.
///
/// The work happens off the UI isolate because it runs for the whole length of
/// a chanting sitting. This mirrors the isolate architecture sherpa-onnx's own
/// Flutter microphone examples use.
class MantraDetectionEngine {
  Isolate? _isolate;
  SendPort? _workerPort;
  ReceivePort? _receivePort;

  final _voiceActiveController = StreamController<bool>.broadcast();
  final _errorController = StreamController<String>.broadcast();

  /// Voice-activity edges from the VAD — one event per transition, not one
  /// per audio frame.
  Stream<bool> get voiceActive => _voiceActiveController.stream;

  Stream<String> get errors => _errorController.stream;

  /// Copies the bundled model to disk and starts the worker isolate.
  /// Completes once the detector is built and ready for audio.
  Future<void> start() async {
    final vadConfig = await _prepareVadConfig();

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
        message.send(_InitRequest(vadConfig));
      } else if (message is _Ready) {
        if (!ready.isCompleted) ready.complete();
      } else if (message is _VoiceActiveChanged) {
        _voiceActiveController.add(message.active);
      } else if (message is _WorkerError) {
        _errorController.add(message.message);
        if (!ready.isCompleted) ready.completeError(message.message);
      } else if (message is List) {
        final reason = message.isEmpty ? 'unknown error' : '${message.first}';
        _errorController.add(reason);
        if (!ready.isCompleted) ready.completeError(reason);
      } else if (message == null) {
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

  /// Stops the worker and frees the model.
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
// boundary. The native detector is built inside the worker itself, from the
// config carried by [_InitRequest], never passed in.

class _InitRequest {
  const _InitRequest(this.vad);
  final sherpa_onnx.VadModelConfig vad;
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

void _workerMain(SendPort mainSendPort) {
  final receivePort = ReceivePort();
  mainSendPort.send(receivePort.sendPort);

  sherpa_onnx.VoiceActivityDetector? vad;
  var voiceWasActive = false;

  receivePort.listen((message) {
    if (message is _InitRequest) {
      try {
        sherpa_onnx.initBindings();
        vad = sherpa_onnx.VoiceActivityDetector(config: message.vad, bufferSizeInSeconds: 30);
        mainSendPort.send(const _Ready());
      } catch (error) {
        mainSendPort.send(_WorkerError('$error'));
      }
    } else if (message is _AudioChunk && vad != null) {
      try {
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
        }
      } catch (error) {
        mainSendPort.send(_WorkerError('$error'));
      }
    } else if (message is _DisposeRequest) {
      vad?.free();
      vad = null;
      receivePort.close();
    }
  });
}
