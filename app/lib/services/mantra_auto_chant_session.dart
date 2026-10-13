import 'dart:async';
import 'dart:typed_data';

import '../core/constants/auto_chant_config.dart';
import '../models/mantra.dart';
import 'mantra_audio_capture.dart';
import 'mantra_detection_engine.dart';
import 'mantra_repetition_counter.dart' show AutoChantPhase;
import 'voice_chant_counter.dart';

/// Why auto-count is not running. Kept as reasons rather than a message
/// string so the screen can put its own, localised words to each one.
enum AutoChantError {
  /// Microphone permission was denied.
  permissionDenied,

  /// Anything else — the model file missing or corrupt, the isolate failed to
  /// start, the recorder itself errored. Not actionable beyond "try again".
  unavailable,
}

/// What the switch and its status row show.
class AutoChantStatus {
  const AutoChantStatus({required this.enabled, required this.phase, this.error});

  final bool enabled;
  final AutoChantPhase phase;
  final AutoChantError? error;

  static const off = AutoChantStatus(enabled: false, phase: AutoChantPhase.idle);
}

/// One chanting sitting's worth of "listen and count".
///
/// Owns the microphone and the voice-detector isolate, and reduces them to two
/// things a screen needs: a status to show, and a tick each time a chant is
/// counted. A chant is counted for each standard time of sound (see
/// [VoiceChantCounter]); no words are recognised.
///
/// Scoped to one mantra for its whole life — switching mantras means a new
/// session. Everything it holds (microphone, isolate, model) is released by
/// [disable] and [dispose], so leaving the counter leaves nothing running.
class MantraAutoChantSession {
  MantraAutoChantSession(this.mantra)
      : _counter = VoiceChantCounter(
          standard: Duration(milliseconds: standardChantMsOf(mantra)),
          lead: Duration(milliseconds: (AutoChantConfig.vadMinSpeechDurationSeconds * 1000).round()),
          tail: Duration(milliseconds: (AutoChantConfig.vadMinSilenceDurationSeconds * 1000).round()),
          partialShare: AutoChantConfig.partialChantShare,
          countedFor: AutoChantConfig.defaultCooldown,
        );

  final Mantra mantra;
  final VoiceChantCounter _counter;

  final MantraAudioCapture _capture = MantraAudioCapture();
  final MantraDetectionEngine _engine = MantraDetectionEngine();

  final _statusController = StreamController<AutoChantStatus>.broadcast();
  final _repetitionController = StreamController<void>.broadcast();

  StreamSubscription<Float32List>? _audioSub;
  StreamSubscription<bool>? _voiceSub;
  StreamSubscription<String>? _errorSub;
  Timer? _ticker;

  bool _enabled = false;

  /// Set when the app went to the background with auto-count on; [resume] turns
  /// it back on. Cleared by anything that turns it off for good.
  bool _resumeOnForeground = false;

  /// Counts the times it was switched off or sent to the background, so a start
  /// still loading the model can tell it was told to stop meanwhile.
  int _stops = 0;
  bool _starting = false;

  /// Starting and stopping run one at a time, in the order they were asked for:
  /// the model takes a moment to load, and coming back to the app can ask for
  /// a start before the stop that the app leaving asked for has finished.
  Future<void> _queue = Future.value();

  /// How long one chant of [mantra] takes: the standard time set for it, or —
  /// for a mantra that has none — a length worked out from its text.
  static int standardChantMsOf(Mantra mantra) {
    if (mantra.durationMs > 0) return mantra.durationMs;
    final letters = (mantra.transliteration ?? mantra.text).replaceAll(RegExp(r'\s'), '').length;
    final seconds = letters * AutoChantConfig.chantSecondsPerLetter;
    return ((seconds < AutoChantConfig.minChantSeconds ? AutoChantConfig.minChantSeconds : seconds) * 1000).round();
  }

  int get standardChantMs => standardChantMsOf(mantra);

  Stream<AutoChantStatus> get statusStream => _statusController.stream;

