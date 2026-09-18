import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../common/app_image.dart';

/// The video on one reel.
///
/// The whole job of this widget is **not leaking decoders.** A phone has a
/// handful of hardware video decoders; a feed that initialises a controller
/// per page and never disposes one runs out within a screen or two and then
/// silently shows black frames. So:
///
///   - the controller is created when the widget is, and disposed in
///     `dispose()` — no controller outlives its page;
///   - [isActive] decides whether it plays, and going inactive pauses **and
///     seeks back to zero**, so a reel swiped away from and returned to starts
///     again rather than resuming mid-sentence;
///   - it loops, because a reel that stops on its last frame reads as broken.
///
/// Progress is reported through [onProgress] rather than polled by the parent,
/// so the view can send a watch event without holding a controller reference.
class ReelVideoPlayer extends StatefulWidget {
  const ReelVideoPlayer({
    super.key,
    required this.url,
    required this.isActive,
    required this.isMuted,
    this.thumbnailUrl,
    this.cacheKey,
    this.onProgress,
    this.onTap,
  });

  final String url;

  /// Whether this is the reel on screen. Only one page is ever active.
  final bool isActive;
  final bool isMuted;

  final String? thumbnailUrl;
  final String? cacheKey;

  /// Furthest point reached, in milliseconds, and the clip's own length.
  final void Function(int watchedMs, int durationMs)? onProgress;

  final VoidCallback? onTap;

  @override
  State<ReelVideoPlayer> createState() => ReelVideoPlayerState();
}

class ReelVideoPlayerState extends State<ReelVideoPlayer> {
  VideoPlayerController? _controller;
  bool _ready = false;
  bool _failed = false;

  /// The furthest point reached, not the current position — a reel watched to
  /// the end and left looping must not report two seconds because that is
  /// where the loop happened to be when it was swiped away.
  int _furthestMs = 0;

  @override
  void initState() {
    super.initState();
    _open();
  }

  Future<void> _open() async {
    final controller = VideoPlayerController.networkUrl(Uri.parse(widget.url));
    _controller = controller;
    controller.addListener(_onTick);

    try {
      await controller.initialize();
      await controller.setLooping(true);
      await controller.setVolume(widget.isMuted ? 0 : 1);
      if (!mounted) return;
      setState(() => _ready = true);
      if (widget.isActive) await controller.play();
    } catch (_) {
      // A dead media URL is a normal thing on a feed — a signed link that
      // expired, a file still being processed. The poster frame stands in.
      if (mounted) setState(() => _failed = true);
    }
  }

  void _onTick() {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    final position = controller.value.position.inMilliseconds;
    if (position > _furthestMs) _furthestMs = position;
  }

  @override
  void didUpdateWidget(covariant ReelVideoPlayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    final controller = _controller;
    if (controller == null || !_ready) return;

    if (widget.isMuted != oldWidget.isMuted) {
      controller.setVolume(widget.isMuted ? 0 : 1);
    }

    if (widget.isActive != oldWidget.isActive) {
      if (widget.isActive) {
        controller.play();
      } else {
        _report();
        controller.pause();
        controller.seekTo(Duration.zero);
        _furthestMs = 0;
      }
    }
  }

  void _report() {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    widget.onProgress?.call(_furthestMs, controller.value.duration.inMilliseconds);
  }

  /// Lets the page report a watch when the whole feed is closed, not only when
  /// one reel is swiped past.
  void reportProgress() => _report();

  bool get isPlaying => _controller?.value.isPlaying ?? false;

  Future<void> togglePlayback() async {
    final controller = _controller;
    if (controller == null || !_ready) return;
    if (controller.value.isPlaying) {
      await controller.pause();
    } else {
      await controller.play();
    }
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _report();
    _controller?.removeListener(_onTick);
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;

    if (_failed) return _Unavailable(thumbnailUrl: widget.thumbnailUrl, cacheKey: widget.cacheKey);

    // The poster frame holds the space until the first video frame decodes, so
    // the feed never shows a black rectangle between pages.
    if (!_ready || controller == null) {
      return _Poster(url: widget.thumbnailUrl, cacheKey: widget.cacheKey);
    }

    return GestureDetector(
      onTap: widget.onTap,
      behavior: HitTestBehavior.opaque,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Cover the screen: a 9:16 clip fills it exactly, anything else is
          // cropped rather than letterboxed, which is what a reel should do.
          FittedBox(
            fit: BoxFit.cover,
            clipBehavior: Clip.hardEdge,
            child: SizedBox(
              width: controller.value.size.width,
              height: controller.value.size.height,
              child: VideoPlayer(controller),
            ),
          ),
          if (!controller.value.isPlaying) const _PausedBadge(),
        ],
      ),
    );
  }
}

class _Poster extends StatelessWidget {
  const _Poster({this.url, this.cacheKey});

  final String? url;
  final String? cacheKey;

  @override
  Widget build(BuildContext context) {
    return AppImage(
      url: url,
      cacheKey: cacheKey,
      borderRadius: BorderRadius.zero,
      fit: BoxFit.cover,
      width: double.infinity,
      height: double.infinity,
    );
  }
}

/// A reel whose video will not play. Shows the poster and says so, rather than
/// a spinner that never resolves — see the "no control that does nothing" rule.
class _Unavailable extends StatelessWidget {
  const _Unavailable({this.thumbnailUrl, this.cacheKey});

  final String? thumbnailUrl;
  final String? cacheKey;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Stack(
      fit: StackFit.expand,
      children: [
        _Poster(url: thumbnailUrl, cacheKey: cacheKey),
        Container(color: AppColors.reelScrimSoft),
        Center(
          child: Padding(
            padding: AppSpacing.page,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.hourglass_empty_rounded,
                  color: AppColors.reelInk,
                  size: AppSizes.iconLg,
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  text.reelVideoUnavailable,
                  textAlign: TextAlign.center,
                  style: Theme.of(context)
                      .textTheme
                      .bodyMedium
                      ?.copyWith(color: AppColors.reelInk),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// The play glyph shown while a reel is paused by a tap. Deliberately large
/// and semi-transparent — it is a state indicator, not a button, because the
/// whole surface is the button.
class _PausedBadge extends StatelessWidget {
  const _PausedBadge();

  /// Larger than any icon in AppSizes on purpose: this is a state indicator
  /// read at a glance from arm's length, not a control in a row of controls.
  static const double _glyph = 72;

  @override
  Widget build(BuildContext context) {
    return const IgnorePointer(
      child: Center(
        child: Icon(
          Icons.play_arrow_rounded,
          size: _glyph,
          color: AppColors.reelInk,
          shadows: [Shadow(color: AppColors.reelScrimStrong, blurRadius: 16)],
        ),
      ),
    );
  }
}
