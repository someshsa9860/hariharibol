import 'dart:async';

import 'package:flutter/foundation.dart';

import '../tts/tts_engine.dart';
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
    this.section,
    this.autoplay = false,
    this.error,
  });

  final ReadingStatus status;

  /// Position in the loaded verses.
  final int? index;
  final String? verseId;

  /// Which part is being heard: the recitation, the meaning or the purport.
  final ReadingSection? section;

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
      other.section == section &&
      other.autoplay == autoplay;

  @override
  int get hashCode => Object.hash(status, index, verseId, section, autoplay);

  @override
  String toString() => 'ReadingState($status, #$index, $section, autoplay: $autoplay)';
}

/// Reads a chapter aloud: for each verse its recitation (if it has one), then
/// the meaning, then the purport — the last two spoken in the speaking language
/// by [tts]. One verse, or on through the chapter ("auto-play").
///
/// Every `await` on the way is checked against a run number: starting something
/// else (next verse, a different verse, stop) bumps it, so the loop that was
/// running notices and ends without touching the new one.
class ReadingPlaybackController {
  ReadingPlaybackController({
    required this.player,
    required this.tts,
    required this.audio,
    required this.memory,
    this.rate = 1.0,
  });

  final FilePlayer player;
  final TtsEngine tts;
  final VerseAudioCache audio;
  final ReadingMemory memory;
  final double rate;

  final StreamController<ReadingState> _states = StreamController<ReadingState>.broadcast();
  ReadingState _state = const ReadingState();

  List<ReadingItem> _items = const [];
  String? _context;
  int _run = 0;
  bool _autoplay = false;
  bool _paused = false;
  Completer<void>? _gate;
  _Active _active = _Active.none;

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

  /// One verse: recitation, meaning, purport — then it stops.
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
      _active = _Active.none;
      _emit(const ReadingState());
    }
  }

  Future<void> _playItem(int i, int run) async {
    final item = _items[i];
    _emit(ReadingState(
      status: ReadingStatus.loading,
      index: i,
      verseId: item.verse.id,
      section: ReadingSection.verse,
      autoplay: _autoplay,
    ));
    final context = _context;
    if (context != null) unawaited(memory.remember(context, item.verse.id));

    // Have the next verse's recitation ready before this one ends.
    if (i + 1 < _items.length) {
      audio.prefetch(_items[i + 1].verse, following: [for (final n in _items.skip(i + 2).take(4)) n.verse]);
    }

    // 1. The recitation. A verse with none, or one that will not load, is skipped.
    if (item.verse.hasAudio) {
      final file = await audio.fileFor(item.verse, following: [for (final n in _items.skip(i + 1).take(4)) n.verse]);
      if (run != _run) return;
      if (file != null) {
        await _waitIfPaused(run);
        if (run != _run) return;
        _emit(_playing(i, item, ReadingSection.verse));
        _active = _Active.player;
        try {
          await player.playFile(file);
        } catch (error) {
          _noteError(error, i, item, ReadingSection.verse);
        }
        if (run != _run) return;
      }
    }

    // 2. The meaning, 3. the purport — in the speaking language.
    await _speak(item, i, run, ReadingSection.meaning, item.meaning);
    if (run != _run) return;
    await _speak(item, i, run, ReadingSection.purport, item.purport);
  }

  Future<void> _speak(ReadingItem item, int i, int run, ReadingSection section, List<SpokenText> candidates) async {
    SpokenText? chosen;
    for (final candidate in candidates) {
      if (candidate.text.isEmpty) continue;
      if (await tts.canSpeak(candidate.language)) {
        chosen = candidate;
        break;
      }
    }
    if (run != _run) return;
    if (chosen == null) return; // nothing to say in a language we can voice

    await _waitIfPaused(run);
    if (run != _run) return;
    _emit(_playing(i, item, section));
    _active = _Active.tts;
    try {
      await tts.speak(chosen.text, language: chosen.language, rate: rate);
    } catch (error) {
      _noteError(error, i, item, section);
    }
  }

  ReadingState _playing(int i, ReadingItem item, ReadingSection section) => ReadingState(
        status: _paused ? ReadingStatus.paused : ReadingStatus.playing,
        index: i,
        verseId: item.verse.id,
        section: section,
        autoplay: _autoplay,
      );

  void _noteError(Object error, int i, ReadingItem item, ReadingSection section) {
    if (kDebugMode) debugPrint('[Reading] ${item.verse.verseId} $section skipped: $error');
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
    switch (_active) {
      case _Active.player:
        await player.pause();
      case _Active.tts:
        await tts.pause();
      case _Active.none:
        break;
    }
    _emit(ReadingState(
      status: ReadingStatus.paused,
      index: _state.index,
      verseId: _state.verseId,
      section: _state.section,
      autoplay: _autoplay,
    ));
  }

  Future<void> resume() async {
    if (!_paused) return;
    _paused = false;
    final gate = _gate;
    _gate = null;
    switch (_active) {
      case _Active.player:
        await player.resume();
      case _Active.tts:
        await tts.resume();
      case _Active.none:
        break;
    }
    if (gate != null && !gate.isCompleted) gate.complete();
    _emit(ReadingState(
      status: ReadingStatus.playing,
      index: _state.index,
      verseId: _state.verseId,
      section: _state.section,
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
    _active = _Active.none;
    await Future.wait([player.stop(), tts.stop()]);
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
    await tts.dispose();
  }

  /// For the lock screen.
  Verse? get currentVerse => _state.index == null ? null : _items[_state.index!].verse;
}

enum _Active { none, player, tts }
