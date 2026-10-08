import 'dart:math' as math;

import 'package:flutter/foundation.dart';

import '../core/constants/auto_chant_config.dart';

/// Where auto-count says what it is doing, so a sitting can be followed in the
/// console: every line starts `[AutoChant hh:mm:ss.mmm]`, so filtering on
/// `AutoChant` shows nothing else.
///
/// Does nothing unless [AutoChantConfig.logging] is on. Goes through
/// [debugPrint], like the rest of the app, which reaches `flutter run`, the
/// Xcode console and `adb logcat`.
abstract final class AutoChantLog {
  static const String _tag = 'AutoChant';

  static bool get enabled => AutoChantConfig.logging;

  static void info(String message) => _write(message);

  /// Something that should have happened and did not, or looks wrong.
  static void warn(String message) => _write('WARN  $message');

  /// A failure. The [stack] is printed too, because "it stopped" is not enough
  /// to find where. Anything prints: a [StackTrace], or the text an isolate
  /// sends back in place of one.
  static void error(String message, Object error, [Object? stack]) {
    _write('ERROR $message: $error');
    if (stack != null) _write('ERROR $stack');
  }

  static void _write(String message) {
    if (!enabled) return;
    debugPrint('[$_tag ${_clock(DateTime.now())}] $message');
  }

  static String _clock(DateTime t) {
    String pad(int n, [int width = 2]) => n.toString().padLeft(width, '0');
    return '${pad(t.hour)}:${pad(t.minute)}:${pad(t.second)}.${pad(t.millisecond, 3)}';
  }
}

/// How much sound the microphone gave over a stretch — the quickest way to tell
/// "the mic is dead" from "the mic hears you and nothing was matched".
class AudioMeter {
  int _chunks = 0;
  int _samples = 0;
  double _peak = 0;
  double _sumSquares = 0;

  void add(Float32List samples) {
    _chunks += 1;
    _samples += samples.length;
    for (final sample in samples) {
      final magnitude = sample.abs();
      if (magnitude > _peak) _peak = magnitude;
      _sumSquares += sample * sample;
    }
  }

  /// Everything heard since the last call, then starts over. [rms] and [peak]
  /// are on the same 0–1 scale as the samples.
  ({int chunks, double rms, double peak}) take() {
    final result = (
      chunks: _chunks,
      rms: _samples == 0 ? 0.0 : math.sqrt(_sumSquares / _samples),
      peak: _peak,
    );
    _chunks = 0;
    _samples = 0;
    _peak = 0;
    _sumSquares = 0;
    return result;
  }
}
