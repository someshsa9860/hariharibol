import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/app_spacing.dart';
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
  });

  final String imageUrl;
  final String imageKey;
  final Listenable counts;
  final int Function() rounds;
  final int Function() beads;
  final int beadsPerRound;
  final VoidCallback onTap;

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
              fit: BoxFit.cover,
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
