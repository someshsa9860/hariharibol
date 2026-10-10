import 'dart:async';
import 'dart:isolate';

import 'package:path/path.dart' as p;
import 'package:sherpa_onnx/sherpa_onnx.dart' as sherpa;

import '../../core/constants/tts_config.dart';
import '../../models/tts_model.dart';
import 'chunked_speaker.dart';
import 'tts_engine.dart';
import 'wav.dart';

/// Neural speech from a sherpa-onnx VITS/Piper voice, made in its own isolate.
///
/// The model is loaded once, in the isolate, and stays there: loading is the
/// slow part, a sentence is a fraction of its own playing time. Nothing here
/// touches the UI thread — the only thing that crosses back is the finished
/// samples, handed over without copying.
class SherpaSynthesizer implements TtsSynthesizer {
  SherpaSynthesizer._(this._isolate, this._send, this._receive);

  final Isolate _isolate;
  final SendPort _send;
  final ReceivePort _receive;
  final Map<int, Completer<TtsAudio>> _pending = {};
  int _next = 0;
  bool _disposed = false;

  /// Starts the isolate and loads the voice in [modelDir]. Throws
  /// [TtsException] if it cannot be loaded.
  static Future<SherpaSynthesizer> start({required String modelDir, required TtsModelSpec spec}) async {
    final receive = ReceivePort();
    final ready = Completer<SendPort>();
    final isolate = await Isolate.spawn(
      _entry,
      _Init(receive.sendPort, modelDir, spec.files, spec.speakerId),
      debugName: 'tts-${spec.id}',
    );

    late SherpaSynthesizer synth;
    late final StreamSubscription<dynamic> sub;
    sub = receive.listen((message) {
      if (message is SendPort) {
        ready.complete(message);
      } else if (message is _Failure && !ready.isCompleted) {
        ready.completeError(TtsException('could not load the voice', cause: message.error));
      } else if (message is _Result) {
        synth._complete(message);
      }
    });

    try {
      final send = await ready.future.timeout(const Duration(seconds: 30));
      synth = SherpaSynthesizer._(isolate, send, receive);
      return synth;
    } catch (_) {
      await sub.cancel();
      receive.close();
      isolate.kill(priority: Isolate.immediate);
      rethrow;
    }
  }

  void _complete(_Result result) {
    final waiter = _pending.remove(result.id);
    if (waiter == null || waiter.isCompleted) return;
    if (result.error != null) {
      waiter.completeError(TtsException('synthesis failed', cause: result.error));
      return;
    }
    final bytes = result.pcm!.materialize().asUint8List();
    waiter.complete(TtsAudio(bytes.buffer.asInt16List(bytes.offsetInBytes, bytes.lengthInBytes ~/ 2), result.sampleRate));
  }

  @override
  Future<TtsAudio> synthesize(String text, {double rate = 1.0}) {
    if (_disposed) return Future.error(const TtsException('the voice was released'));
    final id = _next++;
    final waiter = Completer<TtsAudio>();
    _pending[id] = waiter;
    _send.send(_Job(id, text, rate));
    return waiter.future;
  }

  @override
  Future<void> dispose() async {
    if (_disposed) return;
    _disposed = true;
    _send.send(null);
    for (final waiter in _pending.values) {
      if (!waiter.isCompleted) waiter.completeError(const TtsException('the voice was released'));
    }
    _pending.clear();
    _receive.close();
    _isolate.kill(priority: Isolate.beforeNextEvent);
  }

  // ── The isolate ────────────────────────────────────────────────────────

  static void _entry(_Init init) {
    final inbox = ReceivePort();
    sherpa.OfflineTts? tts;
    try {
      sherpa.initBindings();
      String? path(String? relative) => relative == null || relative.isEmpty ? null : p.join(init.modelDir, relative);
      tts = sherpa.OfflineTts(
        sherpa.OfflineTtsConfig(
          model: sherpa.OfflineTtsModelConfig(
            vits: sherpa.OfflineTtsVitsModelConfig(
              model: path(init.files.model)!,
              tokens: path(init.files.tokens)!,
              dataDir: path(init.files.dataDir) ?? '',
              lexicon: path(init.files.lexicon) ?? '',
            ),
            numThreads: TtsConfig.numThreads,
            debug: false,
          ),
        ),
      );
    } catch (error) {
      init.reply.send(_Failure(error.toString()));
      return;
    }
    init.reply.send(inbox.sendPort);

    inbox.listen((message) {
      if (message == null) {
        tts?.free();
        inbox.close();
        return;
      }
      final job = message as _Job;
      try {
        final audio = tts!.generate(text: job.text, sid: init.speaker, speed: job.rate);
        final pcm = floatToPcm16(audio.samples);
        init.reply.send(_Result(job.id, TransferableTypedData.fromList([pcm.buffer.asUint8List()]), audio.sampleRate, null));
      } catch (error) {
        init.reply.send(_Result(job.id, null, 0, error.toString()));
      }
    });
  }
}

class _Init {
  const _Init(this.reply, this.modelDir, this.files, this.speaker);

  final SendPort reply;
  final String modelDir;
  final TtsModelFiles files;
  final int speaker;
}

class _Job {
  const _Job(this.id, this.text, this.rate);

  final int id;
  final String text;
  final double rate;
}

class _Result {
  const _Result(this.id, this.pcm, this.sampleRate, this.error);

  final int id;
  final TransferableTypedData? pcm;
  final int sampleRate;
  final String? error;
}

class _Failure {
  const _Failure(this.error);

  final String error;
}
