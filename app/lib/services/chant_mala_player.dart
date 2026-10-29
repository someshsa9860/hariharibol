import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../core/constants/chant_audio_config.dart';
import 'chant_mala_timing.dart';
import 'connection_status.dart';
import 'mala_audio_cache.dart';

/// [unavailable] is a recording that is not on the phone with no connection to
/// fetch it over: nothing to try, so the card is left off the screen until a
/// connection returns (unlike [failed], which is a try that did not work and
/// offers another).
enum ChantMalaPhase { loading, ready, failed, unavailable }

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
  ChantMalaPlayer({
    required this._url,
    required this.timing,
    this.refreshUrl,
    this.restAt,
    this.cache,
    this.connection,
    AudioPlayer? player,
  })
    : _player = player ?? AudioPlayer(),
      _follower = ChantMalaFollower(timing, continuousStep: ChantAudioConfig.continuousStep);

  final ChantMalaTiming timing;

  /// Asks for the recording's link again. The one the mantra arrived with is
  /// signed for an hour, and the mantra may have been fetched before that, so a
  /// recording that will not load is asked for once more under a fresh link.
  final Future<String?> Function()? refreshUrl;

  /// Where play begins when the recording is at rest — at its top, or played to
  /// its end — rather than paused part-way. The screen knows what has been
  /// counted by hand, so the voice takes up from there and not from the top. Null
  /// always begins at the top.
  final Duration Function()? restAt;

  /// Where the recording is kept to play with no connection: a kept file is
  /// opened instead of the link, and one played from the link is saved. Null
  /// keeps nothing.
  final MalaAudioCache? cache;

  /// Whether there is a connection, and when that changes. A recording that is
  /// not kept is [ChantMalaPhase.unavailable] while there is none, and is loaded
  /// by itself when one returns. Null takes the phone to be online always.
  final ConnectionStatus? connection;

  String _url;

  final AudioPlayer _player;
  final ChantMalaFollower _follower;

  final ValueNotifier<ChantMalaPlayerState> state = ValueNotifier(const ChantMalaPlayerState());
  final StreamController<int> _chants = StreamController<int>.broadcast();

  final List<StreamSubscription<Object?>> _subscriptions = [];
  StreamSubscription<bool>? _connectionSub;

  /// Bumped by every [load]: a load that finds it has moved on was replaced
  /// (the connection went and came back) and says nothing.
  int _loadId = 0;

  /// True while a seek is in flight — a reading taken then is from before it.
  bool _seeking = false;
  bool _disposed = false;

  Stream<int> get chantsCompleted => _chants.stream;

  bool get isPlaying => state.value.playing;

  Future<void> load() async {
    final id = ++_loadId;
    _watchConnection();
    if (!await _canOpen()) {
      if (id == _loadId) _emit(phase: ChantMalaPhase.unavailable);
      return;
    }
    _emit(phase: ChantMalaPhase.loading);
    try {
      final duration = await _open();
      if (_disposed || id != _loadId) return;
      _listen();
      _emit(phase: ChantMalaPhase.ready, duration: duration ?? Duration.zero);
    } catch (_) {
      if (_disposed || id != _loadId) return;
      // A dead link is a normal thing — a file still being processed, a signal
      // that went. The card says so and offers another try; with no connection
      // at all there is nothing to offer, and it steps aside.
      final phase = await _canOpen() ? ChantMalaPhase.failed : ChantMalaPhase.unavailable;
      if (id == _loadId) _emit(phase: phase);
    }
  }

  /// Whether the recording can be opened at all: there is a connection, or it
  /// is kept on the phone.
  Future<bool> _canOpen() async {
    final connection = this.connection;
    if (connection == null || await connection.online()) return true;
    return await cache?.file(_url) != null;
  }

  void _watchConnection() {
    final connection = this.connection;
    if (connection == null || _connectionSub != null) return;
    _connectionSub = connection.changes.listen(_onConnection, onError: (Object _) {});
  }

  void _onConnection(bool online) {
    if (_disposed) return;
    final phase = state.value.phase;
    if (online) {
      // Hidden for want of a connection, or a try that did not work: the
      // connection is back, so try again without being asked.
      if (phase == ChantMalaPhase.unavailable || phase == ChantMalaPhase.failed) unawaited(load());
    } else if (phase == ChantMalaPhase.loading || phase == ChantMalaPhase.failed) {
      unawaited(_stepAsideIfNotKept());
    }
  }

  /// A try over a connection that has gone is dropped, and the card with it —
  /// unless the recording is on the phone, which needs no connection.
  Future<void> _stepAsideIfNotKept() async {
    if (await cache?.file(_url) != null || _disposed) return;
    final phase = state.value.phase;
    if (phase != ChantMalaPhase.loading && phase != ChantMalaPhase.failed) return;
    _loadId++;
    _emit(phase: ChantMalaPhase.unavailable);
  }

  Future<Duration?> _open() async {
    final kept = await cache?.file(_url);
    if (kept != null) {
      try {
        return await _player.setFilePath(kept.path);
      } catch (_) {
        // A file that will not play is dropped, and the link tried instead.
        await cache?.forget(_url);
      }
    }

    final duration = await _openLink();
    unawaited(cache?.save(_url));
    return duration;
  }

  Future<Duration?> _openLink() async {
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
    // From rest, play begins where the count stands: the top for a count of
    // nothing, further in for chants made by hand. A recording paused part-way is
    // left where the listener put it.
    final atRest =
        _player.processingState == ProcessingState.completed ||
        state.value.position == Duration.zero;
    if (atRest) await seek(restAt?.call() ?? Duration.zero);
    // `play` completes when playback stops, so it is not awaited.
    unawaited(_player.play());
  }

  Future<void> pause() => _player.pause();

  Future<void> toggle() => isPlaying ? pause() : play();

  /// Stops and goes back to the start, so the next press of play is the next time
  /// through and not a wait for the silence after the last chant to run out.
  Future<void> rewind() async {
    await pause();
    if (state.value.phase == ChantMalaPhase.ready) await seek(Duration.zero);
  }

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
    unawaited(_connectionSub?.cancel());
    unawaited(_chants.close());
    await _player.dispose();
    state.dispose();
  }
}
