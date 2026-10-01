import 'package:flutter/widgets.dart';
import 'package:just_audio/just_audio.dart';

/// The track playing under a video or a slideshow — a verse's recitation, or
/// background music. Draws nothing.
///
/// The same lifecycle rules as the other players, for the same reasons: one
/// decoder per page, opened with the widget and disposed with it, and
/// [isActive] decides whether it plays — going inactive pauses **and rewinds**,
/// so returning to a reel starts the recitation from its first word. It loops,
/// because a track that ends while the picture is still up reads as broken.
///
/// A dead link is not worth a message: the reel simply plays without it.
class ReelSoundtrack extends StatefulWidget {
  const ReelSoundtrack({
    super.key,
    required this.url,
    required this.isActive,
    required this.isMuted,
  });

  final String url;

  /// Whether this is the reel on screen. Only one page is ever active.
  final bool isActive;
  final bool isMuted;

  @override
  State<ReelSoundtrack> createState() => ReelSoundtrackState();
}

class ReelSoundtrackState extends State<ReelSoundtrack> {
  final AudioPlayer _player = AudioPlayer();
  bool _ready = false;

  /// The reader tapped the picture to pause it. The track follows, and stays
  /// paused until they tap again or the reel leaves the screen.
  bool _heldByReader = false;

  @override
  void initState() {
    super.initState();
    _open();
  }

  Future<void> _open() async {
    try {
      await _player.setUrl(widget.url);
      await _player.setLoopMode(LoopMode.one);
      await _player.setVolume(widget.isMuted ? 0 : 1);
      if (!mounted) return;
      _ready = true;
      if (widget.isActive && !_heldByReader) await _player.play();
    } catch (_) {
      // Expired link, unreachable host, unsupported file: the reel plays
      // without its track.
    }
  }

  @override
  void didUpdateWidget(covariant ReelSoundtrack oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_ready) return;

    if (widget.isMuted != oldWidget.isMuted) {
      _player.setVolume(widget.isMuted ? 0 : 1);
    }

    if (widget.isActive != oldWidget.isActive) {
      if (widget.isActive) {
        if (!_heldByReader) _player.play();
      } else {
        _heldByReader = false;
        _player.pause();
        _player.seek(Duration.zero);
      }
    }
  }

  /// Called by the page when the reader taps the video to pause or resume it,
  /// so the recitation does not carry on over a frozen picture.
  void setHeld(bool held) {
    _heldByReader = held;
    if (!_ready || !widget.isActive) return;
    if (held) {
      _player.pause();
    } else {
      _player.play();
    }
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
