import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/reel.dart';
import 'reel_action_rail.dart';
import 'reel_audio_player.dart';
import 'reel_caption.dart';
import 'reel_overlays.dart';
import 'reel_slideshow.dart';
import 'reel_soundtrack.dart';
import 'reel_video_player.dart';

/// One reel, filling the screen.
///
/// Four layers, in this order: the media, a scrim, the text an admin laid over
/// it, then the controls. The scrim is what makes white text readable over
/// footage nobody has seen — it is a gradient rather than a flat wash so the
/// middle of the frame, which is usually the subject, stays untouched.
class ReelPage extends StatefulWidget {
  const ReelPage({
    super.key,
    required this.reel,
    required this.isActive,
    required this.isMuted,
    required this.onLike,
    required this.onComment,
    required this.onShare,
    required this.onSave,
    required this.onMore,
    required this.onFollow,
    required this.onCreatorTap,
    required this.onToggleMute,
    this.onSubjectTap,
    this.onSimilarTap,
    this.onProgress,
    this.playerKey,
    this.bottomInset = 0,
  });

  final Reel reel;
  final bool isActive;
  final bool isMuted;

  final VoidCallback onLike;
  final VoidCallback onComment;
  final VoidCallback onShare;
  final VoidCallback onSave;
  final VoidCallback onMore;
  final VoidCallback onFollow;
  final VoidCallback onCreatorTap;
  final VoidCallback onToggleMute;
  final void Function(Reel reel)? onSubjectTap;

  /// Opens reels like this one. Pass it only when there are some to offer.
  final VoidCallback? onSimilarTap;
  final void Function(int watchedMs, int durationMs)? onProgress;

  /// Lets the feed reach this page's player to report a watch when the whole
  /// screen closes, not only when the reel is swiped past.
  final GlobalKey<ReelVideoPlayerState>? playerKey;

  /// How much of the bottom is covered by something else — the nav bar, when
  /// the feed is shown inside the shell rather than over it.
  final double bottomInset;

  @override
  State<ReelPage> createState() => _ReelPageState();
}

class _ReelPageState extends State<ReelPage> {
  /// The track under a video or slideshow, so a tap that pauses the picture can
  /// pause it too.
  final GlobalKey<ReelSoundtrackState> _soundtrack = GlobalKey<ReelSoundtrackState>();

  Reel get reel => widget.reel;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return ColoredBox(
      color: AppColors.reelGround,
      child: Stack(
        fit: StackFit.expand,
        children: [
          _media(context),
          // Silent itself; only here to play the track.
          if (reel.hasSoundtrack)
            ReelSoundtrack(
              key: _soundtrack,
              url: reel.audioUrl!,
              isActive: widget.isActive,
              isMuted: widget.isMuted,
            ),
          const _Scrim(),
          ReelOverlays(overlays: reel.overlays),
          Positioned(
            left: AppSpacing.lg,
            right: 0,
            bottom: widget.bottomInset + AppSpacing.lg,
            child: SafeArea(
              top: false,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: ReelCaption(
                      reel: reel,
                      onCreatorTap: widget.onCreatorTap,
                      onFollowTap: widget.onFollow,
                      onSubjectTap: widget.onSubjectTap,
                      onSimilarTap: widget.onSimilarTap,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  ReelActionRail(
                    reel: reel,
                    onLike: widget.onLike,
                    onComment: widget.onComment,
                    onShare: widget.onShare,
                    onSave: widget.onSave,
                    onMore: widget.onMore,
                  ),
                ],
              ),
            ),
          ),
          // Only offered where there is sound to turn off. A mute button on a
          // silent slideshow is a control that does nothing.
          if (reel.hasPlayableVideo || (reel.audioUrl ?? '').isNotEmpty)
            Positioned(
              top: AppSpacing.lg,
              right: AppSpacing.lg,
              child: SafeArea(
                child: _MuteButton(
                  isMuted: widget.isMuted,
                  label: widget.isMuted ? text.reelMuted : text.reelUnmuted,
                  onTap: widget.onToggleMute,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _media(BuildContext context) {
    if (reel.isVideo) {
      if (!reel.hasPlayableVideo) {
        // Falls through to the slideshow widget, which shows the thumbnail
        // when there are no image rows — the right fallback for a video whose
        // file is not there yet.
        return ReelSlideshow(reel: reel, isActive: widget.isActive);
      }
      return ReelVideoPlayer(
        key: widget.playerKey,
        url: reel.videoUrl!,
        isActive: widget.isActive,
        // A track under the video replaces the video's own sound, as it does in
        // the editor's preview; the mute button then governs the track.
        isMuted: widget.isMuted || reel.hasSoundtrack,
        thumbnailUrl: reel.thumbnailUrl,
        cacheKey: reel.id,
        onProgress: widget.onProgress,
        onTap: _toggleVideo,
      );
    }

    if (reel.isAudio) {
      if (!reel.hasPlayableAudio) {
        return ReelSlideshow(reel: reel, isActive: widget.isActive);
      }
      return ReelAudioPlayer(
        url: reel.audioUrl!,
        isActive: widget.isActive,
        isMuted: widget.isMuted,
        thumbnailUrl: reel.thumbnailUrl,
        cacheKey: reel.id,
        onProgress: widget.onProgress,
      );
    }

    return ReelSlideshow(reel: reel, isActive: widget.isActive);
  }

  /// Tap to pause or resume the picture, and the track with it.
  Future<void> _toggleVideo() async {
    final player = widget.playerKey?.currentState;
    await player?.togglePlayback();
    _soundtrack.currentState?.setHeld(!(player?.isPlaying ?? true));
  }
}

/// The readability gradient. Two stops at each end and nothing in the middle,
/// so the subject of the frame is not dimmed to make room for chrome that is
/// not there.
class _Scrim extends StatelessWidget {
  const _Scrim();

  @override
  Widget build(BuildContext context) {
    return const IgnorePointer(
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              AppColors.reelScrimSoft,
              Color(0x00000000),
              Color(0x00000000),
              AppColors.reelScrimStrong,
            ],
            stops: [0, 0.22, 0.55, 1],
          ),
        ),
      ),
    );
  }
}

class _MuteButton extends StatelessWidget {
  const _MuteButton({required this.isMuted, required this.label, required this.onTap});

  final bool isMuted;
  final String label;
  final VoidCallback onTap;

  static const double _size = 36;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: ExcludeSemantics(
        child: GestureDetector(
          onTap: onTap,
          child: Container(
            width: _size,
            height: _size,
            decoration: const BoxDecoration(
              color: AppColors.reelControl,
              shape: BoxShape.circle,
            ),
            child: Icon(
              isMuted ? Icons.volume_off_rounded : Icons.volume_up_rounded,
              size: AppSizes.iconSm,
              color: AppColors.reelInk,
            ),
          ),
        ),
      ),
    );
  }
}