  /// One event per counted chant. The screen owning the bead count treats each
  /// event exactly like a manual tap.
  Stream<void> get repetitionDetected => _repetitionController.stream;

  Future<void> enable() => _inOrder(_start);

  Future<void> _inOrder(Future<void> Function() job) {
    final run = _queue.then((_) => job());
    _queue = run.catchError((Object _) {});
    return run;
  }

  Future<void> _start() async {
    if (_enabled) return;

    if (!await _capture.hasPermission()) {
      _emitStatus(error: AutoChantError.permissionDenied);
      return;
    }

    final stopsBefore = _stops;
    _starting = true;
    try {
      await _engine.start();
      if (_stops != stopsBefore) return _abandonStart();
      final audio = await _capture.start();
      if (_stops != stopsBefore) {
        await _capture.stop();
        return _abandonStart();
      }
      _starting = false;
      _enabled = true;
      _counter.reset();

      _voiceSub = _engine.voiceActive.listen(_onVoice);
      _errorSub = _engine.errors.listen((_) => _emitStatus(error: AutoChantError.unavailable));
      // The recorder can be taken away mid-sitting (a phone call, another app
      // opening the mic). Say so rather than sit "listening" to nothing.
      _audioSub = audio.listen(
        _engine.acceptWaveform,
        onError: (Object error, StackTrace stack) => unawaited(_lostMicrophone()),
        onDone: () => unawaited(_lostMicrophone()),
      );
      _ticker = Timer.periodic(AutoChantConfig.countTick, (_) => _count(_counter.tick()));
      _emitStatus();
    } catch (_) {
      _starting = false;
      await _teardown();
      _emitStatus(error: AutoChantError.unavailable);
    }
  }

  /// It was switched off, or the app left the screen, while this was still
  /// loading: do not leave the microphone on behind that.
  Future<void> _abandonStart() async {
    _starting = false;
    await _teardown();
    _emitStatus();
  }

  void _onVoice(bool active) {
    _count(_counter.onVoice(active));
    _emitStatus();
  }

  void _count(int chants) {
    if (chants <= 0) return;
    for (var i = 0; i < chants; i++) {
      _repetitionController.add(null);
    }
    _emitStatus();
  }

  /// Stops listening without losing the count already reached — turning the
  /// switch off is not the same as leaving the screen.
  Future<void> disable() {
    _resumeOnForeground = false;
    _stops += 1;
    return _inOrder(_stop);
  }

  /// The app left the screen. The microphone must not listen unseen, so this
  /// stops it — but remembers it was on, so [resume] can turn it back on.
  Future<void> suspend() {
    _stops += 1;
    if (_enabled || _starting) _resumeOnForeground = true;
    return _inOrder(_stop);
  }

  /// The app is back on screen: listen again if [suspend] stopped it, and not
  /// if the person had it off or turned it off themselves.
  Future<void> resume() async {
    if (!_resumeOnForeground) return;
    _resumeOnForeground = false;
    await enable();
  }

  Future<void> _stop() async {
    if (!_enabled) return;
    await _teardown();
    _emitStatus();
  }

  Future<void> dispose() async {
    _resumeOnForeground = false;
    _stops += 1; // a start still loading gives up rather than turn the mic on
    await _teardown();
    await _statusController.close();
    await _repetitionController.close();
    await _engine.dispose();
  }

  Future<void> _teardown() async {
    _enabled = false;
    _ticker?.cancel();
    _ticker = null;
    _counter.reset();
    await _audioSub?.cancel();
    await _voiceSub?.cancel();
    await _errorSub?.cancel();
    _audioSub = null;
    _voiceSub = null;
    _errorSub = null;
    await _capture.stop();
    await _engine.stop();
  }

  Future<void> _lostMicrophone() async {
    if (!_enabled) return;
    await _teardown();
    _emitStatus(error: AutoChantError.unavailable);
  }

  void _emitStatus({AutoChantError? error}) {
    if (_statusController.isClosed) return;
    _statusController.add(AutoChantStatus(enabled: _enabled, phase: _counter.phase, error: error));
  }
}
