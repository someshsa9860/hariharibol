import 'dart:async';

import 'package:audio_service/audio_service.dart';

/// Something the lock screen and the notification can control: reading aloud,
/// or a chant recording. One source has the controls at a time — the one that
/// was handed them last (see [MediaSessionHandler.attach]).
abstract interface class MediaSource {
  /// Fires whenever what the controls show may have changed.
  Stream<void> get changes;

  /// Loaded, with something to play or resume.
  bool get isActive;

  bool get isPlaying;

  /// Loading the next thing to play; the controls show it as busy.
  bool get isLoading;

  /// Whether the controls can skip to the previous and next item.
  bool get canSkip;

  /// The title the lock screen shows, when there is one.
  MediaItem? get item;

  Future<void> play();

  Future<void> pause();

  Future<void> stop();

  Future<void> next();

  Future<void> previous();
}

/// The one system media session, shared by everything that plays audio in the
/// app. The system holds one, so the handler passes the controls to whichever
/// source is playing; the lock screen, the notification and the headset buttons
/// all talk to it.
class MediaSessionHandler extends BaseAudioHandler {
  MediaSource? _source;
  StreamSubscription<void>? _sub;

  /// Gives the controls to [source], letting go of whatever had them before.
  void attach(MediaSource source) {
    if (identical(source, _source)) return;
    _sub?.cancel();
    _source = source;
    _sub = source.changes.listen((_) => _publish());
    _publish();
  }

  /// Takes the controls back from [source], if it has them.
  void release(MediaSource source) {
    if (!identical(source, _source)) return;
    _sub?.cancel();
    _sub = null;
    _source = null;
    _publish();
  }

  void _publish() {
    final source = _source;
    final active = source != null && source.isActive;
    final skip = active && source.canSkip;
    final playing = active && (source.isPlaying || source.isLoading);

    final controls = [
      if (skip) MediaControl.skipToPrevious,
      if (active && source.isPlaying) MediaControl.pause else MediaControl.play,
      MediaControl.stop,
      if (skip) MediaControl.skipToNext,
    ];
    playbackState.add(PlaybackState(
      controls: controls,
      // Everything but stop sits in the compact notification.
      androidCompactActionIndices: [
        for (var i = 0; i < controls.length; i++)
          if (controls[i] != MediaControl.stop) i,
      ],
      processingState: !active
          ? AudioProcessingState.idle
          : source.isLoading
              ? AudioProcessingState.loading
              : AudioProcessingState.ready,
      playing: playing,
    ));

    if (active && source.item != null) {
      mediaItem.add(source.item);
    } else if (!active) {
      mediaItem.add(null);
    }
  }

  @override
  Future<void> play() async => _source?.play();

  @override
  Future<void> pause() async => _source?.pause();

  @override
  Future<void> stop() async {
    await _source?.stop();
    await super.stop();
  }

  @override
  Future<void> skipToNext() async => _source?.next();

  @override
  Future<void> skipToPrevious() async => _source?.previous();
}

/// Starts the system media service the first time something plays. Idempotent;
/// a phone where it cannot start still plays — only the lock-screen controls
/// are missing.
class MediaSessionService {
  MediaSessionService._();

  /// The channel the first caller names is the one the notification uses.
  /// Reading aloud and the chant recording share the same service.
  static const String androidChannelId = 'com.sss.ramkrishnahari.reading';

  static Future<MediaSessionHandler?>? _starting;
  static MediaSessionHandler? _handler;

  static Future<MediaSessionHandler?> ensureStarted({required String channelName}) {
    return _starting ??= () async {
      try {
        final handler = await AudioService.init(
          builder: () => _handler = MediaSessionHandler(),
          config: AudioServiceConfig(
            androidNotificationChannelId: androidChannelId,
            androidNotificationChannelName: channelName,
            androidStopForegroundOnPause: true,
          ),
        );
        return handler;
      } catch (_) {
        return null;
      }
    }();
  }

  /// Gives the controls to [source], starting the service if it is not running.
  static Future<void> attach(MediaSource source, {required String channelName}) async {
    final handler = await ensureStarted(channelName: channelName);
    handler?.attach(source);
  }

  /// Takes the controls back from [source] when it has finished with them.
  static void release(MediaSource source) => _handler?.release(source);
}
