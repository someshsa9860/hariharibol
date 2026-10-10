import 'dart:async';

import 'package:audio_session/audio_session.dart';

import 'reading_playback_controller.dart';

/// What to do when the phone takes the audio away: a call, another app's audio,
/// headphones pulled out.
///
///  * An interruption pauses the reading, and — if it was this that paused it —
///    resumes it when the interruption ends and the system says it may.
///  * Headphones unplugged pauses and does **not** resume: the voice would
///    otherwise start again from the speaker, out loud.
///  * A reader who paused it themselves is never resumed behind their back.
class InterruptionPolicy {
  InterruptionPolicy(this._reading);

  final ReadingPlaybackController _reading;
  bool _pausedByInterruption = false;

  Future<void> onInterruptionBegan() async {
    if (_reading.state.status != ReadingStatus.playing && _reading.state.status != ReadingStatus.loading) return;
    _pausedByInterruption = true;
    await _reading.pause();
  }

  Future<void> onInterruptionEnded({required bool mayResume}) async {
    final wasOurs = _pausedByInterruption;
    _pausedByInterruption = false;
    if (wasOurs && mayResume && _reading.state.status == ReadingStatus.paused) await _reading.resume();
  }

  Future<void> onBecomingNoisy() async {
    _pausedByInterruption = false;
    if (_reading.state.isActive && _reading.state.status != ReadingStatus.paused) await _reading.pause();
  }

  /// A manual pause or stop clears the memory of being interrupted.
  void onUserAction() => _pausedByInterruption = false;
}

/// Connects [InterruptionPolicy] to the system's audio session.
class ReadingAudioSession {
  ReadingAudioSession(this.policy);

  final InterruptionPolicy policy;
  final List<StreamSubscription<dynamic>> _subs = [];
  bool _started = false;

  /// Takes audio focus as spoken-word audio and starts listening. Safe to repeat.
  Future<void> start() async {
    if (_started) return;
    _started = true;
    final session = await AudioSession.instance;
    await session.configure(const AudioSessionConfiguration.speech());
    await session.setActive(true);

    _subs.add(session.interruptionEventStream.listen((event) {
      if (event.begin) {
        unawaited(policy.onInterruptionBegan());
      } else {
        // A "duck" never paused us; only a real pause/unknown interruption can resume.
        unawaited(policy.onInterruptionEnded(mayResume: event.type != AudioInterruptionType.duck));
      }
    }));
    _subs.add(session.becomingNoisyEventStream.listen((_) => unawaited(policy.onBecomingNoisy())));
  }

  Future<void> stop() async {
    _started = false;
    for (final sub in _subs) {
      await sub.cancel();
    }
    _subs.clear();
    try {
      await (await AudioSession.instance).setActive(false);
    } catch (_) {}
  }
}
