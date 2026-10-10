import 'dart:typed_data';

enum TtsPhase { started, chunkStarted, completed, paused, resumed, stopped, failed }

/// What an engine reports while it speaks, so a screen can show where it is.
class TtsProgress {
  const TtsProgress(this.phase, {this.chunkIndex = 0, this.chunkCount = 0, this.error});

  final TtsPhase phase;
  final int chunkIndex;
  final int chunkCount;
  final Object? error;

  @override
  String toString() => 'TtsProgress($phase, ${chunkIndex + 1}/$chunkCount${error == null ? '' : ', $error'})';
}

/// A failure to speak. [spoken] is how many chunks were fully spoken before it,
/// so another engine can carry on from there instead of starting over.
class TtsException implements Exception {
  const TtsException(this.message, {this.spoken = 0, this.cause});

  final String message;
  final int spoken;
  final Object? cause;

  @override
  String toString() => 'TtsException: $message${cause == null ? '' : ' ($cause)'}';
}

/// One way of turning text into speech. The reading player talks to this and
/// nothing else, so an engine can be replaced — a different neural runtime, a
/// cloud voice — without touching it.
abstract class TtsEngine {
  String get id;

  /// Whether this engine can speak [language] right now.
  Future<bool> canSpeak(String language);

  /// What the engine is doing; broadcast.
  Stream<TtsProgress> get progress;

  /// Speaks [text] and completes when it has been spoken, or was [stop]ped.
  /// Throws [TtsException] if it cannot.
  Future<void> speak(String text, {required String language, double rate = 1.0});

  Future<void> pause();
  Future<void> resume();
  Future<void> stop();
  Future<void> dispose();
}

/// Speech ready to play.
class TtsAudio {
  const TtsAudio(this.pcm, this.sampleRate);

  final Int16List pcm;
  final int sampleRate;

  Duration get duration => Duration(microseconds: (pcm.length * 1000000 / sampleRate).round());
}
