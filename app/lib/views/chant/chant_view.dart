import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../core/constants/chant_sync_config.dart';
import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/constants/storage_keys.dart';
import '../../core/constants/support_config.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/mantra.dart';
import '../../models/reference_item.dart';
import '../../providers/chant_audio_provider.dart';
import '../../providers/home_provider.dart';
import '../../providers/sadhana_provider.dart';
import '../../services/chant_mala_player.dart';
import '../../services/chant_mala_timing.dart';
import '../../services/chant_progress_store.dart';
import '../../services/chant_recorder.dart';
import '../../services/local_store.dart';
import '../../services/mantra_auto_chant_session.dart';
import '../../services/mantra_service.dart';
import '../../services/review_prompter.dart';
import '../../services/sadhana_service.dart';
import '../../widgets/chant/chant_along_card.dart';
import '../../widgets/chant/chant_disc.dart';
import '../../widgets/chant/chant_recent_taps.dart';
import '../../widgets/chant/chant_summary_header.dart';
import '../../widgets/chant/auto_chant_switch.dart';
import 'chant_analytics_view.dart';
import 'chant_fullscreen_view.dart';

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
///
/// A mantra with a [Mantra.prayer] opens on the prayer, and shows it again
/// after every round: the prayer is not counted, and one tap once its time has
/// passed brings the mantra itself, from where counting starts.
///
/// The count of the round in progress is kept on the phone for each mantra
/// ([ChantProgressStore]), so closing the counter — or the app — and coming back
/// to the same mantra finds it where it was left.
class ChantView extends ConsumerStatefulWidget {
  const ChantView({super.key, this.mantra, this.clock});

  final Mantra? mantra;

  /// The time, for tests; the real clock when null.
  final DateTime Function()? clock;

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

  DateTime _now() => (widget.clock ?? DateTime.now)();

  Mantra? get _prayer => widget.mantra?.prayer;

  /// The prayer is showing in place of the mantra: before the first round and
  /// after each one. Nothing is counted while it is.
  bool _inPrayer = false;
  DateTime _prayerShownAt = DateTime.now();

  /// Auto count was left on, but the sitting opened on the prayer, so it starts
  /// when the prayer is over rather than listening to it.
  bool _autoStartAfterPrayer = false;

  String? _sessionId;

  /// Rounds already chanted today before this sitting, purely for the number
  /// in the ring — continuity with the day, not a reset to zero every time the
  /// screen opens.
  int _roundsBefore = 0;
  int _target = 0;
  bool _targetAnnounced = false;

  /// Counts taps, to restart the ring's ripple on each one.
  int _pulse = 0;

  /// Running while taps are waiting to be sent; see [_scheduleSync].
  Timer? _syncTimer;
  bool _finishing = false;

  /// Null when this sitting has no mantra, or the mantra has no keyword
  /// configured — [AutoChantSwitch] simply does not appear in either case.
  MantraAutoChantSession? _autoChant;
  AutoChantStatus _autoChantStatus = AutoChantStatus.off;
  StreamSubscription<AutoChantStatus>? _autoChantStatusSub;
  StreamSubscription<void>? _autoChantRepetitionSub;

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

  /// Bumped on every change to the count, so the full-screen picture (a route
  /// of its own) keeps up with taps and with auto-count.
  final ValueNotifier<int> _counted = ValueNotifier(0);

  /// Listening only works with the screen on — a locked phone pauses the app,
  /// and with it the count — so the screen is held awake while auto-count
  /// listens, as it is for the recording.
  bool _screenHeld = false;

