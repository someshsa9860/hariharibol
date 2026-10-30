import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/app_spacing.dart';
import '../../services/chant_mala_player.dart';
import '../../widgets/common/app_image.dart';

/// The deity's picture across the whole screen (9:16), with the counter still
/// working: a tap anywhere is a bead, exactly as on the ring.
///
/// It owns no count. [counts] says when the counter changed (a tap here, or
/// auto-count hearing a chant behind it) and [rounds] / [beads] read it, so the
/// screen underneath stays the one source of truth.
class ChantFullscreenView extends StatefulWidget {
  const ChantFullscreenView({
    super.key,
    required this.imageUrl,
    required this.imageKey,
    required this.counts,
    required this.rounds,
    required this.beads,
    required this.beadsPerRound,
    required this.onTap,
    this.mala,
    this.fit = BoxFit.cover,
  });

  final String imageUrl;
  final String imageKey;

  /// `cover` for the 9:16 art; `contain` for a picture of another shape, so
  /// none of the deity is cropped off.
  final BoxFit fit;
  final Listenable counts;
  final int Function() rounds;
  final int Function() beads;
  final int beadsPerRound;
  final VoidCallback onTap;

  /// The mantra's chant-along recording, when it has one. Once a round ends it
  /// is back at the start and stopped, so a play button here starts the next.
  final ChantMalaPlayer? mala;

  @override
  State<ChantFullscreenView> createState() => _ChantFullscreenViewState();
}

class _ChantFullscreenViewState extends State<ChantFullscreenView> {
  @override
  void initState() {
    super.initState();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  }

  @override
  void dispose() {
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: widget.onTap,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // 9:16 art fills a phone; on a squarer screen it is cropped, not stretched.
            AppImage(
              url: widget.imageUrl,
              cacheKey: widget.imageKey,
              borderRadius: BorderRadius.zero,
              fit: widget.fit,
            ),
            SafeArea(
              child: Align(
                alignment: Alignment.topCenter,
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Row(
                    children: [
                      IconButton.filledTonal(
                        icon: const Icon(Icons.close_rounded),
                        tooltip: MaterialLocalizations.of(context).closeButtonTooltip,
                        onPressed: () => Navigator.of(context).pop(),
                      ),
                      if (widget.mala != null)
                        ValueListenableBuilder<ChantMalaPlayerState>(
                          valueListenable: widget.mala!.state,
                          builder: (context, state, _) {
                            if (state.playing || state.phase != ChantMalaPhase.ready) {
                              return const SizedBox.shrink();
                            }
                            return Padding(
                              padding: const EdgeInsets.only(left: AppSpacing.sm),
                              child: IconButton.filledTonal(
                                icon: const Icon(Icons.play_arrow_rounded),
                                tooltip: MaterialLocalizations.of(context).resumeButtonLabel,
                                onPressed: () => widget.mala!.play(),
                              ),
                            );
                          },
                        ),
                      const Spacer(),
                      ListenableBuilder(
                        listenable: widget.counts,
                        builder: (context, _) => DecoratedBox(
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.45),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                            child: Text(
                              '${widget.rounds()} · ${widget.beads()} / ${widget.beadsPerRound}',
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
