import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../common/app_image.dart';

/// The narration on an AUDIO reel — a recitation with a still cover rather
/// than a picture that moves.
///
/// Mirrors [ReelVideoPlayer]'s lifecycle rules for the same reason: one
/// decoder per page, opened when the widget is and disposed with it, and
/// [isActive] deciding whether it plays — going inactive pauses **and rewinds
/// to the start**, so a reel swiped away from and returned to starts the
/// recitation over rather than resuming mid-verse. It loops for the same
/// reason a video does: a recitation that goes silent while still on screen
/// reads as broken, not finished.
///
/// The cover alone does not say a reel is playing — nothing on it moves — so
/// unlike the video player this one also draws its own progress, the one
/// piece of state a still image cannot carry any other way.
class ReelAudioPlayer extends StatefulWidget {
  const ReelAudioPlayer({
    super.key,
    required this.url,
    required this.isActive,
    required this.isMuted,
    this.thumbnailUrl,
    this.cacheKey,
    this.onProgress,
  });

  final String url;

  /// Whether this is the reel on screen. Only one page is ever active.
  final bool isActive;
  final bool isMuted;

  final String? thumbnailUrl;
  final String? cacheKey;

  /// Furthest point reached, in milliseconds, and the track's own length.
  final void Function(int watchedMs, int durationMs)? onProgress;

  @override
  State<ReelAudioPlayer> createState() => ReelAudioPlayerState();
}

class ReelAudioPlayerState extends State<ReelAudioPlayer> {
  final AudioPlayer _player = AudioPlayer();
  bool _ready = false;
  bool _failed = false;
  bool _playing = false;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;

  /// The furthest point reached, not the current position — see
  /// [ReelVideoPlayerState] for why a looping track must track this
  /// separately from where playback happens to be.
  int _furthestMs = 0;

  @override
  void initState() {
    super.initState();
    _player.positionStream.listen(_onPosition);
    _player.playerStateStream.listen(_onState);
    _open();
  }

  Future<void> _open() async {
    try {
      final duration = await _player.setUrl(widget.url);
      await _player.setLoopMode(LoopMode.one);
      await _player.setVolume(widget.isMuted ? 0 : 1);
      if (!mounted) return;
      setState(() {
        _ready = true;
        _duration = duration ?? Duration.zero;
      });
      if (widget.isActive) await _player.play();
    } catch (_) {
      // A dead media URL is a normal thing on a feed — a signed link that
      // expired, a track still being processed. The cover stands in.
      if (mounted) setState(() => _failed = true);
    }
  }

  void _onPosition(Duration position) {
    if (position.inMilliseconds > _furthestMs) _furthestMs = position.inMilliseconds;
    if (mounted) setState(() => _position = position);
  }

  void _onState(PlayerState state) {
    if (mounted) setState(() => _playing = state.playing);
  }

  @override
  void didUpdateWidget(covariant ReelAudioPlayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_ready) return;

    if (widget.isMuted != oldWidget.isMuted) {
      _player.setVolume(widget.isMuted ? 0 : 1);
    }

    if (widget.isActive != oldWidget.isActive) {
      if (widget.isActive) {
        _player.play();
      } else {
        _report();
        _player.pause();
        _player.seek(Duration.zero);
        _furthestMs = 0;
      }
    }
  }

  void _report() {
    if (_duration == Duration.zero) return;
    widget.onProgress?.call(_furthestMs, _duration.inMilliseconds);
  }

  /// Lets the page report a watch when the whole feed is closed, not only
  /// when one reel is swiped past.
  void reportProgress() => _report();

  Future<void> togglePlayback() async {
    if (!_ready) return;
    if (_player.playing) {
      await _player.pause();
    } else {
      await _player.play();
    }
  }

  @override
  void dispose() {
    _report();
    _player.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    if (_failed) {
      return _Unavailable(thumbnailUrl: widget.thumbnailUrl, cacheKey: widget.cacheKey);
    }

    final total = _duration.inMilliseconds;
    final progress = total > 0 ? (_position.inMilliseconds / total).clamp(0.0, 1.0) : 0.0;

    return Semantics(
      button: true,
      label: _playing ? text.reelPause : text.reelPlay,
      child: GestureDetector(
        onTap: togglePlayback,
        behavior: HitTestBehavior.opaque,
        child: Stack(
          fit: StackFit.expand,
          children: [
            AppImage(
              url: widget.thumbnailUrl,
              cacheKey: widget.cacheKey,
              borderRadius: BorderRadius.zero,
              fit: BoxFit.cover,
              width: double.infinity,
              height: double.infinity,
            ),
            if (_ready) ...[
              if (!_playing) const _PausedBadge(),
              Positioned(
                top: AppSpacing.lg,
                left: AppSpacing.lg,
                right: AppSpacing.lg,
                child: SafeArea(
                  bottom: false,
                  child: ClipRRect(
                    borderRadius: AppRadius.smAll,
                    child: LinearProgressIndicator(
                      value: progress,
                      minHeight: AppSpacing.xs,
                      backgroundColor: AppColors.reelControl,
                      color: AppColors.reelInk,
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// A reel whose narration will not play. Shows the cover and says so, rather
/// than a spinner that never resolves — see the "no control that does
/// nothing" rule.
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
        AppImage(
          url: thumbnailUrl,
          cacheKey: cacheKey,
          borderRadius: BorderRadius.zero,
          fit: BoxFit.cover,
          width: double.infinity,
          height: double.infinity,
        ),
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
                  text.reelAudioUnavailable,
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
