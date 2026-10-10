import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/tts_model.dart';
import '../repositories/book_repository.dart';
import '../services/audio/audio_link_resolver.dart';
import '../services/audio/file_player.dart';
import '../services/audio/interruption_policy.dart';
import '../services/audio/reading_audio.dart';
import '../services/audio/reading_memory.dart';
import '../services/audio/reading_playback_controller.dart';
import '../services/audio/verse_audio_cache.dart';
import '../services/tts/adaptive_tts_engine.dart';
import '../services/tts/platform_tts_engine.dart';
import '../services/tts/sherpa_tts_engine.dart';
import '../services/tts/tts_model_manager.dart';

final ttsModelManagerProvider = Provider<TtsModelManager>((ref) => TtsModelManager.instance);

/// Starts a voice download for [language] if there is one to get and the phone is
/// on Wi-Fi. A voice is tens of megabytes: on mobile data it waits for the
/// person to ask for it in settings. Never throws and never blocks speech.
class VoiceRequests {
  VoiceRequests(this._manager, {Connectivity? connectivity}) : _connectivity = connectivity ?? Connectivity();

  final TtsModelManager _manager;
  final Connectivity _connectivity;

  Future<void> onSpeakingLanguage(String language) async {
    try {
      await _manager.init();
      final spec = _manager.specFor(language);
      if (spec == null || !spec.installable) return;
      final networks = await _connectivity.checkConnectivity();
      final unmetered = networks.contains(ConnectivityResult.wifi) || networks.contains(ConnectivityResult.ethernet);
      if (unmetered) unawaited(_manager.ensure(language));
    } catch (_) {}
  }
}

final voiceRequestsProvider = Provider<VoiceRequests>((ref) => VoiceRequests(ref.watch(ttsModelManagerProvider)));

/// One reading player for the app. Built on first use; tears the audio down with
/// the container.
final readingAudioProvider = Provider<ReadingAudio>((ref) {
  final manager = ref.watch(ttsModelManagerProvider);
  final requests = ref.watch(voiceRequestsProvider);

  final engine = AdaptiveTtsEngine(
    neural: SherpaTtsEngine(manager: manager),
    platform: PlatformTtsEngine(),
    onNeuralMissing: (language) => unawaited(requests.onSpeakingLanguage(language)),
  );
  final controller = ReadingPlaybackController(
    player: JustAudioFilePlayer(),
    tts: engine,
    audio: VerseAudioCache(resolver: AudioLinkResolver()),
    memory: LocalStoreReadingMemory(),
  );
  final session = ReadingAudioSession(InterruptionPolicy(controller));

  ref.onDispose(() {
    unawaited(session.stop());
    unawaited(controller.dispose());
  });

  return ReadingAudio(
    controller: controller,
    session: session,
    renderings: BookRepository.instance.spokenRenderings,
  );
});

/// What the reading player is doing, for highlights and the player bar.
final readingStateProvider = StreamProvider<ReadingState>((ref) async* {
  final controller = ref.watch(readingAudioProvider).controller;
  yield controller.state;
  yield* controller.states;
});

/// Every voice's status for the settings screen. Loads the manifest first.
final ttsVoiceStatusesProvider = StreamProvider<Map<String, TtsModelStatus>>((ref) async* {
  final manager = ref.watch(ttsModelManagerProvider);
  await manager.init();
  yield manager.currentStatuses;
  yield* manager.statuses;
});

/// The voices the manifest lists, once it has loaded.
final ttsVoicesProvider = FutureProvider<List<TtsModelSpec>>((ref) async {
  final manager = ref.watch(ttsModelManagerProvider);
  await manager.init();
  return manager.manifest.models;
});
