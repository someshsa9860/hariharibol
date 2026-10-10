/// Tuning for spoken meaning and purport. Nothing here is user-facing.
abstract final class TtsConfig {
  /// A manifest of downloadable voices, fetched at run time so voices can be
  /// added or corrected without an app release. Set at build time:
  /// `--dart-define=TTS_MODELS_MANIFEST_URL=https://…/tts_models.json`.
  /// Empty means only the bundled manifest (`assets/tts/tts_models.json`).
  static const String manifestUrl = String.fromEnvironment('TTS_MODELS_MANIFEST_URL');

  static const String bundledManifestAsset = 'assets/tts/tts_models.json';

  /// Folder inside the app-support directory that holds voices and their
  /// half-finished downloads. Not the cache directory: the OS may empty that.
  static const String modelsDir = 'tts_models';
  static const String downloadsDir = 'downloads';
  static const String manifestCacheFile = 'manifest.json';
  static const String installedMarker = 'installed.json';

  // ── Text → chunks ─────────────────────────────────────────────────────
  /// A chunk is a sentence or two. Short enough that the first words are heard
  /// quickly and the next chunk is ready while this one plays; long enough that
  /// the voice keeps its intonation.
  static const int maxChunkChars = 220;

  /// A sentence shorter than this is joined to its neighbour instead of being
  /// synthesised on its own.
  static const int minChunkChars = 40;

  /// Chunks synthesised ahead of the one playing.
  static const int lookahead = 1;

  // ── Voices ────────────────────────────────────────────────────────────
  static const Duration connectTimeout = Duration(seconds: 20);
  static const Duration receiveTimeout = Duration(seconds: 45);
  static const int downloadAttempts = 4;
  static const Duration backoffBase = Duration(seconds: 2);

  /// Progress is reported at most this often, so a 60 MB download does not
  /// rebuild the settings screen thousands of times.
  static const Duration progressInterval = Duration(milliseconds: 250);

  static const int numThreads = 2;
  static const double defaultRate = 1.0;

  // ── Verse audio cache ─────────────────────────────────────────────────
  static const String verseAudioDir = 'verse_audio';
  static const int verseAudioMaxBytes = 200 * 1024 * 1024;
  static const Duration audioLinkTtl = Duration(minutes: 50);
  static const int audioLinkBatch = 6;
}
