import 'dart:async';
import 'dart:typed_data';

import '../core/constants/auto_chant_config.dart';
import '../models/mantra.dart';
import 'chant_word_engine.dart' show WordTranscript;
import 'mantra_audio_capture.dart';
import 'mantra_detection_engine.dart';
import 'mantra_phrase_matcher.dart';
import 'mantra_repetition_counter.dart';

/// Why auto-count is not running. Kept as reasons rather than a message
/// string so the screen can put its own, localised words to each one.
enum AutoChantError {
  /// Microphone permission was denied.
  permissionDenied,

  /// Anything else — model files missing or corrupt, the isolate failed to
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
/// Owns the microphone, the VAD+keyword-spotting isolate and the repetition
/// state machine, and reduces all three to two things a screen actually
/// needs: a status to show, and a tick each time a repetition completes.
/// Scoped to one mantra for its whole life — switching mantras means a new
/// session, not a mutation of this one.
class MantraAutoChantSession {
  MantraAutoChantSession(this.mantra)
      : _matcher = MantraPhraseMatcher(mantra.spokenPhrases),
        _counter = MantraRepetitionCounter(cooldown: AutoChantConfig.defaultCooldown);

  final Mantra mantra;
  final MantraPhraseMatcher _matcher;
  final MantraRepetitionCounter _counter;

  final MantraAudioCapture _capture = MantraAudioCapture();
  final MantraDetectionEngine _engine = MantraDetectionEngine();

  final _statusController = StreamController<AutoChantStatus>.broadcast();
  final _repetitionController = StreamController<void>.broadcast();

  StreamSubscription<Float32List>? _audioSub;
  StreamSubscription<bool>? _voiceSub;
  StreamSubscription<WordTranscript>? _transcriptSub;
  StreamSubscription<String>? _errorSub;

  bool _enabled = false;

  /// Whether this mantra has anything to listen for — phrases from the API,
  /// or its transliteration. The switch is hidden entirely when this is
  /// false, never shown disabled — this app does not ship controls that
  /// cannot do anything.
  bool get isSupported => _matcher.hasPhrases;

  Stream<AutoChantStatus> get statusStream => _statusController.stream;

  /// One event per completed repetition. The screen owning the bead count
  /// treats each event exactly like a manual tap.
  Stream<void> get repetitionDetected => _repetitionController.stream;

  Future<void> enable() async {
    if (!isSupported || _enabled) return;

    if (!await _capture.hasPermission()) {
      _emitStatus(error: AutoChantError.permissionDenied);
      return;
    }

    try {
      await _engine.start();
      final audio = await _capture.start();
      _enabled = true;
      _counter.reset();
      _matcher.reset();

      _voiceSub = _engine.voiceActive.listen((active) {
        _counter.onVoiceActive(active);
        _emitStatus();
      });
      _transcriptSub = _engine.transcripts.listen((transcript) {
        final heard = _matcher.update(transcript.text, isFinal: transcript.isFinal);
        if (transcript.isFinal) _matcher.reset();
        if (heard > 0) {
          _counter.onRepetitionsHeard(heard);
          for (var i = 0; i < heard; i++) {
            _repetitionController.add(null);
          }
        }
        _emitStatus();
      });
      _errorSub = _engine.errors.listen((_) => _emitStatus(error: AutoChantError.unavailable));
      // The recorder can be taken away mid-sitting (a phone call, another app
      // opening the mic). Say so rather than sit "listening" to nothing.
      _audioSub = audio.listen(
        _engine.acceptWaveform,
        onError: (_) => unawaited(_lostMicrophone()),
        onDone: () => unawaited(_lostMicrophone()),
      );

      _emitStatus();
    } catch (_) {
      await _teardown();
      _emitStatus(error: AutoChantError.unavailable);
    }
  }

  /// Stops listening without losing the count already reached — turning the
  /// switch off is not the same as leaving the screen.
  Future<void> disable() async {
    if (!_enabled) return;
    await _teardown();
    _emitStatus();
  }

  Future<void> dispose() async {
    await _teardown();
    await _statusController.close();
    await _repetitionController.close();
  }

  Future<void> _teardown() async {
    _enabled = false;
    await _audioSub?.cancel();
    await _voiceSub?.cancel();
    await _transcriptSub?.cancel();
    await _errorSub?.cancel();
    _audioSub = null;
    _voiceSub = null;
    _transcriptSub = null;
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
