import 'dart:math' as math;
import 'dart:typed_data';

import '../core/constants/auto_chant_config.dart';

/// Why a stretch of voice was cut.
enum VirtualPauseCut {
  /// A dip in the chanting, found after a repetition's worth of it.
  dip,

  /// No dip came; the longest a repetition should take ran out.
  limit,
}

/// Decides where an unbroken chant is cut into repetitions for the recogniser.
///
/// The sharper recogniser decodes a stretch of voice only once it ends, and a
/// chant with no pause never ends — so the count would arrive in a lump seconds
/// late, with a repetition possibly cut in half by a fixed time limit. Instead,
/// once a stretch has run about as long as one repetition of this mantra takes
/// (its standard chanting time), the next dip in the voice ends it. The pause is
/// *virtual*: the microphone keeps recording and the next stretch begins at once;
/// only the audio handed to the recogniser is cut. If no dip comes, it is cut at
/// [AutoChantConfig.virtualPauseLatest] times the standard time anyway.
///
/// Pure Dart, no recogniser — `test/chant_virtual_pause_test.dart`.
class VirtualPause {
  /// [standardMs] is how long one repetition takes at an ordinary pace.
  VirtualPause(int standardMs)
      : _from = _samples(standardMs, AutoChantConfig.virtualPauseFrom),
        _latest = _samples(standardMs, AutoChantConfig.virtualPauseLatest);

  static int _samples(int standardMs, double times) {
    final seconds = math.max(standardMs / 1000, AutoChantConfig.virtualPauseMinSeconds);
    return (seconds * times * AutoChantConfig.sampleRate).round();
  }

  static const int _frameSamples = AutoChantConfig.sampleRate * AutoChantConfig.virtualPauseFrameMs ~/ 1000;
  static const int _dipFrames = AutoChantConfig.virtualPauseDipMs ~/ AutoChantConfig.virtualPauseFrameMs;

  final int _from;
  final int _latest;

  int _samplesSoFar = 0;
  double _frameEnergy = 0;
  int _inFrame = 0;
  double _levelSum = 0;
  int _frames = 0;
  int _quietRun = 0;

  /// How long a stretch may run before the first dip ends it.
  Duration get from => Duration(microseconds: _from * 1000000 ~/ AutoChantConfig.sampleRate);

  /// How long a stretch may run at the most.
  Duration get latest => Duration(microseconds: _latest * 1000000 ~/ AutoChantConfig.sampleRate);

  /// Takes the next [chunk] of the current stretch of voice. Non-null when the
  /// stretch should be handed to the recogniser now; it has then started over.
  VirtualPauseCut? add(Float32List chunk) {
    _samplesSoFar += chunk.length;
    for (final sample in chunk) {
      _frameEnergy += sample * sample;
      if (++_inFrame < _frameSamples) continue;
      final level = math.sqrt(_frameEnergy / _frameSamples);
      // Judged against the stretch so far, so a quiet chanter and a loud one
      // are each dipping when they fall well below their own voice. Not before
      // there is enough of the voice to know what it sounds like.
      final warm = _frames >= 2 * _dipFrames;
      final quiet = warm && level < AutoChantConfig.virtualPauseDipShare * (_levelSum / _frames);
      _quietRun = quiet ? _quietRun + 1 : 0;
      _levelSum += level;
      _frames += 1;
      _frameEnergy = 0;
      _inFrame = 0;
    }

    final VirtualPauseCut? cut = _samplesSoFar >= _latest
        ? VirtualPauseCut.limit
        : (_samplesSoFar >= _from && _quietRun >= _dipFrames ? VirtualPauseCut.dip : null);
    if (cut != null) reset();
    return cut;
  }

  /// The stretch ended some other way (the voice stopped); the next starts afresh.
  void reset() {
    _samplesSoFar = 0;
    _frameEnergy = 0;
    _inFrame = 0;
    _levelSum = 0;
    _frames = 0;
    _quietRun = 0;
  }
}
