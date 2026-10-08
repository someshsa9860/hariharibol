import 'dart:async';
import 'dart:typed_data';

import 'package:record/record.dart';

import '../core/constants/auto_chant_config.dart';

/// Raw microphone audio as mono 16 kHz float samples in `[-1, 1]` — the
/// format every model in the auto-count pipeline expects.
///
/// Wraps `record`: it is the mic-streaming plugin sherpa-onnx's own Flutter
/// examples use, and its own [AudioRecorder.hasPermission] is enough
/// permission handling on its own — a separate permission package would not
/// earn its place here for one permission.
class MantraAudioCapture {
  MantraAudioCapture() : _recorder = AudioRecorder();

  final AudioRecorder _recorder;
  StreamSubscription<Uint8List>? _sub;

  /// Checks microphone permission, prompting the OS dialog if it has not
  /// been decided yet. Callers should check this before [start] so a denial
  /// reads as a status, not a thrown exception.
  Future<bool> hasPermission() => _recorder.hasPermission();

  /// Starts streaming and returns mono float samples, chunked roughly every
  /// 100ms. The stream ends when [stop] is called or the recorder itself
  /// fails.
  Future<Stream<Float32List>> start() async {
    final raw = await _recorder.startStream(
      const RecordConfig(
        encoder: AudioEncoder.pcm16bits,
        sampleRate: AutoChantConfig.sampleRate,
        numChannels: 1,
        autoGain: true,
        noiseSuppress: true,
        streamBufferSize: 3200, // ~100ms at 16kHz, mono, 16-bit
        androidConfig: AndroidRecordConfig(
          // Listening must be silent and must leave the audio route alone: no
          // switching a Bluetooth headset into call mode (which beeps and
          // degrades whatever else is playing) and no muting other audio.
          manageBluetooth: false,
          muteAudio: false,
        ),
      ),
    );

    final controller = StreamController<Float32List>(onCancel: stop);
    _sub = raw.listen(
      (bytes) => controller.add(_pcm16ToFloat32(bytes)),
      onError: controller.addError,
      onDone: controller.close,
    );
    return controller.stream;
  }

  Future<void> stop() async {
    await _sub?.cancel();
    _sub = null;
    if (await _recorder.isRecording()) await _recorder.stop();
  }

  Future<void> dispose() async {
    await stop();
    await _recorder.dispose();
  }

  /// Little-endian PCM16 bytes to normalised float samples.
  static Float32List _pcm16ToFloat32(Uint8List bytes) {
    final byteData = ByteData.sublistView(bytes);
    final sampleCount = bytes.lengthInBytes ~/ 2;
    final out = Float32List(sampleCount);
    for (var i = 0; i < sampleCount; i++) {
      out[i] = byteData.getInt16(i * 2, Endian.little) / 32768.0;
    }
    return out;
  }
}
