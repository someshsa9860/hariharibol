/// Tuning and asset locations for auto-count: listen to the mic, recognise a
/// known mantra's own sound, count each completed repetition — no cloud
/// speech-to-text, no network.
///
/// See `assets/models/auto_chant/NOTICE.md` for where the bundled models come
/// from and how to add a mantra.
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

  // ── Keyword spotting ───────────────────────────────────────────────────
  /// Deliberately more conservative than the library's own default (0.25).
  /// A missed repetition costs nothing — chant it again. A false count sits
  /// in the total until the user notices and second-guesses the whole
  /// session, which is the worse failure by far.
  static const double kwsThreshold = 0.5;
  static const double kwsBoostScore = 2.0;
  static const int kwsMaxActivePaths = 4;

  // ── Repetition cooldown ─────────────────────────────────────────────────
  static const Duration defaultCooldown = Duration(milliseconds: 900);
  static const Duration minCooldown = Duration(milliseconds: 400);
  static const Duration maxCooldown = Duration(seconds: 4);

  /// Half of one mantra's own pace: short enough to admit real back-to-back
  /// chanting, long enough to absorb one stray re-trigger. Falls back to
  /// [defaultCooldown] for a mantra with no timed pace of its own.
  static Duration cooldownFor(int mantraDurationMs) {
    if (mantraDurationMs <= 0) return defaultCooldown;
    final half = Duration(milliseconds: (mantraDurationMs / 2).round());
    if (half < minCooldown) return minCooldown;
    if (half > maxCooldown) return maxCooldown;
    return half;
  }

  /// One entry per mantra the auto-counter can hear, keyed by slug. A mantra
  /// with no entry here simply does not offer the switch.
  static const Map<String, MantraKeyword> _keywords = {
    'hare-krishna-mahamantra': MantraKeyword(
      // "Hare Hare" closes both lines of one full recitation — shorter and
      // more reliably spotted than the whole 32-syllable mantra end to end,
      // so two firings make one repetition rather than one firing of the
      // entire phrase.
      tokens: '▁HA RE ▁HA RE',
      detectionsPerRepetition: 2,
    ),
    'om-namah-shivaya': MantraKeyword(tokens: '▁O M ▁NA MA H ▁S H IV A Y A'),
  };

  static MantraKeyword? keywordFor(String mantraSlug) => _keywords[mantraSlug];
}

/// A mantra's cue for the keyword spotter: its phrase (or a short, reliably
/// distinctive piece of it) already tokenised against the bundled model's BPE
/// vocabulary, plus how many firings of that cue make up one repetition.
class MantraKeyword {
  const MantraKeyword({required this.tokens, this.detectionsPerRepetition = 1});

  /// Space-separated BPE pieces, e.g. `▁O M ▁NA MA H ▁S H IV A Y A`. Produced
  /// offline — see the NOTICE — never derived on-device.
  final String tokens;

  final int detectionsPerRepetition;
}
