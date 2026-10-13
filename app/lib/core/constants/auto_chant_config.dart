/// Tuning and asset locations for auto-count: listen to the mic, transcribe it
/// on the phone, match the transcript to the open mantra's phrases, count each
/// completed repetition — no cloud speech-to-text, no network.
///
/// See `assets/models/auto_chant/NOTICE.md` for where the bundled models come
/// from. A mantra's phrases come from the API (`Mantra.chantPhrases`).
abstract final class AutoChantConfig {
  static const int sampleRate = 16000;

  // ── Bundled model assets ──────────────────────────────────────────────
  static const String vadModelAsset = 'assets/models/auto_chant/vad/silero_vad.onnx';
  static const String kwsEncoderAsset = 'assets/models/auto_chant/kws/encoder.onnx';
  static const String kwsDecoderAsset = 'assets/models/auto_chant/kws/decoder.onnx';
  static const String kwsJoinerAsset = 'assets/models/auto_chant/kws/joiner.onnx';
  static const String kwsTokensAsset = 'assets/models/auto_chant/kws/tokens.txt';

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
  /// repetition: 36% of its letters, once spellings are folded together (see
  /// `MantraPhraseMatcher`). **This is the number to change** to make auto-count
  /// stricter (higher) or more forgiving (lower), as a fraction: 0.36 is 36%.
  ///
  /// A floor, not a target. The bundled recogniser is English-trained and writes
  /// Sanskrit as a few loose syllables, so a bar of half (the earlier 0.5) left
  /// real chanting uncounted. The price is that other speech reaches it more
  /// easily too. A match counts as soon as it is settled — it does not wait for
  /// a pause — so a chant that never stops is counted as it goes.
  static const double matchThreshold = 0.36;

  /// Very short mantras (an "Om") would reach the bar by chance, so for a
  /// further repetition in the same unbroken stretch, below [shortPhraseLetters]
  /// folded letters the bar rises, by up to this much. The first repetition of a
  /// stretch is held to [matchThreshold] alone, whatever the mantra, so the
  /// percentage shown beside "needs" is the one that counts.
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
