import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../core/constants/chant_audio_config.dart';
import 'chant_mala_timing.dart';

enum ChantMalaPhase { loading, ready, failed }

/// What the player card draws.
@immutable
class ChantMalaPlayerState {
  const ChantMalaPlayerState({
    this.phase = ChantMalaPhase.loading,
    this.playing = false,
    this.position = Duration.zero,
    this.duration = Duration.zero,
  });

  final ChantMalaPhase phase;
  final bool playing;
  final Duration position;
  final Duration duration;

  ChantMalaPlayerState copyWith({
    ChantMalaPhase? phase,
    bool? playing,
    Duration? position,
    Duration? duration,
  }) => ChantMalaPlayerState(
    phase: phase ?? this.phase,
    playing: playing ?? this.playing,
    position: position ?? this.position,
    duration: duration ?? this.duration,
  );
}

/// Plays a mantra's mala recording and reports each chant as it finishes, so
/// the counter counts along with the voice.
///
/// The timing is a [ChantMalaTiming] and the counting a [ChantMalaFollower];
/// this class is only the player around them. [chantsCompleted] emits how many
/// chants just finished — one at a time while playing normally.
class ChantMalaPlayer {
  ChantMalaPlayer({required this._url, required this.timing, this.refreshUrl, AudioPlayer? player})
    : _player = player ?? AudioPlayer(),
      _follower = ChantMalaFollower(timing, continuousStep: ChantAudioConfig.continuousStep);

  final ChantMalaTiming timing;

  /// Asks for the recording's link again. The one the mantra arrived with is
  /// signed for an hour, and the mantra may have been fetched before that, so a
  /// recording that will not load is asked for once more under a fresh link.
  final Future<String?> Function()? refreshUrl;

  String _url;

  final AudioPlayer _player;
  final ChantMalaFollower _follower;

  final ValueNotifier<ChantMalaPlayerState> state = ValueNotifier(const ChantMalaPlayerState());
  final StreamController<int> _chants = StreamController<int>.broadcast();

  final List<StreamSubscription<Object?>> _subscriptions = [];

  /// True while a seek is in flight — a reading taken then is from before it.
  bool _seeking = false;
  bool _disposed = false;

  Stream<int> get chantsCompleted => _chants.stream;

  bool get isPlaying => state.value.playing;

  Future<void> load() async {
    _emit(phase: ChantMalaPhase.loading);
    try {
      final duration = await _open();
      if (_disposed) return;
      _listen();
      _emit(phase: ChantMalaPhase.ready, duration: duration ?? Duration.zero);
    } catch (_) {
      // A dead link is a normal thing — no connection, a file still being
      // processed. The card says so and offers another try.
      if (!_disposed) _emit(phase: ChantMalaPhase.failed);
    }
  }

  Future<Duration?> _open() async {
    try {
      return await _player.setUrl(_url);
    } catch (_) {
      final fresh = await refreshUrl?.call();
      if (fresh == null || fresh.isEmpty || fresh == _url) rethrow;
      _url = fresh;
      return _player.setUrl(_url);
    }
  }

  void _listen() {
    if (_subscriptions.isNotEmpty) return;
    _subscriptions
      ..add(
        _player
            .createPositionStream(
              minPeriod: ChantAudioConfig.positionTick,
              maxPeriod: ChantAudioConfig.positionTick,
            )
            .listen(_onPosition),
      )
      ..add(_player.playerStateStream.listen(_onPlayerState))
      ..add(
        _player.durationStream.listen((duration) {
          if (duration != null) _emit(duration: duration);
        }),
      );
  }

  void _onPosition(Duration position) {
    // A reading taken while a seek is in flight is from before it: it neither
    // counts nor drags the bar back to where it was.
    if (_seeking) return;
    _count(position);
    _emit(position: position);
  }

  void _onPlayerState(PlayerState playerState) {
    final finished = playerState.processingState == ProcessingState.completed;
    if (finished) {
      // The last chant ends at or near the very end of the recording, which a
      // reading every tenth of a second can step over.
      final end = _player.duration ?? state.value.duration;
      if (!_seeking) _count(end);
      unawaited(_player.pause());
    }
    _setPlaying(playerState.playing && !finished);
  }

  void _count(Duration position) {
    final fresh = _follower.advance(position);
    if (fresh > 0 && !_chants.isClosed) _chants.add(fresh);
  }

  void _setPlaying(bool playing) {
    if (state.value.playing == playing) return;
    _emit(playing: playing);
    // Nothing is tapped while a recording counts, so nothing else would keep
    // the screen on — and a locked screen stops the app, the audio and the count.
    unawaited(_keepScreenOn(playing));
  }

  /// A screen that cannot be held awake is no reason to stop the recording.
  Future<void> _keepScreenOn(bool on) async {
    try {
      await WakelockPlus.toggle(enable: on);
    } catch (_) {}
  }

  Future<void> play() async {
    if (state.value.phase != ChantMalaPhase.ready) return;
    // From the end, play means from the top: another time through.
    if (_player.processingState == ProcessingState.completed) await seek(Duration.zero);
    // `play` completes when playback stops, so it is not awaited.
    unawaited(_player.play());
  }

  Future<void> pause() => _player.pause();

  Future<void> toggle() => isPlaying ? pause() : play();

  /// Moves playback without counting what is skipped over or heard again.
  Future<void> seek(Duration position) async {
    _seeking = true;
    _follower.relocate(position);
    _emit(position: position);
    try {
      await _player.seek(position);
    } finally {
      _seeking = false;
    }
  }

  void _emit({ChantMalaPhase? phase, bool? playing, Duration? position, Duration? duration}) {
    if (_disposed) return;
    state.value = state.value.copyWith(
      phase: phase,
      playing: playing,
      position: position,
      duration: duration,
    );
  }

  Future<void> dispose() async {
    if (_disposed) return;
    _disposed = true;
    // The screen is let go first: it is the one thing here that keeps costing
    // the person after they have left, were anything below to fail. Cancelling
    // stops events at once; there is nothing to wait for.
    unawaited(_keepScreenOn(false));
    for (final subscription in _subscriptions) {
      unawaited(subscription.cancel());
    }
    unawaited(_chants.close());
    await _player.dispose();
    state.dispose();
  }
}
