import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/constants/sadhana_config.dart';
import '../../core/constants/storage_keys.dart';
import '../../core/constants/support_config.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/mantra.dart';
import '../../models/reference_item.dart';
import '../../models/sadhana.dart';
import '../../providers/chant_audio_provider.dart';
import '../../providers/home_provider.dart';
import '../../providers/language_chain_provider.dart';
import '../../providers/sadhana_provider.dart';
import '../../services/chant_mala_player.dart';
import '../../services/chant_mala_timing.dart';
import '../../services/chant_pace.dart';
import '../../services/chant_progress_store.dart';
import '../../services/chant_recorder.dart';
import '../../services/chant_session_sync.dart';
import '../../services/fallback_prayer.dart';
import '../../services/local_store.dart';
import '../../services/mantra_auto_chant_session.dart';
import '../../services/mantra_service.dart';
import '../../services/review_prompter.dart';
import '../../widgets/chant/chant_along_card.dart';
import '../../widgets/chant/chant_auto_loading_dialog.dart';
import '../../widgets/chant/chant_mantra_text.dart';
import '../../widgets/chant/chant_disc.dart';
import '../../widgets/chant/chant_recent_taps.dart';
import '../../widgets/chant/chant_round_actions.dart';
import '../../widgets/chant/chant_summary_header.dart';
import '../../widgets/chant/chant_auto_card.dart';
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
/// passed brings the mantra itself, from where counting starts. A mantra with no
/// prayer of its own gets [FallbackPrayer] at the end of each round, so a round
/// never runs into the next on its own.
///
/// A mala recording stays on screen through the prayer, and pressing play ends
/// the prayer: the recording says it itself up to where its chanting starts (and
/// from 0:00 it has none, so the prayer on screen counts as said), so it is never
/// said twice. While the recording plays, auto count rests.
///
/// A round that is nearly done can be finished early
/// ([SadhanaConfig.canFinishRound]): the beads it lacks are added, so it counts
/// whole and the next one begins.
///
/// How long one chant takes is the reader's ([_pace]): the standard time to begin
/// with, changed by the buttons, and taught by each round they finish — the time
/// from the tap that began it to the tap that ended the prayer after it.
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

  /// The mantra's own prayer, shown before the first round as well as after each.
  Mantra? get _ownPrayer => widget.mantra?.prayer;

  /// What a mantra with no prayer of its own says between rounds: [FallbackPrayer],
  /// built when the first round ends, where the app's and the reading language
  /// are known.
  Mantra? _fallbackPrayer;

  /// The prayer between rounds: the mantra's own, else the fallback. A sitting
  /// with no mantra has none.
  Mantra? get _prayer => _ownPrayer ?? _fallbackPrayer;

  /// How long the prayer on screen takes to say, which is how long the tap that
  /// ends it waits.
  Duration get _prayerStandard {
    final own = _ownPrayer;
    return own != null
        ? Duration(milliseconds: MantraAutoChantSession.standardChantMsOf(own))
        : FallbackPrayer.standard;
  }

  /// The mantra's standard time for one chant; null with no mantra.
  Duration? _standard;

  /// How long one chant takes this reader (see [ChantPace]).
  Duration _pace = Duration.zero;

  /// Whether auto count listens (the default) or counts by time alone.
  AutoChantSource _source = AutoChantSource.microphone;

  /// When the tap that began the round in progress was made; null for a round
  /// picked up part-way, or one begun with no prayer before it.
  DateTime? _roundBeganAt;

  /// The round in progress still shows the reader's pace: false once the app was
  /// sent away, or a recording counted for them, during it.
  bool _roundLearnable = false;

  /// The prayer is showing in place of the mantra: before the first round and
  /// after each one. Nothing is counted while it is.
  bool _inPrayer = false;
  DateTime _prayerShownAt = DateTime.now();

  /// Auto count was left on, but the sitting opened on the prayer, so it starts
  /// when the prayer is over rather than listening to it.
  bool _autoStartAfterPrayer = false;

  /// Rounds already chanted today before this sitting, purely for the number
  /// in the ring — continuity with the day, not a reset to zero every time the
  /// screen opens.
  int _roundsBefore = 0;
  int _target = 0;
  bool _targetAnnounced = false;

  /// Counts taps, to restart the ring's ripple on each one.
  int _pulse = 0;

  /// Sends the sitting to the server as it goes.
  late final ChantSessionSync _session;
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

  /// The recording is playing: auto count rests and its switch cannot be turned.
  bool _recordingPlaying = false;

  /// Play was pressed while the prayer was on screen, so the recording is the one
  /// saying it. Only true during a prayer.
  bool _prayerByRecording = false;

  /// The recording would not load: the prayer then waits for a tap, as it does
  /// for a mantra with no recording.
  bool _recordingFailed = false;

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
    _session = ChantSessionSync(recorder: _recorder, mantraId: widget.mantra?.id);
    // A round left part-way carries on from where it was. Its prayer was said
    // when it began, so it is not asked for again.
    _recorder.carry(ChantProgressStore.read(widget.mantra?.id));
    // Only the mantra's own prayer opens the counter; the fallback one comes at
    // the end of a round.
    _inPrayer = _ownPrayer != null && _recorder.beadsInMala == 0;
    if (_inPrayer) _prayerShownAt = _now();
    _initPace();
    _targetAnnounced = _target > 0 && _roundsBefore >= _target;
    unawaited(_session.start());
    _initAutoChant();
    _initMala();

    _stopwatch.start();
    _clockTicker = Timer.periodic(_clockTick, (_) => _clock.value += 1);
  }

  void _initPace() {
    final mantra = widget.mantra;
    if (mantra == null) return;
    final standard = Duration(milliseconds: MantraAutoChantSession.standardChantMsOf(mantra));
    _standard = standard;
    _pace = ChantPaceStore.read(mantra.id, standard);
    _source = _savedMicrophone ? AutoChantSource.microphone : AutoChantSource.timer;
  }

  void _initAutoChant() {
    final mantra = widget.mantra;
    if (mantra == null) return;
    final session = MantraAutoChantSession(mantra, chantTime: _pace, source: _source);

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
      // The recording sets the pace of these chants, not the reader.
      _roundLearnable = false;
      // The round's last chant brings the prayer; any left over are not its.
      for (var i = 0; i < chants && !_inPrayer; i++) {
        _tapBead(auto: true);
      }
    });
    player.state.addListener(_onMalaState);
    unawaited(player.load());
  }

  void _onMalaState() {
    final mala = _mala;
    if (mala == null) return;
    final state = mala.state.value;
    final started = state.playing && !_recordingPlaying;
    // Pressing play is what hands the prayer to the recording: a position left
    // over from the round before is not the reader saying it. A recording that
    // starts at the mantra has nothing before it, so it ends the prayer at once;
    // one that starts later ends it when playback reaches the mantra.
    if (_inPrayer && started) _prayerByRecording = true;
    if (!state.playing) _prayerByRecording = false;
    if (_inPrayer && _prayerByRecording && state.position >= mala.timing.start) {
      _endPrayerByRecording();
    }
    final failed = state.phase == ChantMalaPhase.failed;
    if (state.playing != _recordingPlaying || failed != _recordingFailed) {
      setState(() {
        _recordingPlaying = state.playing;
        _recordingFailed = failed;
      });
    }
    // The microphone would hear the recording from the speaker and count every
    // chant a second time.
    if (started) {
      _autoStartAfterPrayer = false;
      unawaited(_autoChant?.disable());
    }
  }

  /// What the prayer on screen says to do. With a recording that carries the
  /// prayer the reader plays it instead of tapping the ring; one that could not
  /// load leaves the usual line.
  String? _prayerHint(AppLocalizations text) {
    final mala = _mala;
    if (mala == null || _recordingFailed) return null;
    return mala.timing.start > Duration.zero
        ? text.chantPrayerHintAlong
        : text.chantPrayerHintAlongNoPrayer;
  }

  /// The prayer was said with the recording, so there is no tap to wait for.
  /// Nothing is learned from the round before: the time it took to press play
  /// says nothing about how fast the reader chants.
  void _endPrayerByRecording() {
    _prayerByRecording = false;
    setState(() => _inPrayer = false);
    _counted.value += 1;
    _recorder.beginChanting();
    _roundBeganAt = null;
    _roundLearnable = false;
    _autoStartAfterPrayer = false;
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
      // A round with the app away in it says nothing about how fast it was
      // chanted: counting stopped while it was gone.
      _roundLearnable = false;
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
    if (state == AppLifecycleState.paused) _session.flush();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _session.close();
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
    if (!_finishing) unawaited(_session.send(finish: true));
    super.dispose();
  }

  /// A tap on the ring by hand. With auto count off nothing else says a chant
  /// happened, so a tap that comes before half of one chant's time (at the
  /// reader's pace) has passed since the last is ignored: otherwise the count
  /// runs ahead of the chanting. (No mantra, no pace, no limit. With auto count
  /// on, the sound or the clock is the count and a tap is only a correction.)
  void _tapRing() {
    if (_inPrayer) return _tapPrayer();
    if (widget.mantra != null && !_autoChantStatus.enabled) {
      if (!_recorder.tapAllowed(MantraAutoChantSession.manualTapGapOf(_pace))) return;
    }
    _tapBead();
  }

  /// The tap that ends the prayer. It is not a chant and is not recorded; it
  /// only counts once the prayer has had its standard time, so the mantra
  /// cannot be reached without the prayer being said.
  void _tapPrayer() {
    if (_now().difference(_prayerShownAt) < _prayerStandard) return;
    HapticFeedback.selectionClick();
    _learnFromRound();
    _prayerByRecording = false;
    setState(() => _inPrayer = false);
    _counted.value += 1;
    // The first chant of the mantra is timed from here, not from the round
    // before it or from the prayer — and so is the round, for what it teaches.
    _recorder.beginChanting();
    _roundBeganAt = _now();
    _roundLearnable = true;

    if (_autoStartAfterPrayer) {
      _autoStartAfterPrayer = false;
      unawaited(_startAutoChant());
    } else {
      unawaited(_autoChant?.resume());
    }
  }

  /// A round is done: the prayer comes before the next one.
  void _beginPrayer() {
    if (_ownPrayer == null) {
      _fallbackPrayer = FallbackPrayer.of(
        name: AppLocalizations.of(context).chantPrayerFallbackName,
        readingChain: ref.read(readingChainProvider),
      );
    }
    _prayerByRecording = false;
    setState(() => _inPrayer = true);
    _prayerShownAt = _now();
    // Neither the microphone nor the recording may count the prayer. The
    // recording goes back to its start, so playing it again is the next round.
    unawaited(_autoChant?.suspend());
    unawaited(_mala?.rewind());
  }

  /// The round just ended shows how fast this reader really chants: it ran from
  /// the tap that began it to the tap that ended the prayer after it, so its time
  /// over its chants is their pace, and auto count counts by it from the next
  /// round. Nothing is learned from a round picked up part-way, one begun with no
  /// prayer before it, or one the pace was changed, the app left or a recording
  /// counted in (a pace the reader chose by hand stands until a clean round).
  void _learnFromRound() {
    final began = _roundBeganAt;
    final standard = _standard;
    _roundBeganAt = null;
    if (began == null || standard == null || !_roundLearnable) return;
    final learned = ChantPace.ofRound(
      roundTime: _now().difference(began),
      prayer: _prayerStandard,
      chants: _beadsPerRoundInUse,
      standard: standard,
    );
    if (learned != null) _setPace(learned);
  }

  /// Takes [pace] as the time of one chant: kept for the mantra, counted by at
  /// once and shown.
  void _setPace(Duration pace) {
    final mantra = widget.mantra;
    if (mantra == null) return;
    setState(() => _pace = pace);
    ChantPaceStore.write(mantra.id, pace);
    _autoChant?.setChantTime(pace);
  }

  /// One press of the shorter / longer buttons.
  void _changePace({required bool longer}) {
    final standard = _standard;
    if (standard == null) return;
    final next = ChantPace.stepped(_pace, standard, longer: longer);
    if (next == _pace) return;
    HapticFeedback.selectionClick();
    // Their choice, not what the round shows.
    _roundLearnable = false;
    _setPace(next);
  }

  /// Keeps the round in progress on the phone. 0 (a round just finished)
  /// forgets it.
  void _saveProgress() => ChantProgressStore.write(widget.mantra?.id, _recorder.beadsInMala);

  void _tapBead({bool auto = false}) {
    HapticFeedback.selectionClick();
    _recorder.tap(auto: auto);
    _afterCount();
  }

  /// The round is done early: the beads it lacks are added, so the reader can go
  /// on to the next without chanting the rest of this one. Nothing is learned
  /// from a round that was cut short.
  void _finishRound() {
    if (_recorder.finishRound() == 0) return;
    _roundLearnable = false;
    _afterCount();
  }

  /// What follows beads being added, however they were added.
  void _afterCount() {
    final roundCompleted = _recorder.beadsInMala == 0;
    if (roundCompleted) HapticFeedback.mediumImpact();
    _saveProgress();
    setState(() => _pulse += 1);
    _counted.value += 1;
    if (roundCompleted && widget.mantra != null) _beginPrayer();

    if (!_targetAnnounced && _target > 0 && _totalRounds >= _target) {
      _targetAnnounced = true;
      AppNavigator.instance.showMessage(AppLocalizations.of(context).sadhanaTargetReached);
    }

    _session.schedule();
  }

  void _undoBead() {
    if (!_recorder.undo()) return;
    HapticFeedback.selectionClick();
    _saveProgress();
    setState(() {});
    _counted.value += 1;
    _session.schedule();
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

  /// Whether auto count listens with the microphone (the default). The store is
  /// not open in a test, and a failed read is simply "yes".
  bool get _savedMicrophone {
    try {
      return LocalStore.instance.read<bool>(BoxKeys.autoChantMicrophone) ?? true;
    } catch (_) {
      return true;
    }
  }

  void _saveMicrophone(bool useMicrophone) {
    try {
      unawaited(LocalStore.instance.write(BoxKeys.autoChantMicrophone, useMicrophone).catchError((_) {}));
    } catch (_) {
      // Not remembering is better than failing to switch it.
    }
  }

  /// The microphone switch: off counts by time alone, which keeps the battery.
  /// Remembered like the auto-count switch, and takes effect at once if auto
  /// count is running.
  Future<void> _toggleMicrophone(bool useMicrophone) async {
    final source = useMicrophone ? AutoChantSource.microphone : AutoChantSource.timer;
    if (source == _source) return;
    _saveMicrophone(useMicrophone);
    setState(() => _source = source);
    final session = _autoChant;
    if (session == null) return;
    // Back to the microphone means loading the detector again.
    if (useMicrophone && _autoChantStatus.enabled) {
      await _whileLoading(() => session.useSource(source));
    } else {
      await session.useSource(source);
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
    // Counting by time has nothing to load.
    if (_source == AutoChantSource.timer) return session.enable();
    await _whileLoading(session.enable);
  }

  /// The model takes a moment to load, and the switch would sit there looking
  /// dead: say what is happening until it is listening.
  Future<void> _whileLoading(Future<void> Function() job) async {
    if (!mounted) return;
    unawaited(
      showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (_) => const ChantAutoLoadingDialog(),
      ),
    );
    try {
      await job();
    } finally {
      if (mounted) Navigator.of(context, rootNavigator: true).pop();
    }
  }

  Future<void> _close() async {
    if (_finishing) return;
    setState(() => _finishing = true);
    // Nothing is counted after the sitting's last sync.
    await _mala?.pause();
    _session.cancel();
    await _session.send(finish: true);
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
                ChantMantraText(
                  mantra: widget.mantra,
                  prayer: _inPrayer ? _prayer : null,
                  prayerHint: _prayerHint(text),
                ),
                if (_mala != null) ...[
                  ChantAlongCard(player: _mala!),
                  const SizedBox(height: AppSpacing.lg),
                ],
                if (_target > 0) ...[
                  Text(
                    text.sadhanaRoundsProgress(
                      _totalRounds,
                      roundGoalFor(_target, _totalRounds),
                    ),
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
                ChantRoundActions(
                  onUndo: _recorder.beadsInMala > 0 ? _undoBead : null,
                  onFinish: SadhanaConfig.canFinishRound(_recorder.beadsInMala, _beadsPerRoundInUse)
                      ? _finishRound
                      : null,
                ),
                if (_autoChant != null && _standard != null && !_inPrayer)
                  ChantAutoCard(
                    status: _autoChantStatus,
                    useMicrophone: _source == AutoChantSource.microphone,
                    pace: _pace,
                    standard: _standard!,
                    beadsPerRound: _beadsPerRoundInUse,
                    onAutoChanged: _toggleAutoChant,
                    onMicrophoneChanged: _toggleMicrophone,
                    onPaceChange: _changePace,
                    resting: _recordingPlaying,
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
