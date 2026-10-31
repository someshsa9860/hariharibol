import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/book_reel.dart';
import '../../providers/chant_sync_provider.dart';
import '../../providers/home_provider.dart';
import '../../providers/mantra_provider.dart';
import '../../providers/reel_provider.dart';
import '../../providers/sadhana_provider.dart';
import '../../services/chant_recorder.dart';
import '../../services/chant_session_sync.dart';

/// Chants a round has in the reels feed: one mala.
const int chantReelBeads = 108;

/// A chanting reel in the feed, for the mantra the reader chants most.
///
/// Every tap counts one chant, 1 to 108; the 108th completes a round, which is
/// saved exactly as the Jap counter saves one (a sitting with its round), and
/// the feed moves on by itself ([onEnded]). Swiping on instead skips the rest —
/// and whatever was already counted is saved as it stands, so a tap is never
/// lost to a swipe.
class ChantReelPage extends ConsumerStatefulWidget {
  const ChantReelPage({
    super.key,
    required this.slug,
    required this.isActive,
    this.onEnded,
    this.beadsPerRound = chantReelBeads,
  });

  final String slug;
  final bool isActive;
  final VoidCallback? onEnded;
  final int beadsPerRound;

  @override
  ConsumerState<ChantReelPage> createState() => _ChantReelPageState();
}

class _ChantReelPageState extends ConsumerState<ChantReelPage> with SingleTickerProviderStateMixin {
  late ChantRecorder _recorder = ChantRecorder(beadsPerRound: widget.beadsPerRound);
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 260));

  String? _mantraId;
  bool _done = false;

  /// This visit's sitting, written to the phone's record at every chant and sent
  /// in a batch by the app-wide syncer. Made at the first chant, so a reel passed
  /// without a tap leaves nothing behind, and again for each visit (a new sitting,
  /// a new id).
  ChantSessionSync? _session;

  int get _count => _recorder.completedMalas > 0 ? widget.beadsPerRound : _recorder.beadsInMala;

  @override
  void didUpdateWidget(covariant ChantReelPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Swiped away: save what was counted and start afresh for the next time it comes round.
    if (oldWidget.isActive && !widget.isActive) _leave();
  }

  @override
  void dispose() {
    _leave();
    _pulse.dispose();
    super.dispose();
  }

  void _leave() {
    // A finished round was ended when its 108th chant was counted.
    final session = _session;
    if (session != null && _recorder.tapCount > 0 && !_done) {
      // After this frame: writing to the phone's record changes a provider, which
      // is not allowed while the tree is being built or torn down.
      scheduleMicrotask(() => unawaited(session.send(finish: true)));
    }
    _recorder = ChantRecorder(beadsPerRound: widget.beadsPerRound);
    _session = null;
    _done = false;
  }

  void _tap() {
    if (!widget.isActive || _done) return;
    HapticFeedback.selectionClick();
    _recorder.tap();
    _pulse.forward(from: 0);

    final session = _session ??= ChantSessionSync(
      recorder: _recorder,
      mantraId: _mantraId,
      syncer: ref.read(chantSyncerProvider),
    );

    if (_recorder.completedMalas >= 1) {
      HapticFeedback.mediumImpact();
      setState(() => _done = true);
      // Read now: the page may be gone by the time the send is over.
      final today = ref.read(sadhanaTodayProvider.notifier);
      final home = ref.read(homeFeedProvider.notifier);
      unawaited(_finishRound(session, today, home));
      // A beat to show the round is complete, then on.
      Future<void>.delayed(const Duration(milliseconds: 1100), () {
        if (mounted && widget.isActive) widget.onEnded?.call();
      });
    } else {
      session.schedule();
      setState(() {});
    }
  }

  /// Ends the sitting and sends it, then lets the Jap tab's day and Home catch up
  /// with the server. A failure is not worth interrupting a reel for: the round
  /// is on the phone and goes up with the next batch.
  Future<void> _finishRound(
    ChantSessionSync session,
    SadhanaTodayNotifier today,
    HomeFeedNotifier home,
  ) async {
    try {
      await session.send(finish: true);
      await today.refresh();
      await home.refresh();
    } catch (_) {
      // Nothing to show; the screens already count the round from the phone.
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final style = ref.watch(bookReelStyleProvider).maybeWhen(data: (value) => value, orElse: () => BookReelStyle.fallback);
    final mantra = ref.watch(mantraDetailProvider(widget.slug)).value;
    _mantraId = mantra?.id;
    final progress = _count / widget.beadsPerRound;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: _tap,
      child: Stack(
        fit: StackFit.expand,
        children: [
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [style.colorTop, style.colorBottom],
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl, vertical: AppSpacing.xl),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (mantra != null) ...[
                    Text(
                      mantra.name,
                      textAlign: TextAlign.center,
                      style: AppTypography.eyebrow(context, color: style.accentColor),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Text(
                      mantra.text,
                      textAlign: TextAlign.center,
                      style: AppTypography.verse(context, size: 24).copyWith(color: style.sanskritColor, fontWeight: FontWeight.w600),
                    ),
                    if ((mantra.transliteration ?? '').isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        mantra.transliteration!,
                        textAlign: TextAlign.center,
                        style: AppTypography.transliteration(context).copyWith(color: style.transliterationColor),
                      ),
                    ],
                  ],
                  const SizedBox(height: AppSpacing.xxl),
                  ScaleTransition(
                    scale: Tween<double>(begin: 1, end: 1.06).animate(CurvedAnimation(parent: _pulse, curve: Curves.easeOut)),
                    child: SizedBox(
                      width: 168,
                      height: 168,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          SizedBox.expand(
                            child: TweenAnimationBuilder<double>(
                              tween: Tween(begin: 0, end: progress),
                              duration: const Duration(milliseconds: 180),
                              builder: (context, value, _) => CircularProgressIndicator(
                                value: value,
                                strokeWidth: 6,
                                backgroundColor: style.accentColor.withValues(alpha: 0.25),
                                valueColor: AlwaysStoppedAnimation(style.accentColor),
                              ),
                            ),
                          ),
                          Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                _done ? '${widget.beadsPerRound}' : '$_count',
                                style: AppTypography.numeral(context, size: 54).copyWith(color: style.meaningColor),
                              ),
                              Text(
                                text.reelChantCount(_count, widget.beadsPerRound),
                                style: AppTypography.numeral(context, size: 13).copyWith(color: style.meaningColor.withValues(alpha: 0.7)),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 250),
                    child: Text(
                      _done ? text.reelChantDone : text.reelChantTapHint,
                      key: ValueKey(_done),
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(color: style.accentColor, fontWeight: FontWeight.w700),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    text.reelChantSkipHint,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: style.meaningColor.withValues(alpha: 0.6)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
