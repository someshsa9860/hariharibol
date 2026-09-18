import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/mantra.dart';
import '../../providers/sadhana_provider.dart';
import '../../services/mantra_auto_chant_session.dart';
import '../../services/sadhana_service.dart';
import '../../widgets/chant/auto_chant_switch.dart';
import '../../widgets/common/animations.dart';
import '../../widgets/common/eyebrow.dart';
import '../../widgets/dashboard/mala_ring.dart';

/// The counter. Tap-driven, one bead at a time, the way a thumb moves along a
/// physical mala — a ring rather than a stopwatch, because a round is a shape
/// completed, not a duration elapsed.
///
/// [mantra] is optional: most chanting on this sampradaya is the one
/// mahamantra, so this screen works with nothing chosen and simply opens a
/// session with no mantra attached.
class ChantView extends ConsumerStatefulWidget {
  const ChantView({super.key, this.mantra});

  final Mantra? mantra;

  @override
  ConsumerState<ChantView> createState() => _ChantViewState();
}

class _ChantViewState extends ConsumerState<ChantView> with WidgetsBindingObserver {
  static const int _beadsPerRound = 108;

  /// Null until the day's own beads-per-round is read, then fixed for the
  /// sitting — a value changing under a ring mid-count would be confusing
  /// even if it never actually happens.
  int _beadsPerRoundInUse = _beadsPerRound;

  String? _sessionId;

  /// This sitting's own beads and rounds — what gets sent to the session.
  int _beads = 0;
  int _sessionRounds = 0;

  /// Today's total including whatever was chanted before this sitting, purely
  /// for the number shown in the ring — continuity with the day, not a reset
  /// to zero every time the screen opens.
  int _totalRounds = 0;
  int _target = 0;
  bool _targetAnnounced = false;

  Timer? _syncDebounce;
  bool _finishing = false;

  /// Null when this sitting has no mantra, or the mantra has no keyword
  /// configured — [AutoChantSwitch] simply does not appear in either case.
  MantraAutoChantSession? _autoChant;
  AutoChantStatus _autoChantStatus = AutoChantStatus.off;
  StreamSubscription<AutoChantStatus>? _autoChantStatusSub;
  StreamSubscription<void>? _autoChantRepetitionSub;

  /// Runs for the whole sitting, screen-open to screen-close — what "elapsed"
  /// on the counter means. Pace is a separate measure: taps, not wall time
  /// since opening, because a sitting can start with the phone just sitting
  /// there while attention is elsewhere.
  final Stopwatch _stopwatch = Stopwatch();
  Timer? _clockTicker;

  /// Every tap this sitting, counted independent of the ring wrapping at
  /// [_beadsPerRoundInUse] — pace is per repetition, not per round.
  int _tapsThisSitting = 0;

  /// The stopwatch reading at the very first tap. Pace is measured from here,
  /// not from zero, so the time spent reading the mantra before the first
  /// bead never gets folded into "how long one repetition takes."
  int? _firstTapMs;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    final today = ref.read(sadhanaTodayProvider).value;
    _totalRounds = today?.day.roundsCompleted ?? 0;
    _target = today?.day.roundTarget ?? 0;
    _beadsPerRoundInUse = today?.beadsPerRound ?? _beadsPerRound;
    _targetAnnounced = _target > 0 && _totalRounds >= _target;
    unawaited(_startSession());
    _initAutoChant();

