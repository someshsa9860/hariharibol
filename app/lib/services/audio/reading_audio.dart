import '../../models/verse.dart';
import 'interruption_policy.dart';
import 'reading_audio_handler.dart';
import 'reading_item.dart';
import 'reading_playback_controller.dart';

/// What the screens use to read a chapter aloud: it prepares the verses (spoken
/// text in the speaking language), makes sure the system audio session and the
/// lock-screen service are running, and then drives the controller.
class ReadingAudio {
  ReadingAudio({
    required this.controller,
    required this.session,
    required this.renderings,
  });

  final ReadingPlaybackController controller;
  final ReadingAudioSession session;

  /// Stored renderings by verse id — `BookRepository.spokenRenderings`.
  final Future<Map<String, List<SpokenRendering>>> Function(Iterable<String> verseIds) renderings;

  /// Loads [verses] as the chapter [context]. Cheap to call again when the
  /// speaking language changes: playback keeps its place.
  Future<void> prepare(
    List<Verse> verses, {
    required String context,
    required List<String> speakingChain,
    bool wordMeanings = false,
  }) async {
    final stored = await renderings(verses.map((v) => v.id));
    controller.load(
      ReadingItems.build(verses, speakingChain: speakingChain, renderings: stored, wordMeanings: wordMeanings),
      context: context,
    );
  }

  Future<void> _ready(String channelName) async {
    await session.start();
    await ReadingAudioService.ensureStarted(controller, channelName: channelName);
  }

  Future<void> playVerse(int index, {required String channelName}) async {
    await _ready(channelName);
    await controller.playVerse(index);
  }

  Future<void> playAll({int from = 0, required String channelName}) async {
    await _ready(channelName);
    await controller.playAll(from: from);
  }

  Future<void> stop() async {
    session.policy.onUserAction();
    await controller.stop();
  }

  Future<void> togglePause() async {
    session.policy.onUserAction();
    await controller.togglePause();
  }
}
