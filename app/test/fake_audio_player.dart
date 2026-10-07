// A stand-in for just_audio's AudioPlayer that plays nothing and does as it is
// told: the test decides which links open, where the recording is, and when it
// ends. Only what ChantMalaPlayer calls is implemented — anything else throws,
// so a new call in the player shows up here as a failing test rather than a
// silent no-op.

import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:just_audio/just_audio.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import 'package:wakelock_plus_platform_interface/wakelock_plus_platform_interface.dart';

class FakeAudioPlayer extends Fake implements AudioPlayer {
  FakeAudioPlayer({this.length = const Duration(minutes: 8)});

  /// How long the recording is, as the player reports it once opened.
  final Duration length;

  /// Links that will not open, as a signed link that has expired does not.
  final Set<String> brokenUrls = {};

  /// Every link it was asked to open, in order.
  final List<String> opened = [];

  /// Every place it was asked to seek to, in order.
  final List<Duration> seeks = [];

  int plays = 0;
  int pauses = 0;
  bool disposed = false;

  /// While set, a seek does not finish: the window in which a position reading
  /// is still from before it.
  Completer<void>? seekGate;

  /// How often the real position stream reports while playing.
  static const Duration tick = Duration(milliseconds: 100);

  Duration _position = Duration.zero;
  Duration? _duration;
  bool _playing = false;
  ProcessingState _processing = ProcessingState.idle;

  // The position stream does not replay, while the state and duration streams
  // hand a new listener their latest value — as just_audio's do. Positions are
  // delivered at once, so a test need not pump between two ticks.
  final StreamController<Duration> _positions = StreamController<Duration>.broadcast(sync: true);
  final StreamController<PlayerState> _states = StreamController<PlayerState>.broadcast();
  final StreamController<Duration?> _durations = StreamController<Duration?>.broadcast();

  @override
  Duration get position => _position;

  @override
  Duration? get duration => _duration;

  @override
  ProcessingState get processingState => _processing;

  @override
  bool get playing => _playing;

  @override
  Stream<PlayerState> get playerStateStream =>
      _replaying(() => PlayerState(_playing, _processing), _states.stream);

  @override
  Stream<Duration?> get durationStream => _replaying(() => _duration, _durations.stream);

  @override
  Stream<Duration> createPositionStream({
    int steps = 800,
    Duration minPeriod = const Duration(milliseconds: 200),
    Duration maxPeriod = const Duration(milliseconds: 200),
  }) => _positions.stream;

  @override
  Future<Duration?> setUrl(
    String url, {
    Map<String, String>? headers,
    Duration? initialPosition,
    bool preload = true,
    dynamic tag,
  }) async {
    opened.add(url);
    if (brokenUrls.contains(url)) throw PlayerException(403, 'The link has expired.', null);
    _duration = length;
    _processing = ProcessingState.ready;
    _durations.add(length);
    _states.add(PlayerState(_playing, _processing));
    return length;
  }

  // The real `play` finishes when playback stops; nothing waits on it, so this
  // one finishes at once. Like the real one it does nothing while playing.
  @override
  Future<void> play() async {
    if (_playing) return;
    plays += 1;
    _playing = true;
    _states.add(PlayerState(_playing, _processing));
  }

  @override
  Future<void> pause() async {
    if (!_playing) return;
    pauses += 1;
    _playing = false;
    _states.add(PlayerState(_playing, _processing));
  }

  @override
  Future<void> seek(Duration? position, {int? index}) async {
    seeks.add(position!);
    _position = position;
    if (_processing == ProcessingState.completed) {
      _processing = ProcessingState.ready;
      _states.add(PlayerState(_playing, _processing));
    }
    // The real player moves its position at once, before the platform has
    // finished the seek, and reports it.
    _positions.add(position);
    await seekGate?.future;
  }

  @override
  Future<void> dispose() async {
    disposed = true;
  }

  /// Plays on to [to] a tenth of a second at a time, as the real stream would.
  void playTo(Duration to) {
    while (_position < to) {
      final next = _position + tick;
      _position = next < to ? next : to;
      _positions.add(_position);
    }
  }

  /// A reading of [at] that is not where playback is — one taken before a seek
  /// finished.
  void reportStale(Duration at) => _positions.add(at);

  /// The recording plays out: the position is the end and the player completes.
  /// Like the real one it stays "playing" until it is paused. [reportEnd] false
  /// is a stream that never reported the very end — which a reading every tenth
  /// of a second can step over.
  void finish({bool reportEnd = true}) {
    _position = length;
    if (reportEnd) _positions.add(_position);
    _processing = ProcessingState.completed;
    _states.add(PlayerState(_playing, _processing));
  }

  static Stream<T> _replaying<T>(T Function() latest, Stream<T> updates) {
    return Stream<T>.multi((listener) {
      listener.add(latest());
      final subscription = updates.listen(listener.add);
      listener.onCancel = subscription.cancel;
    });
  }
}

/// Records the screen being held awake or let go, so a test can see it without
/// a platform behind it.
class FakeWakelock extends WakelockPlusPlatformInterface {
  /// Every value the screen was told to be held on or off with.
  final List<bool> toggles = [];

  /// A device that will not hold the screen awake.
  bool failing = false;

  bool get held => toggles.isNotEmpty && toggles.last;

  @override
  Future<void> toggle({required bool enable}) {
    if (failing) throw StateError('The wakelock is not available.');
    toggles.add(enable);
    return Future<void>.value();
  }

  @override
  Future<bool> get enabled async => held;
}

/// Puts a [FakeWakelock] in place of the plugin for one test.
FakeWakelock installFakeWakelock() {
  final original = wakelockPlusPlatformInstance;
  final fake = FakeWakelock();
  wakelockPlusPlatformInstance = fake;
  addTearDown(() => wakelockPlusPlatformInstance = original);
  return fake;
}