    _stopwatch.start();
    // A tenth of a second is plenty for a number meant to be read, not raced
    // against — anything faster is repaint work nobody can actually see.
    _clockTicker = Timer.periodic(const Duration(milliseconds: 100), (_) {
      if (mounted) setState(() {});
    });
  }

  void _initAutoChant() {
    final mantra = widget.mantra;
    if (mantra == null) return;
    final session = MantraAutoChantSession(mantra);
    if (!session.isSupported) return;

    _autoChant = session;
    _autoChantStatusSub = session.statusStream.listen((status) {
      if (mounted) setState(() => _autoChantStatus = status);
    });
    _autoChantRepetitionSub = session.repetitionDetected.listen((_) => _tapBead());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // The mic has no business listening while the app cannot be seen. The
    // switch itself is left as the user set it — coming back to the app
    // does not silently turn the mic back on.
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      unawaited(_autoChant?.disable());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _syncDebounce?.cancel();
    _clockTicker?.cancel();
    _stopwatch.stop();
    _autoChantStatusSub?.cancel();
    _autoChantRepetitionSub?.cancel();
    unawaited(_autoChant?.dispose());
    // Best effort: dispose cannot be awaited, so a sync already in flight or
    // triggered here may not finish before the widget is gone. The explicit
    // close button is what actually waits for it.
    if (!_finishing) unawaited(_sync(finish: true));
    super.dispose();
  }

  /// Seconds since the screen opened, for the "elapsed" reading.
  double get _elapsedSeconds => _stopwatch.elapsedMilliseconds / 1000;

  /// Average seconds per repetition, from the first tap onward. Null until
  /// there have been at least two taps — one tap alone has no interval to
  /// measure yet, and showing "0.0s" would read as a stopped watch rather
  /// than as "not enough data."
  double? get _paceSeconds {
    final firstTapMs = _firstTapMs;
    if (firstTapMs == null || _tapsThisSitting < 2) return null;
    final elapsedMs = _stopwatch.elapsedMilliseconds - firstTapMs;
    return elapsedMs / 1000 / (_tapsThisSitting - 1);
  }

  Future<void> _startSession() async {
    try {
      final session = await SadhanaService.instance.startSession(mantraId: widget.mantra?.id);
      if (mounted) setState(() => _sessionId = session.id);
    } catch (_) {
      // Chanting does not wait on the network. A tap before the session
      // exists still counts locally, and the next sync retries the start.
    }
  }

  void _tapBead() {
    HapticFeedback.selectionClick();
    _firstTapMs ??= _stopwatch.elapsedMilliseconds;
    setState(() {
      _beads += 1;
      _tapsThisSitting += 1;
      if (_beads >= _beadsPerRoundInUse) {
        _beads = 0;
        _sessionRounds += 1;
        _totalRounds += 1;
        HapticFeedback.mediumImpact();
      }
    });

    if (!_targetAnnounced && _target > 0 && _totalRounds >= _target) {
      _targetAnnounced = true;
      AppNavigator.instance.showMessage(AppLocalizations.of(context).sadhanaTargetReached);
    }

    _scheduleSync(immediate: _beads == 0);
  }

  void _undoBead() {
    if (_beads == 0) return;
    HapticFeedback.selectionClick();
    setState(() {
      _beads -= 1;
      if (_tapsThisSitting > 0) _tapsThisSitting -= 1;
    });
    _scheduleSync();
  }

  Future<void> _toggleAutoChant(bool enabled) {
    final session = _autoChant;
    if (session == null) return Future.value();
    return enabled ? session.enable() : session.disable();
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
        rounds: _sessionRounds,
        beads: _beads,
        finish: finish,
      );
    } catch (_) {
      // A background sync failing is not something to interrupt chanting
      // for. The next tap schedules another one with the same running totals.
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
    _syncDebounce?.cancel();
    await _sync(finish: true);
    // The day this screen started from is stale the moment a round lands —
    // refreshed here rather than left for the tab's own pull to refresh.
    unawaited(ref.read(sadhanaTodayProvider.notifier).refresh());
    if (mounted) Navigator.of(context).pop();
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
        ),
        body: SafeArea(
          // A scrollable centered column rather than a bare centered one: the
          // mantra text below varies in length, and a long one on a short
          // phone must scroll rather than overflow the screen.
          child: LayoutBuilder(
            builder: (context, constraints) => SingleChildScrollView(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.lg,
                vertical: AppSpacing.xl,
              ),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (widget.mantra != null) ...[
                      Text(
                        widget.mantra!.text,
                        textAlign: TextAlign.center,
                        style: AppTypography.verse(context, size: 24),
                      ),
                      const SizedBox(height: AppSpacing.xl),
                    ],
                    if (_target > 0) ...[
                      Text(
                        text.sadhanaRoundsProgress(_totalRounds, _target),
                        style: context.texts.bodyMedium?.copyWith(
                          color: context.colors.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xl),
                    ],
                    TapScale(
                      onTap: _tapBead,
                      child: MalaRing(
                        beadsInRound: _beads,
                        roundsCompleted: _totalRounds,
                        roundsLabel: text.sadhanaRoundsCaption,
                        beadsPerRound: _beadsPerRoundInUse,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xl),
                    _ChantStats(elapsedSeconds: _elapsedSeconds, paceSeconds: _paceSeconds),
                    const SizedBox(height: AppSpacing.lg),
                    IconButton(
                      onPressed: _beads > 0 ? _undoBead : null,
                      icon: const Icon(Icons.undo_rounded),
                      tooltip: text.sadhanaUndoBead,
                    ),
                    if (_autoChant != null) ...[
                      const SizedBox(height: AppSpacing.lg),
                      AutoChantSwitch(status: _autoChantStatus, onChanged: _toggleAutoChant),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Elapsed time and average pace, read together the way a stopwatch and a lap
/// counter sit side by side — two numbers about the same sitting, not one
/// competing with the ring for attention.
class _ChantStats extends StatelessWidget {
  const _ChantStats({required this.elapsedSeconds, required this.paceSeconds});

  final double elapsedSeconds;

  /// Null until there have been at least two taps to measure an interval
  /// between.
  final double? paceSeconds;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final pace = paceSeconds;

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _ChantStat(
          label: text.sadhanaElapsedEyebrow,
          value: text.sadhanaElapsedSeconds(elapsedSeconds.toStringAsFixed(1)),
        ),
        if (pace != null) ...[
          const SizedBox(width: AppSpacing.xxl),
          _ChantStat(
            label: text.sadhanaPaceEyebrow,
            value: text.sadhanaPacePerMantra(pace.toStringAsFixed(1)),
          ),
        ],
      ],
    );
  }
}

class _ChantStat extends StatelessWidget {
  const _ChantStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Eyebrow(label),
        const SizedBox(height: AppSpacing.xs),
        Text(value, style: AppTypography.numeral(context, size: 22)),
      ],
    );
  }
}
