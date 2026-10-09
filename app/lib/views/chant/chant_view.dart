import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/chant_log.dart';
import '../../models/mantra.dart';
import '../../providers/chant_audio_provider.dart';
import '../../providers/home_provider.dart';
import '../../providers/sadhana_provider.dart';
import '../../services/auto_chant_log.dart';
import '../../services/chant_mala_player.dart';
import '../../services/chant_mala_timing.dart';
import '../../services/chant_recorder.dart';
import '../../services/chant_speech_listener.dart';
import '../../services/mantra_auto_chant_session.dart';
import '../../services/mantra_service.dart';
import '../../services/sadhana_service.dart';
import '../../widgets/chant/chant_along_card.dart';
import '../../widgets/chant/chant_disc.dart';
import '../../widgets/chant/chant_recent_taps.dart';
import '../../widgets/chant/chant_summary_header.dart';
import '../../widgets/chant/chant_setup_sheet.dart';
import 'chant_analytics_view.dart';

/// The counter. Tap-driven, one bead at a time, the way a thumb moves along a
/// physical mala — a ring rather than a stopwatch, because a round is a shape
/// completed, not a duration elapsed.
///
/// Every tap is stamped as it lands and kept by a [ChantRecorder], so the
/// screen can show how long each chant, each mala and the whole sitting took —
/// and the same record is sent to the server as the sitting goes.
///
/// [mantra] is optional: most chanting on this sampradaya is the one
/// mahamantra, so this screen works with nothing chosen and simply opens a
/// session with no mantra attached. A mantra that has a mala recording also gets
/// a player, and each chant on the recording is counted as it ends.
class ChantView extends ConsumerStatefulWidget {
  const ChantView({super.key, this.mantra});

  final Mantra? mantra;

  @override
  ConsumerState<ChantView> createState() => _ChantViewState();
}

class _ChantViewState extends ConsumerState<ChantView> with WidgetsBindingObserver {
  static const int _beadsPerRound = 108;

  /// How often the two clocks redraw. They show whole seconds, so anything
  /// faster is repaint work nobody can see.
  static const Duration _clockTick = Duration(milliseconds: 500);

  /// What the day's own beads-per-round says, fixed for the sitting so a value
  /// changing under a ring mid-count never happens.
  late final int _beadsPerRoundInUse;
  late final ChantRecorder _recorder;

  String? _sessionId;

  /// Rounds already chanted today before this sitting, purely for the number
  /// in the ring — continuity with the day, not a reset to zero every time the
  /// screen opens.
  int _roundsBefore = 0;
  int _target = 0;
  bool _targetAnnounced = false;

  /// Counts taps, to restart the ring's ripple on each one.
  int _pulse = 0;

  Timer? _syncDebounce;
  bool _finishing = false;

  /// Null when this sitting has no mantra, or the mantra has no keyword
  /// configured — [AutoChantSwitch] simply does not appear in either case.
  MantraAutoChantSession? _autoChant;
  AutoChantStatus _autoChantStatus = AutoChantStatus.off;
  StreamSubscription<AutoChantStatus>? _autoChantStatusSub;
  StreamSubscription<void>? _autoChantRepetitionSub;

  /// Created the first time word detection is switched on.
  ChantSpeechListener? _speech;
  ChantSpeechState _speechState = ChantSpeechState.off;

  /// Bumped when either helper's status changes, so the setup sheet — which
  /// can be open over the counter — redraws without the whole screen doing so.
  final ValueNotifier<int> _setupChanged = ValueNotifier(0);

  /// Null when the mantra has no recording of a mala to chant along to.
  ChantMalaPlayer? _mala;
  StreamSubscription<int>? _malaChantsSub;
  bool _malaWasPlaying = false;

  /// Runs for the whole sitting, screen-open to screen-close — what "sitting
  /// time" on the counter means.
  final Stopwatch _stopwatch = Stopwatch();
  Timer? _clockTicker;

  /// Bumped by the clock; only the header listens, so the ring and the lists
  /// are not redrawn twice a second.
  final ValueNotifier<int> _clock = ValueNotifier(0);

  /// How many of the two listening helpers are running, for the button.
  int get _helpersOn =>
      (_autoChantStatus.enabled ? 1 : 0) +
      (_speechState == ChantSpeechState.listening || _speechState == ChantSpeechState.starting
          ? 1
          : 0);

