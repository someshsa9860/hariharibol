import 'dart:async';
import 'dart:typed_data';

import '../core/constants/auto_chant_config.dart';
import '../models/mantra.dart';
import 'auto_chant_log.dart';
import 'chant_word_engine.dart' show WordTranscript;
import 'heard_words.dart';
import 'indic_sounds.dart';
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

  /// Rebuilt in [enable] when the sharper recogniser turns out to be in use,
  /// because it is matched against more (the mantra's own script) and held to a
  /// higher bar.
  MantraPhraseMatcher _matcher;
  final MantraRepetitionCounter _counter;

  final MantraAudioCapture _capture = MantraAudioCapture();
  final MantraDetectionEngine _engine = MantraDetectionEngine();

  /// What is being heard and what was, for the card on the counter. Shown while
  /// the switch is on; it takes no part in counting.
  final HeardWords hearing = HeardWords();

  final _statusController = StreamController<AutoChantStatus>.broadcast();
  final _repetitionController = StreamController<void>.broadcast();

  StreamSubscription<Float32List>? _audioSub;
  StreamSubscription<bool>? _voiceSub;
  StreamSubscription<WordTranscript>? _transcriptSub;
  StreamSubscription<String>? _errorSub;

  bool _enabled = false;

  /// Set when the app went to the background with auto-count on; [resume] turns
  /// it back on. Cleared by anything that turns it off for good.
  bool _resumeOnForeground = false;

  /// Counts the times it was switched off or sent to the background, so a start
  /// still loading the recogniser can tell it was told to stop meanwhile.
  int _stops = 0;
  bool _starting = false;

  /// Starting and stopping run one at a time, in the order they were asked for:
  /// the recogniser takes seconds to load, and coming back to the app can ask for
  /// a start before the stop that the app leaving asked for has finished.
  Future<void> _queue = Future.value();

  // What the log reports on — nothing here changes how anything is counted.
  final AudioMeter _meter = AudioMeter();
  Timer? _heartbeat;
  DateTime? _voiceSince;
  bool _wordsThisVoice = false;
  int _countedThisSitting = 0;
  String? _lastLoggedStatus;

  /// Whether this mantra has anything to listen for — phrases from the API,
  /// or its transliteration. The switch is hidden entirely when this is
  /// false, never shown disabled — this app does not ship controls that
  /// cannot do anything.
  bool get isSupported => _matcher.hasPhrases;

  Stream<AutoChantStatus> get statusStream => _statusController.stream;

  /// One event per completed repetition. The screen owning the bead count
  /// treats each event exactly like a manual tap.
  Stream<void> get repetitionDetected => _repetitionController.stream;

  /// How long one repetition takes at an ordinary pace: the mantra's own
  /// standard time, or — for one that has none — a length from its phrase.
  int get standardChantMs {
    if (mantra.durationMs > 0) return mantra.durationMs;
    final phrases = _matcher.foldedPhrases;
    if (phrases.isEmpty) return 0;
    return (phrases.first.length * AutoChantConfig.chantSecondsPerLetter * 1000).round();
  }

  Future<void> enable() => _inOrder(_start);

  Future<void> _inOrder(Future<void> Function() job) {
    final run = _queue.then((_) => job());
    _queue = run.catchError((Object _) {});
    return run;
  }

  Future<void> _start() async {
    if (!isSupported || _enabled) return;

    AutoChantLog.info(
      'enabling for "${mantra.name}" — listening for ${_matcher.foldedPhrases.length} phrase(s), '
      'as compared: ${_matcher.foldedPhrases}',
    );
    if (!await _capture.hasPermission()) {
      AutoChantLog.warn('microphone permission denied — auto-count stays off');
      _emitStatus(error: AutoChantError.permissionDenied);
      return;
    }
    AutoChantLog.info('microphone permission granted');

    final stopsBefore = _stops;
    _starting = true;
    try {
      await _engine.start(standardChantMs: standardChantMs);
      if (_stops != stopsBefore) return _abandonStart();
      if (_engine.isAccurate) {
        final script = mantra.scriptPhrase;
        _matcher = MantraPhraseMatcher(
          [...mantra.spokenPhrases, ?script],
          threshold: AutoChantConfig.accurateMatchThreshold,
        );
        AutoChantLog.info(
          'using the downloaded sharper recogniser — it needs ${(AutoChantConfig.accurateMatchThreshold * 100).round()}% '
          'to count, phrases as compared: ${_matcher.foldedPhrases}',
        );
      }
      final audio = await _capture.start();
      if (_stops != stopsBefore) {
        await _capture.stop();
        return _abandonStart();
      }
      AutoChantLog.info('microphone is streaming (${AutoChantConfig.sampleRate} Hz, mono)');
      _starting = false;
      _enabled = true;
      _counter.reset();
      _matcher.reset();
      _meter.take();
      _voiceSince = null;
      _wordsThisVoice = false;
      _countedThisSitting = 0;
      _lastLoggedStatus = null;
      hearing.clear();

      _voiceSub = _engine.voiceActive.listen(_onVoice);
      _transcriptSub = _engine.transcripts.listen(_onTranscript);
      _errorSub = _engine.errors.listen((message) {
        AutoChantLog.error('engine error', message);
        _emitStatus(error: AutoChantError.unavailable);
      });
      // The recorder can be taken away mid-sitting (a phone call, another app
      // opening the mic). Say so rather than sit "listening" to nothing.
      _audioSub = audio.listen(
        (samples) {
          _meter.add(samples);
          _engine.acceptWaveform(samples);
        },
        onError: (Object error, StackTrace stack) {
          AutoChantLog.error('microphone stream failed', error, stack);
          unawaited(_lostMicrophone());
        },
        onDone: () {
          AutoChantLog.warn('microphone stream ended');
          unawaited(_lostMicrophone());
        },
      );
      _heartbeat = Timer.periodic(AutoChantConfig.logHeartbeat, (_) => _logHeartbeat());

      AutoChantLog.info('LISTENING — chant now');
      _emitStatus();
    } catch (error, stack) {
      _starting = false;
      AutoChantLog.error('could not start', error, stack);
      await _teardown();
      _emitStatus(error: AutoChantError.unavailable);
    }
  }

  /// It was switched off, or the app left the screen, while this was still
  /// loading: do not leave the microphone on behind that.
  Future<void> _abandonStart() async {
    _starting = false;
    AutoChantLog.info('stopped while it was still starting — not listening');
    await _teardown();
    _emitStatus();
  }

  void _onVoice(bool active) {
    _counter.onVoiceActive(active);
    hearing.voice(active);
    if (active) {
      _voiceSince = DateTime.now();
      _wordsThisVoice = false;
      AutoChantLog.info('voice detected');
    } else {
      final since = _voiceSince;
      final seconds = since == null ? 0.0 : DateTime.now().difference(since).inMilliseconds / 1000;
      _voiceSince = null;
      AutoChantLog.info('voice stopped after ${seconds.toStringAsFixed(1)} s');
      if (!_wordsThisVoice) {
        AutoChantLog.warn(
          'that voice produced no words — a noise rather than speech, or too quiet or far for the recogniser',
        );
      }
    }
    _emitStatus();
  }

  void _onTranscript(WordTranscript transcript) {
    if (transcript.text.isNotEmpty) _wordsThisVoice = true;

    // Read before the matcher consumes it, so a miss can say how near it came.
    final near = _matcher.closest(transcript.text);
    final shown = readableScripts(transcript.text);
    AutoChantLog.info(
      'heard${transcript.isFinal ? ' (final)' : ''}: "${transcript.text}"'
      '${shown == transcript.text ? '' : ' — the card shows "$shown"'}'
      '${near == null ? '' : ' — ${_percent(near.ratio)} of the mantra, needs ${_percent(near.needed)}'}',
    );
    final heard = _matcher.update(transcript.text, isFinal: transcript.isFinal);
    if (transcript.isFinal) _matcher.reset();
    hearing.hear(
      transcript.text,
      isFinal: transcript.isFinal,
      counted: heard,
      match: near?.ratio,
      needed: near?.needed,
    );

    if (heard > 0) {
      _counter.onRepetitionsHeard(heard);
      _countedThisSitting += heard;
      AutoChantLog.info('COUNTED +$heard from "${transcript.text}" — $_countedThisSitting this sitting');
      for (var i = 0; i < heard; i++) {
        _repetitionController.add(null);
      }
    } else if (transcript.isFinal && transcript.text.isNotEmpty && near != null) {
      AutoChantLog.warn(
        'NOT counted: "${transcript.text}" matched ${_percent(near.ratio)} of the mantra, '
        'it needs ${_percent(near.needed)}',
      );
    }
    _emitStatus();
  }

  /// One line every few seconds that says the sitting is alive, and whether the
  /// microphone is giving it anything to hear.
  void _logHeartbeat() {
    if (!_enabled) return;
    final heard = _meter.take();
    final seconds = AutoChantConfig.logHeartbeat.inSeconds;
    AutoChantLog.info(
      'alive: ${heard.chunks} audio chunks in $seconds s, level ${heard.rms.toStringAsFixed(4)} '
      '(peak ${heard.peak.toStringAsFixed(3)}), $_countedThisSitting counted, '
      'phase ${_counter.phase.name}',
    );
    if (heard.chunks == 0) {
      AutoChantLog.warn('no audio from the microphone in the last $seconds s');
    } else if (heard.peak < AutoChantConfig.logSilentPeak) {
      AutoChantLog.warn('the microphone is delivering silence — muted, or another app has taken it');
    }
  }

  static String _percent(double ratio) => '${(ratio * 100).round()}%';

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
    if (_enabled || _starting) {
      _resumeOnForeground = true;
      AutoChantLog.info('the app went to the background — auto-count paused until it comes back');
    }
    return _inOrder(_stop);
  }

  /// The app is back on screen: listen again if [suspend] stopped it, and not
  /// if the person had it off or turned it off themselves.
  Future<void> resume() async {
    if (!_resumeOnForeground) return;
    _resumeOnForeground = false;
    AutoChantLog.info('the app is back — switching auto-count on again');
    await enable();
  }

  Future<void> _stop() async {
    if (!_enabled) return;
    AutoChantLog.info('disabled — $_countedThisSitting counted this sitting');
    await _teardown();
    _emitStatus();
  }

  Future<void> dispose() async {
    _resumeOnForeground = false;
    _stops += 1; // a start still loading gives up rather than turn the mic on
    if (_enabled) AutoChantLog.info('screen closed — $_countedThisSitting counted this sitting');
    await _teardown();
    await _statusController.close();
    await _repetitionController.close();
    hearing.dispose();
  }

  Future<void> _teardown() async {
    _enabled = false;
    hearing.voice(false);
    _heartbeat?.cancel();
    _heartbeat = null;
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
    AutoChantLog.warn('lost the microphone — auto-count has stopped');
    await _teardown();
    _emitStatus(error: AutoChantError.unavailable);
  }

  void _emitStatus({AutoChantError? error}) {
    if (_statusController.isClosed) return;
    final shown = 'enabled=$_enabled phase=${_counter.phase.name}${error == null ? '' : ' error=${error.name}'}';
    if (shown != _lastLoggedStatus) {
      _lastLoggedStatus = shown;
      AutoChantLog.info('status: $shown');
    }
    _statusController.add(AutoChantStatus(enabled: _enabled, phase: _counter.phase, error: error));
  }
}
