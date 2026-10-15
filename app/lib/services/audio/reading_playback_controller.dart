import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../models/verse.dart';
import 'file_player.dart';
import 'reading_item.dart';
import 'reading_memory.dart';
import 'verse_audio_cache.dart';

enum ReadingStatus { idle, loading, playing, paused }

@immutable
class ReadingState {
  const ReadingState({
    this.status = ReadingStatus.idle,
    this.index,
    this.verseId,
    this.autoplay = false,
    this.error,
  });

  final ReadingStatus status;

  /// Position in the loaded verses.
  final int? index;
  final String? verseId;

  /// Carrying on to the next verse when this one ends.
  final bool autoplay;

  /// Something that could not be played and was skipped; for the developer.
  final Object? error;

  bool get isActive => status != ReadingStatus.idle;
  bool get isPlaying => status == ReadingStatus.playing || status == ReadingStatus.loading;

  @override
  bool operator ==(Object other) =>
      other is ReadingState &&
      other.status == status &&
      other.index == index &&
      other.verseId == verseId &&
      other.autoplay == autoplay;

  @override
  int get hashCode => Object.hash(status, index, verseId, autoplay);

  @override
  String toString() => 'ReadingState($status, #$index, autoplay: $autoplay)';
}

/// Plays a chapter's recitation: for each verse the Sanskrit recording from the
/// server, and nothing else — no spoken meaning or purport, whatever language
/// the reader has. One verse, or on through the chapter ("auto-play").
///
/// Every `await` on the way is checked against a run number: starting something
/// else (next verse, a different verse, stop) bumps it, so the loop that was
/// running notices and ends without touching the new one.
class ReadingPlaybackController {
  ReadingPlaybackController({
    required this.player,
    required this.audio,
    required this.memory,
  });

  final FilePlayer player;
  final VerseAudioCache audio;
  final ReadingMemory memory;

  final StreamController<ReadingState> _states = StreamController<ReadingState>.broadcast();
  ReadingState _state = const ReadingState();

  List<ReadingItem> _items = const [];
  String? _context;
  int _run = 0;
  bool _autoplay = false;
  bool _paused = false;
  Completer<void>? _gate;
  bool _playerBusy = false;

  Stream<ReadingState> get states => _states.stream;
  ReadingState get state => _state;
  List<ReadingItem> get items => _items;
  String? get context => _context;

  /// Hands the player the verses of the chapter on screen. Anything playing from
  /// a different chapter is stopped.
  void load(List<ReadingItem> items, {required String context}) {
    if (_context != context && _state.isActive) unawaited(stop());
    _items = items;
    _context = context;
  }

  /// The index to carry on from, if the reader played part of this chapter.
  int? resumeIndex() {
    final context = _context;
    if (context == null) return null;
    final id = memory.lastVerseId(context);
    if (id == null) return null;
    final index = _items.indexWhere((i) => i.verse.id == id);
    return index < 0 ? null : index;
  }

  // ── Starting ──────────────────────────────────────────────────────────

  /// One verse's recitation — then it stops.
  Future<void> playVerse(int index) => _start(index, autoplay: false);

  /// From [from] through to the end of the chapter.
  Future<void> playAll({int from = 0}) => _start(from, autoplay: true);

  Future<void> next() async {
    final index = _state.index;
    if (index == null || index + 1 >= _items.length) {
      await stop();
      return;
    }
    await _start(index + 1, autoplay: _autoplay);
  }

  Future<void> previous() async {
    final index = _state.index;
    if (index == null) return;
    await _start(index > 0 ? index - 1 : 0, autoplay: _autoplay);
  }

  Future<void> _start(int index, {required bool autoplay}) async {
    if (index < 0 || index >= _items.length) return;
    final run = ++_run;
    await _halt();
    if (run != _run) return;

    _autoplay = autoplay;
    _paused = false;
    _gate = null;

    var i = index;
    while (run == _run && i < _items.length) {
      await _playItem(i, run);
      if (run != _run) return;
      if (!_autoplay) break;
      i++;
    }
    if (run == _run) {
      _playerBusy = false;
      _emit(const ReadingState());
    }
  }

  Future<void> _playItem(int i, int run) async {
    final item = _items[i];
    _emit(ReadingState(
      status: ReadingStatus.loading,
      index: i,
      verseId: item.verse.id,
      autoplay: _autoplay,
    ));
    final context = _context;
    if (context != null) unawaited(memory.remember(context, item.verse.id));

    // Have the next verse's recitation ready before this one ends.
    if (i + 1 < _items.length) {
      audio.prefetch(_items[i + 1].verse, following: [for (final n in _items.skip(i + 2).take(4)) n.verse]);
    }

    // A verse with no recording, or one that will not load, is skipped.
    if (!item.verse.hasAudio) return;
    final file = await audio.fileFor(item.verse, following: [for (final n in _items.skip(i + 1).take(4)) n.verse]);
    if (run != _run || file == null) return;

    await _waitIfPaused(run);
    if (run != _run) return;
    _emit(_playing(i, item));
    _playerBusy = true;
    try {
      await player.playFile(file);
    } catch (error) {
      _noteError(error, item);
    } finally {
      if (run == _run) _playerBusy = false;
    }
  }

  ReadingState _playing(int i, ReadingItem item) => ReadingState(
        status: _paused ? ReadingStatus.paused : ReadingStatus.playing,
        index: i,
        verseId: item.verse.id,
        autoplay: _autoplay,
      );

  void _noteError(Object error, ReadingItem item) {
    if (kDebugMode) debugPrint('[Reading] ${item.verse.verseId} skipped: $error');
  }

  // ── Pausing ───────────────────────────────────────────────────────────

  Future<void> _waitIfPaused(int run) async {
    final gate = _gate;
    if (_paused && gate != null) await gate.future;
  }

  Future<void> pause() async {
    if (_paused || !_state.isActive) return;
    _paused = true;
    _gate = Completer<void>();
    if (_playerBusy) await player.pause();
    _emit(ReadingState(
      status: ReadingStatus.paused,
      index: _state.index,
      verseId: _state.verseId,
      autoplay: _autoplay,
    ));
  }

  Future<void> resume() async {
    if (!_paused) return;
    _paused = false;
    final gate = _gate;
    _gate = null;
    if (_playerBusy) await player.resume();
    if (gate != null && !gate.isCompleted) gate.complete();
    _emit(ReadingState(
      status: ReadingStatus.playing,
      index: _state.index,
      verseId: _state.verseId,
      autoplay: _autoplay,
    ));
  }

  Future<void> togglePause() => _paused ? resume() : pause();

  // ── Stopping ──────────────────────────────────────────────────────────

  Future<void> stop() async {
    _run++;
    await _halt();
    _paused = false;
    _autoplay = false;
    _emit(const ReadingState());
  }

  Future<void> _halt() async {
    final gate = _gate;
    _gate = null;
    _paused = false;
    if (gate != null && !gate.isCompleted) gate.complete();
    _playerBusy = false;
    await player.stop();
  }

  void _emit(ReadingState next) {
    if (next == _state) return;
    _state = next;
    if (!_states.isClosed) _states.add(next);
  }

  Future<void> dispose() async {
    _run++;
    await _halt();
    await _states.close();
    await player.dispose();
  }

  /// For the lock screen.
  Verse? get currentVerse => _state.index == null ? null : _items[_state.index!].verse;
}