  void _holdScreenForListening() {
    final want = _autoChantStatus.enabled;
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
    _recorder = ChantRecorder(beadsPerRound: _beadsPerRoundInUse, now: widget.clock);
    // A round left part-way carries on from where it was. Its prayer was said
    // when it began, so it is not asked for again.
    _recorder.carry(ChantProgressStore.read(widget.mantra?.id));
    _inPrayer = _prayer != null && _recorder.beadsInMala == 0;
    if (_inPrayer) _prayerShownAt = _now();
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

    _autoChant = session;
    _autoChantStatusSub = session.statusStream.listen((status) {
      if (!mounted) return;
      setState(() => _autoChantStatus = status);
      _holdScreenForListening();
    });
    _autoChantRepetitionSub = session.repetitionDetected.listen((_) {
      if (!_inPrayer) _tapBead(auto: true);
    });

    // Left on last time, it is on again now: the person chose it once.
    if (_savedAutoChant) {
      if (_inPrayer) {
        _autoStartAfterPrayer = true;
      } else {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) unawaited(_startAutoChant());
        });
      }
    }
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
      if (_inPrayer) return;
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
      unawaited(_autoChant?.disable());
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // The mic has no business listening while the app cannot be seen, so
    // auto-count stops — and starts again by itself when the app is back, if it
    // was on, or the person would find it dead after every glance at another
    // app. Only `paused` counts: `inactive` is also a pulled-down notification
    // shade or a system dialog, and an hour's sitting should not end silently
    // because of one.
    if (state == AppLifecycleState.paused) {
      unawaited(_autoChant?.suspend());
    } else if (state == AppLifecycleState.resumed && !_inPrayer) {
      // (Not during the prayer: it is not counted, and the mic stays off until
      // the prayer is over.)
      unawaited(_autoChant?.resume());
    }
    // A recording cannot be counted along to from the background.
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      unawaited(_mala?.pause());
    }
    // A timer is not a promise once the app is in the background, and the
    // system may end it there: send what is waiting while there is still time.
    if (state == AppLifecycleState.paused) _flushSync();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _syncTimer?.cancel();
    _clockTicker?.cancel();
    _clock.dispose();
    _counted.dispose();
    // Let the screen go first, before anything is awaited.
    if (_screenHeld) unawaited(WakelockPlus.toggle(enable: false).catchError((_) {}));
    _stopwatch.stop();
    _autoChantStatusSub?.cancel();
    _autoChantRepetitionSub?.cancel();
    _malaChantsSub?.cancel();
    _mala?.state.removeListener(_onMalaState);
    unawaited(_mala?.dispose());
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

  /// A tap on the ring by hand. With auto count off nothing else says a chant
  /// happened, so a tap that comes before half of one chant's time has passed
  /// since the last is ignored: otherwise the count runs ahead of the chanting.
  /// (No mantra, no standard time, no limit. With auto count on, the sound is
  /// the count and a tap is only a correction.)
  void _tapRing() {
    if (_inPrayer) return _tapPrayer();
    final mantra = widget.mantra;
    if (mantra != null && !_autoChantStatus.enabled) {
      if (!_recorder.tapAllowed(MantraAutoChantSession.manualTapGapOf(mantra))) return;
    }
    _tapBead();
  }

  /// The tap that ends the prayer. It is not a chant and is not recorded; it
  /// only counts once the prayer has had its standard time, so the mantra
  /// cannot be reached without the prayer being said.
  void _tapPrayer() {
    final prayer = _prayer;
    if (prayer != null) {
      final standard = Duration(milliseconds: MantraAutoChantSession.standardChantMsOf(prayer));
      if (_now().difference(_prayerShownAt) < standard) return;
    }
    HapticFeedback.selectionClick();
    setState(() => _inPrayer = false);
    _counted.value += 1;
    // The first chant of the mantra is timed from here, not from the round
    // before it or from the prayer.
    _recorder.beginChanting();

    if (_autoStartAfterPrayer) {
      _autoStartAfterPrayer = false;
      unawaited(_startAutoChant());
    } else {
      unawaited(_autoChant?.resume());
    }
  }

  /// A round is done: the prayer comes before the next one.
  void _beginPrayer() {
    setState(() => _inPrayer = true);
    _prayerShownAt = _now();
    // Neither the microphone nor the recording may count the prayer.
    unawaited(_autoChant?.suspend());
    unawaited(_mala?.pause());
  }

  /// Keeps the round in progress on the phone. 0 (a round just finished)
  /// forgets it.
  void _saveProgress() => ChantProgressStore.write(widget.mantra?.id, _recorder.beadsInMala);

  void _tapBead({bool auto = false}) {
    HapticFeedback.selectionClick();
    _recorder.tap(auto: auto);

    final roundCompleted = _recorder.beadsInMala == 0;
    if (roundCompleted) HapticFeedback.mediumImpact();
    _saveProgress();
    setState(() => _pulse += 1);
    _counted.value += 1;
    if (roundCompleted && _prayer != null) _beginPrayer();

    if (!_targetAnnounced && _target > 0 && _totalRounds >= _target) {
      _targetAnnounced = true;
      AppNavigator.instance.showMessage(AppLocalizations.of(context).sadhanaTargetReached);
    }

    _scheduleSync();
  }

  void _undoBead() {
    if (!_recorder.undo()) return;
    HapticFeedback.selectionClick();
    _saveProgress();
    setState(() {});
    _counted.value += 1;
    _scheduleSync();
  }

  /// Whether auto count was left on. The store is not open in a test, and a
  /// failed read is simply "off".
  bool get _savedAutoChant {
    try {
      return LocalStore.instance.read<bool>(BoxKeys.autoChantEnabled) ?? false;
    } catch (_) {
      return false;
    }
  }

  void _saveAutoChant(bool enabled) {
    try {
      unawaited(LocalStore.instance.write(BoxKeys.autoChantEnabled, enabled));
    } catch (_) {
      // Not remembering is better than failing to switch it.
    }
  }

  /// The switch. The choice is remembered, so the counter opens listening.
  Future<void> _toggleAutoChant(bool enabled) async {
    final session = _autoChant;
    if (session == null) return;
    _saveAutoChant(enabled);
    if (!enabled) return session.disable();
    await _startAutoChant();
  }

  Future<void> _startAutoChant() async {
    final session = _autoChant;
    if (session == null) return;
    await _mala?.pause();
    if (!mounted) return;
    // The model takes a moment to load, and the switch would sit there looking
    // dead: say what is happening until it is listening.
    unawaited(
      showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (_) => const _AutoChantLoadingDialog(),
      ),
    );
    try {
      await session.enable();
    } finally {
      if (mounted) Navigator.of(context, rootNavigator: true).pop();
    }
  }

  /// Marks that something is waiting to be sent. Taps are sent in batches: the
  /// first one after a send starts the clock, and the ones after it ride along
  /// without restarting it, so a steady chanter is saved every
  /// [ChantSyncConfig.batchInterval] and not once per chant.
  void _scheduleSync() {
    _syncTimer ??= Timer(ChantSyncConfig.batchInterval, () {
      _syncTimer = null;
      unawaited(_sync());
    });
  }

  /// Sends what is waiting now, without waiting out the batch — for when the
  /// app is about to go where a timer may not run.
  void _flushSync() {
    if (_syncTimer == null) return;
    _syncTimer!.cancel();
    _syncTimer = null;
    unawaited(_sync());
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
    _syncTimer?.cancel();
    _syncTimer = null;
    await _sync(finish: true);
    // The day this screen started from is stale the moment a round lands —
    // refreshed here rather than left for the tab's own pull to refresh.
    unawaited(ref.read(sadhanaTodayProvider.notifier).refresh());
    unawaited(ref.read(homeFeedProvider.notifier).refresh());
    final completedRound = _recorder.completedMalas > 0;
    if (mounted) Navigator.of(context).pop();
    // A round just finished is a happy moment; the prompter decides whether it
    // is a good one (a streak of days, nothing recent, never after a complaint).
    if (completedRound) {
      unawaited(ReviewPrompter.instance.maybeAsk(trigger: SupportConfig.triggerStreak));
    }
  }

  /// The picture in the ring: the list picture, or the 9:16 one when that is
  /// all the deity has. Null when it has neither.
  ({String url, String key})? _ringPicture(ReferenceItem? deity) {
    if (deity == null) return null;
    final list = deity.imageUrl;
    if (list != null && list.isNotEmpty) return (url: list, key: 'deity-${deity.id}');
    final full = deity.fullImageUrl;
    if (full != null && full.isNotEmpty) return (url: full, key: 'deity-full-${deity.id}');
    return null;
  }

  /// The whole picture. The 9:16 one fills the screen; a deity with only the
  /// list picture shows that, uncropped, instead of nothing.
  void _openFullPicture(ReferenceItem deity) {
    final full = deity.fullImageUrl;
    final hasFull = full != null && full.isNotEmpty;
    final picture = _ringPicture(deity);
    if (picture == null) return;

    Navigator.of(context).push(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => ChantFullscreenView(
          imageUrl: hasFull ? full : picture.url,
          imageKey: hasFull ? 'deity-full-${deity.id}' : picture.key,
          fit: hasFull ? BoxFit.cover : BoxFit.contain,
          counts: _counted,
          rounds: () => _totalRounds,
          beads: () => _recorder.beadsInMala,
          beadsPerRound: _beadsPerRoundInUse,
          onTap: _tapRing,
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
        mantraId: widget.mantra?.id,
        mantraName: widget.mantra?.name,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final title = widget.mantra?.name ?? text.sadhanaGenericChant;
    final deity = widget.mantra?.deity;
    final picture = _ringPicture(deity);

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
                if (_inPrayer && _prayer != null) ...[
                  Text(
                    _prayer!.name,
                    textAlign: TextAlign.center,
                    style: context.texts.titleMedium?.copyWith(color: context.colors.primary),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    _prayer!.text,
                    textAlign: TextAlign.center,
                    style: AppTypography.verse(context, size: 22),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    text.chantPrayerHint,
                    textAlign: TextAlign.center,
                    style: context.texts.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                ] else if (widget.mantra != null) ...[
                  Text(
                    widget.mantra!.text,
                    textAlign: TextAlign.center,
                    style: AppTypography.verse(context, size: 22),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                ],
                if (_mala != null && !_inPrayer) ...[
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
                    onTap: _tapRing,
                    pictureUrl: picture?.url,
                    pictureKey: picture?.key,
                    onOpenPicture: deity == null ? null : () => _openFullPicture(deity),
                    openPictureTooltip: text.chantFullPicture,
                  ),
                ),
                Align(
                  child: IconButton(
                    onPressed: _recorder.beadsInMala > 0 ? _undoBead : null,
                    icon: const Icon(Icons.undo_rounded),
                    tooltip: text.sadhanaUndoBead,
                  ),
                ),
                if (_autoChant != null && !_inPrayer)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                      child: AutoChantSwitch(status: _autoChantStatus, onChanged: _toggleAutoChant),
                    ),
                  ),
                const SizedBox(height: AppSpacing.md),
                ChantRecentTaps(taps: _recorder.taps),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Shown over the counter while auto-count's recogniser loads.
class _AutoChantLoadingDialog extends StatelessWidget {
  const _AutoChantLoadingDialog();

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: AlertDialog(
        content: Row(
          children: [
            const SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 3)),
            const SizedBox(width: AppSpacing.lg),
            Expanded(child: Text(AppLocalizations.of(context).chantAutoCountLoading)),
          ],
        ),
      ),
    );
  }
}
