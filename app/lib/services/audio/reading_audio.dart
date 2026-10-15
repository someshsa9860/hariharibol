import '../../models/verse.dart';
import 'interruption_policy.dart';
import 'reading_audio_handler.dart';
import 'reading_item.dart';
import 'reading_playback_controller.dart';

/// What the screens use to play a chapter's recitation: it loads the verses,
/// makes sure the system audio session and the lock-screen service are running,
/// and then drives the controller.
class ReadingAudio {
  ReadingAudio({
    required this.controller,
    required this.session,
  });

  final ReadingPlaybackController controller;
  final ReadingAudioSession session;

  /// Loads [verses] as the chapter [context].
  void prepare(List<Verse> verses, {required String context}) {
    controller.load(ReadingItems.build(verses), context: context);
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
