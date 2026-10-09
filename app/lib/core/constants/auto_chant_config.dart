import 'package:flutter/foundation.dart' show kReleaseMode;

/// Tuning and asset locations for auto-count: listen to the mic, transcribe it
/// on the phone, match the transcript to the open mantra's phrases, count each
/// completed repetition — no cloud speech-to-text, no network.
///
/// See `assets/models/auto_chant/NOTICE.md` for where the bundled models come
/// from. A mantra's phrases come from the API (`Mantra.chantPhrases`).
abstract final class AutoChantConfig {
  static const int sampleRate = 16000;

  // ── Logging ─────────────────────────────────────────────────────────────
  /// Whether auto-count writes `[AutoChant …]` lines to the console (see
  /// `AutoChantLog`). On in debug and profile builds, off in release; a release
  /// build can turn it on with `--dart-define=AUTO_CHANT_LOG=true`. The lines
  /// carry what was heard, so they are for the developer's console only.
  static const bool logging = bool.fromEnvironment('AUTO_CHANT_LOG', defaultValue: !kReleaseMode);

  /// How often a sitting reports that it is alive: audio received, how loud,
  /// and whether the recogniser is keeping up.
  static const Duration logHeartbeat = Duration(seconds: 5);

  /// A heartbeat whose loudest sample is below this (on the samples' 0–1 scale)
  /// is logged as a silent microphone: a working mic in a quiet room still
  /// reads well above it, a muted or taken-over one reads exactly zero.
  static const double logSilentPeak = 0.001;

  // ── Bundled model assets ──────────────────────────────────────────────
  static const String vadModelAsset = 'assets/models/auto_chant/vad/silero_vad.onnx';
  static const String kwsEncoderAsset = 'assets/models/auto_chant/kws/encoder.onnx';
  static const String kwsDecoderAsset = 'assets/models/auto_chant/kws/decoder.onnx';
  static const String kwsJoinerAsset = 'assets/models/auto_chant/kws/joiner.onnx';
  static const String kwsTokensAsset = 'assets/models/auto_chant/kws/tokens.txt';

  // ── The sharper recogniser (optional download) ─────────────────────────
  /// Meta's Omnilingual ASR 300M CTC (Apache-2.0, int8), a recogniser that writes
  /// Sanskrit and Hindi in Devanagari where the bundled English one guesses at
  /// English words. Too big to bundle, so it is a download the person chooses,
  /// from a folder holding [accurateModelFile] and [accurateTokensFile]. Empty
  /// (the default) means no host is configured and nothing is offered:
  /// `--dart-define=AUTO_CHANT_MODEL_URL=https://…/omnilingual-300m-int8`.
  static const String accurateModelBaseUrl = String.fromEnvironment('AUTO_CHANT_MODEL_URL');
  static const String accurateModelFile = 'model.int8.onnx';
  static const String accurateTokensFile = 'tokens.txt';

  /// What the two files must be, byte for byte, or the download is thrown away.
  static const int accurateModelBytes = 365352120;
  static const int accurateTokensBytes = 86423;
  static const String accurateModelSha256 = 'e7c4e54ee4c4c47829cc6667d5d00ed8ea7bef1dcfeef0fce766f77752a2726c';
  static const String accurateTokensSha256 = 'a7a044c52cb29cbe8b0dc1953e92cefd4ca16b0ed968177b6beab21f9a7d0b31';

  /// Where the files live, under the app's support folder.
  static const String accurateModelFolder = 'auto_chant_omnilingual';

  /// It reads a chant far more truly than the bundled model, so it is held to a
  /// higher bar: at this one no false count appeared in 24 minutes of ordinary
  /// speech, where half (the bundled model's bar) let a Hindi sentence through.
  static const double accurateMatchThreshold = 0.65;

  /// The recogniser is not streaming: a stretch of voice is decoded once it ends,
  /// or once it has run this long, so a chant that never pauses is still counted.
  static const int accurateMaxUtteranceSeconds = 12;
  static const int accurateThreads = 2;

  /// It holds about 1 GB while decoding. A phone with less memory than this is
  /// not offered it, rather than offered a download that ends the app.
  static const int accurateMinRamMegabytes = 3500;

  // ── Voice activity detection (Silero VAD) ──────────────────────────────
  static const double vadThreshold = 0.5;
  static const double vadMinSilenceDurationSeconds = 0.5;
  static const double vadMinSpeechDurationSeconds = 0.25;

  /// Generous on purpose: this is a safety cap on one continuous "speech"
  /// stretch, not a pace limit. Fast chanting with almost no gaps between
  /// repetitions must never hit it and have its own audio cut off mid-mantra.
  static const double vadMaxSpeechDurationSeconds = 20.0;

  // ── Matching what was heard to the mantra ───────────────────────────────
  /// The least a chant must resemble one of the mantra's phrases to count as a
  /// repetition: half of its letters, once spellings are folded together (see
  /// `MantraPhraseMatcher`). Deliberately a floor, not a target — a fast chant
  /// or a recogniser that drops letters still counts, and a different mantra
  /// does not reach it.
  static const double matchThreshold = 0.5;

  /// Very short mantras (an "Om") would reach half by chance, so below
  /// [shortPhraseLetters] folded letters the bar rises, by up to this much.
  static const double shortPhraseExtra = 0.25;
  static const int shortPhraseLetters = 24;

  /// A short phrase counts only if it ends within this many phrase-lengths of
  /// the start of the unheard text. Otherwise "Om" counts in any sentence that
  /// happens to contain the sound (99 times in 24 minutes of ordinary speech).
  static const double shortPhraseReach = 1.5;

  /// A repetition is credited at the earliest point within this much of the
  /// best match, so the next one starts where it really did — not after
  /// whichever later stretch happened to score a little higher.
  static const double matchSlack = 0.1;

  /// Credit is held back while the transcript is still growing across a match,
  /// or half a repetition would count and then its other half would count
  /// again. A match is *settled* — and counted — once it is this good, once
  /// [settleTrailing] of a phrase's length has been heard past it, or once the
  /// voice stops.
  static const double strongMatch = 0.85;
  static const double settleTrailing = 0.3;

  /// A running transcript this long is closed off and started afresh, so one
  /// unbroken hour of chanting never becomes one unbounded string.
  static const int maxTranscriptLetters = 400;

  /// Silence fed after a stretch of voice so the recogniser flushes the last
  /// syllables it was still holding back.
  static const int endPaddingSamples = 6400;

  // ── Repetition feedback ─────────────────────────────────────────────────
  /// How long the status row says "counted" after a repetition.
  static const Duration defaultCooldown = Duration(milliseconds: 900);
}