  /// Listening only works with the screen on — a locked phone pauses the app,
  /// and with it the count — so the screen is held awake while either helper
  /// listens, as it is for the recording.
  bool _screenHeld = false;

  void _holdScreenForListening() {
    final want = _helpersOn > 0;
    if (want == _screenHeld) return;
    _screenHeld = want;
    unawaited(WakelockPlus.toggle(enable: want).catchError((_) {}));
  }

  int get _totalRounds => _roundsBefore + _recorder.completedMalas;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    final today = ref.read(sadhanaTodayProvider).value;
    _roundsBefore = today?.day.roundsCompleted ?? 0;
    _target = today?.day.roundTarget ?? 0;
    _beadsPerRoundInUse = today?.beadsPerRound ?? _beadsPerRound;
    _recorder = ChantRecorder(beadsPerRound: _beadsPerRoundInUse);
    _targetAnnounced = _target > 0 && _roundsBefore >= _target;
    unawaited(_startSession());
    _initAutoChant();
    _initMala();

    _stopwatch.start();
    _clockTicker = Timer.periodic(_clockTick, (_) => _clock.value += 1);
  }

  void _initAutoChant() {
    final mantra = widget.mantra;
    if (mantra == null) return;
    final session = MantraAutoChantSession(mantra);
    if (!session.isSupported) return;

    _autoChant = session;
    _autoChantStatusSub = session.statusStream.listen((status) {
      if (!mounted) return;
      setState(() => _autoChantStatus = status);
      _holdScreenForListening();
      _setupChanged.value += 1;
    });
    _autoChantRepetitionSub = session.repetitionDetected.listen((_) => _tapBead(auto: true));
    AutoChantLog.info('ready for "${mantra.name}" — switch it on from the setup sheet');
  }

  void _initMala() {
    final mantra = widget.mantra;
    if (mantra == null || !mantra.hasMalaAudio) return;

    // A recording is one mala, so it is split into as many chants as a round has.
    final player = ChantMalaPlayer(
      url: mantra.malaAudioUrl!,
      refreshUrl: () async => (await MantraService.instance.get(mantra.slug)).malaAudioUrl,
      timing: ChantMalaTiming(
        start: Duration(milliseconds: mantra.malaAudioStartMs),
        end: Duration(milliseconds: mantra.malaAudioEndMs),
        chants: _beadsPerRoundInUse,
      ),
      player: ref.read(malaAudioPlayerProvider)(),
    );
    _mala = player;
    _malaChantsSub = player.chantsCompleted.listen((chants) {
      for (var i = 0; i < chants; i++) {
        _tapBead(auto: true);
      }
    });
    player.state.addListener(_onMalaState);
    unawaited(player.load());
  }

  void _onMalaState() {
    final playing = _mala?.isPlaying ?? false;
    if (playing == _malaWasPlaying) return;
    _malaWasPlaying = playing;
    // Both listen on the microphone, which would hear the recording from the
    // speaker and count every chant a second time.
    if (playing) {
      if (_autoChantStatus.enabled) AutoChantLog.info('the recording started playing — switching auto-count off');
      unawaited(_autoChant?.disable());
      unawaited(_speech?.stop());
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // The mic has no business listening while the app cannot be seen. The
    // switches themselves are left as the user set them — coming back to the
    // app does not silently turn the mic back on. Only `paused` counts:
    // `inactive` is also a pulled-down notification shade or a system dialog,
    // and an hour's sitting should not end silently because of one.
    if (state == AppLifecycleState.paused) {
      if (_autoChantStatus.enabled) AutoChantLog.info('the app went to the background — switching auto-count off');
      unawaited(_autoChant?.disable());
      unawaited(_speech?.stop());
    }
    // A recording cannot be counted along to from the background.
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      unawaited(_mala?.pause());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _syncDebounce?.cancel();
    _clockTicker?.cancel();
    _clock.dispose();
    _setupChanged.dispose();
    // Let the screen go first, before anything is awaited.
    if (_screenHeld) unawaited(WakelockPlus.toggle(enable: false).catchError((_) {}));
    _stopwatch.stop();
    _autoChantStatusSub?.cancel();
    _autoChantRepetitionSub?.cancel();
    _malaChantsSub?.cancel();
    _mala?.state.removeListener(_onMalaState);
    unawaited(_mala?.dispose());
    _speech?.state.removeListener(_onSpeechState);
    unawaited(_speech?.dispose());
    unawaited(_autoChant?.dispose());
    // Best effort: dispose cannot be awaited, so a sync already in flight or
    // triggered here may not finish before the widget is gone. The explicit
    // close button is what actually waits for it.
    if (!_finishing) unawaited(_sync(finish: true));
    super.dispose();
  }

  Future<void> _startSession() async {
    try {
      final session = await SadhanaService.instance.startSession(mantraId: widget.mantra?.id);
      if (!mounted) return;
      setState(() => _sessionId = session.id);
      // Whatever was counted before the session existed goes up with it.
      if (_recorder.hasUnsent) _scheduleSync();
    } catch (_) {
      // Chanting does not wait on the network. A tap before the session
      // exists still counts locally, and the next sync retries the start.
    }
  }

  void _tapBead({bool auto = false}) {
    HapticFeedback.selectionClick();
    final tap = _recorder.tap(auto: auto);
    if (auto && _autoChantStatus.enabled) {
      AutoChantLog.info(
        'bead #${tap.seq} added to the counter (round ${_recorder.currentMala}, '
        '${_recorder.beadsInMala}/$_beadsPerRoundInUse)',
      );
    }

    final heard = _speech?.takeHeard();
    if (heard != null) {
      _recorder.attachHeard(
        ChantHeard(
          seq: tap.seq,
          malaIndex: _recorder.malaOf(tap.seq),
          text: heard.text,
          heardAt: tap.at,
          confidence: heard.confidence,
        ),
      );
    }

    final roundCompleted = _recorder.beadsInMala == 0;
    if (roundCompleted) HapticFeedback.mediumImpact();
    setState(() => _pulse += 1);

    if (!_targetAnnounced && _target > 0 && _totalRounds >= _target) {
      _targetAnnounced = true;
      AppNavigator.instance.showMessage(AppLocalizations.of(context).sadhanaTargetReached);
    }

    _scheduleSync(immediate: roundCompleted);
  }

  void _undoBead() {
    if (!_recorder.undo()) return;
    HapticFeedback.selectionClick();
    setState(() {});
    _scheduleSync();
  }

  Future<void> _toggleAutoChant(bool enabled) async {
    final session = _autoChant;
    if (session == null) return;
    AutoChantLog.info('switch turned ${enabled ? 'on' : 'off'}');
    if (!enabled) return session.disable();
    await _mala?.pause();
    await session.enable();
  }

  Future<void> _toggleWords(bool enabled) async {
    if (!enabled) {
      await _speech?.stop();
      return;
    }
    await _mala?.pause();
    final speech = _speech ?? (ChantSpeechListener()..state.addListener(_onSpeechState));
    _speech = speech;
    await speech.start();
  }

  void _onSpeechState() {
    final state = _speech?.state.value;
    if (state == null || !mounted) return;
    setState(() => _speechState = state);
    _holdScreenForListening();
    _setupChanged.value += 1;
  }

  void _scheduleSync({bool immediate = false}) {
    _syncDebounce?.cancel();
    if (immediate) {
      unawaited(_sync());
      return;
    }
    _syncDebounce = Timer(const Duration(seconds: 2), () => unawaited(_sync()));
  }

  Future<void> _sync({bool finish = false}) async {
    var id = _sessionId;
    id ??= await _retryStartSession();
    if (id == null) return;

    try {
      await SadhanaService.instance.updateSession(
        id,
        rounds: _recorder.completedMalas,
        beads: _recorder.beadsInMala,
        finish: finish,
      );
    } catch (_) {
      // A background sync failing is not something to interrupt chanting
      // for. The next tap schedules another one with the same running totals.
    }

    await _syncRecord(id);
  }

  /// Sends the rounds and words that changed since the last send. What fails
  /// is put back on the recorder, so the next sync carries it.
  Future<void> _syncRecord(String id) async {
    final malas = _recorder.takeDirtyMalas();
    final heard = _recorder.takeUnsentHeard();
    if (malas.isEmpty && heard.isEmpty) return;

    try {
      if (malas.isNotEmpty) await SadhanaService.instance.saveChantDetail(id, malas);
      if (heard.isNotEmpty) await SadhanaService.instance.saveChantTranscripts(id, heard);
    } catch (_) {
      _recorder.restoreUnsent(malas: malas, heard: heard);
    }
  }

  Future<String?> _retryStartSession() async {
    try {
      final session = await SadhanaService.instance.startSession(mantraId: widget.mantra?.id);
      if (mounted) setState(() => _sessionId = session.id);
      return session.id;
    } catch (_) {
      return null;
    }
  }

  Future<void> _close() async {
    if (_finishing) return;
    setState(() => _finishing = true);
    // Nothing is counted after the sitting's last sync.
    await _mala?.pause();
    _syncDebounce?.cancel();
    await _sync(finish: true);
    // The day this screen started from is stale the moment a round lands —
    // refreshed here rather than left for the tab's own pull to refresh.
    unawaited(ref.read(sadhanaTodayProvider.notifier).refresh());
    unawaited(ref.read(homeFeedProvider.notifier).refresh());
    if (mounted) Navigator.of(context).pop();
  }

  void _openSetup() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => ListenableBuilder(
        listenable: _setupChanged,
        builder: (_, _) => ChantSetupSheet(
          autoChantStatus: _autoChant == null ? null : _autoChantStatus,
          speechState: _speechState,
          onAutoChant: _autoChant == null ? null : _toggleAutoChant,
          onWords: _toggleWords,
        ),
      ),
    );
  }

  void _openAnalytics() {
    AppNavigator.instance.push(
      AppRoutes.chantAnalytics,
      extra: ChantAnalyticsArgs(
        malas: _recorder.malas,
        sittingTime: _stopwatch.elapsed,
        beadsPerRound: _beadsPerRoundInUse,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final title = widget.mantra?.name ?? text.sadhanaGenericChant;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _close();
      },
      child: Scaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.close_rounded),
            onPressed: _close,
          ),
          title: Text(title, style: context.texts.titleMedium),
          centerTitle: true,
          actions: [
            IconButton(
              icon: const Icon(Icons.insights_rounded),
              tooltip: text.chantAnalyticsTooltip,
              onPressed: _openAnalytics,
            ),
          ],
        ),
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.sm,
              AppSpacing.lg,
              AppSpacing.xxl,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ValueListenableBuilder<int>(
                  valueListenable: _clock,
                  builder: (context, _, _) => ChantSummaryHeader(
                    sittingTime: _stopwatch.elapsed,
                    malaTime: _recorder.currentMalaElapsed,
                    currentMala: _recorder.currentMala,
                    beadsInMala: _recorder.beadsInMala,
                    beadsPerRound: _beadsPerRoundInUse,
                    stats: _recorder.stats,
                  ),
                ),
                const SizedBox(height: AppSpacing.xl),
                if (widget.mantra != null) ...[
                  Text(
                    widget.mantra!.text,
                    textAlign: TextAlign.center,
                    style: AppTypography.verse(context, size: 22),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                ],
                if (_mala != null) ...[
                  ChantAlongCard(player: _mala!),
                  const SizedBox(height: AppSpacing.lg),
                ],
                if (_target > 0) ...[
                  Text(
                    text.sadhanaRoundsProgress(_totalRounds, _target),
                    textAlign: TextAlign.center,
                    style: context.texts.bodyMedium?.copyWith(
                      color: context.colors.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                ],
                Center(
                  child: ChantDisc(
                    beadsInRound: _recorder.beadsInMala,
                    roundsCompleted: _totalRounds,
                    roundsLabel: text.sadhanaRoundsCaption,
                    beadsPerRound: _beadsPerRoundInUse,
                    pulse: _pulse,
                    onTap: _tapBead,
                  ),
                ),
                Align(
                  child: IconButton(
                    onPressed: _recorder.beadsInMala > 0 ? _undoBead : null,
                    icon: const Icon(Icons.undo_rounded),
                    tooltip: text.sadhanaUndoBead,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                ChantRecentTaps(taps: _recorder.taps),
                const SizedBox(height: AppSpacing.xl),
                Center(
                  child: OutlinedButton.icon(
                    onPressed: _openSetup,
                    icon: const Icon(Icons.tune_rounded),
                    label: Text(
                      text.chantSetupButtonState(
                        text.chantSetupButton,
                        _helpersOn == 0 ? text.chantSetupNoneOn : text.chantSetupOn(_helpersOn),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
