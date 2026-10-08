import 'dart:async';
import 'dart:isolate';
import 'dart:typed_data';

import 'package:sherpa_onnx/sherpa_onnx.dart' as sherpa_onnx;

import '../core/constants/auto_chant_config.dart';
import 'mantra_detection_engine.dart';

/// Turns microphone audio into text on a background isolate, with the same
/// sherpa-onnx library and the same bundled model auto-count uses — the
/// keyword model is a small streaming speech recogniser underneath, so word
/// detection needs no second model and no Google or Apple speech service.
///
/// Audio never leaves the phone. Only the text reaches [transcripts], which is
/// the running transcript of the current utterance (it is revised as more is
/// heard) and `isFinal` once a pause has ended it.
class ChantWordEngine {
  Isolate? _isolate;
  SendPort? _workerPort;
  ReceivePort? _receivePort;

  final _transcriptController = StreamController<WordTranscript>.broadcast();
  final _errorController = StreamController<String>.broadcast();

  Stream<WordTranscript> get transcripts => _transcriptController.stream;
  Stream<String> get errors => _errorController.stream;

  /// Completes once the recogniser is built and ready for audio.
  Future<void> start() async {
    final config = await _prepareConfig();

    final receivePort = ReceivePort();
    _receivePort = receivePort;
    _isolate = await Isolate.spawn(_workerMain, receivePort.sendPort);

    final ready = Completer<void>();
    receivePort.listen((message) {
      if (message is SendPort) {
        _workerPort = message;
        message.send(_WordInit(config));
      } else if (message is _WordReady) {
        if (!ready.isCompleted) ready.complete();
      } else if (message is WordTranscript) {
        _transcriptController.add(message);
      } else if (message is _WordError) {
        _errorController.add(message.message);
        if (!ready.isCompleted) ready.completeError(message.message);
      }
    });
    return ready.future;
  }

  void acceptWaveform(Float32List samples) {
    _workerPort?.send(_WordAudio(samples));
  }

  Future<void> stop() async {
    _workerPort?.send(const _WordDispose());
    _isolate?.kill(priority: Isolate.immediate);
    _receivePort?.close();
    _isolate = null;
    _workerPort = null;
    _receivePort = null;
  }

  Future<void> dispose() async {
    await stop();
    await _transcriptController.close();
    await _errorController.close();
  }

  Future<sherpa_onnx.OnlineRecognizerConfig> _prepareConfig() async {
    final encoder = await MantraDetectionEngine.copyAsset(AutoChantConfig.kwsEncoderAsset);
    final decoder = await MantraDetectionEngine.copyAsset(AutoChantConfig.kwsDecoderAsset);
    final joiner = await MantraDetectionEngine.copyAsset(AutoChantConfig.kwsJoinerAsset);
    final tokens = await MantraDetectionEngine.copyAsset(AutoChantConfig.kwsTokensAsset);

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
      enableEndpoint: true,
    );
  }
}

/// What was heard so far in the current utterance.
class WordTranscript {
  const WordTranscript(this.text, {required this.isFinal});

  final String text;

  /// True once a pause ended the utterance; the next transcript starts afresh.
  final bool isFinal;
}

class _WordInit {
  const _WordInit(this.config);
  final sherpa_onnx.OnlineRecognizerConfig config;
}

class _WordAudio {
  const _WordAudio(this.samples);
  final Float32List samples;
}

class _WordDispose {
  const _WordDispose();
}

class _WordReady {
  const _WordReady();
}

class _WordError {
  const _WordError(this.message);
  final String message;
}

void _workerMain(SendPort mainSendPort) {
  final receivePort = ReceivePort();
  mainSendPort.send(receivePort.sendPort);

  sherpa_onnx.OnlineRecognizer? recognizer;
  sherpa_onnx.OnlineStream? stream;
  var lastText = '';

  receivePort.listen((message) {
    if (message is _WordInit) {
      try {
        sherpa_onnx.initBindings();
        recognizer = sherpa_onnx.OnlineRecognizer(message.config);
        stream = recognizer!.createStream();
        mainSendPort.send(const _WordReady());
      } catch (error) {
        mainSendPort.send(_WordError('$error'));
      }
    } else if (message is _WordAudio && recognizer != null) {
      try {
        stream!.acceptWaveform(samples: message.samples, sampleRate: AutoChantConfig.sampleRate);
        while (recognizer!.isReady(stream!)) {
          recognizer!.decode(stream!);
        }
        final text = recognizer!.getResult(stream!).text.trim();
        final ended = recognizer!.isEndpoint(stream!);
        if (text != lastText || (ended && text.isNotEmpty)) {
          lastText = text;
          mainSendPort.send(WordTranscript(text, isFinal: ended));
        }
        if (ended) {
          recognizer!.reset(stream!);
          lastText = '';
        }
      } catch (error) {
        mainSendPort.send(_WordError('$error'));
      }
    } else if (message is _WordDispose) {
      stream?.free();
      recognizer?.free();
      stream = null;
      recognizer = null;
      receivePort.close();
    }
  });
}
