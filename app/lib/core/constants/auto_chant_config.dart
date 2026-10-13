/// Tuning and asset locations for auto count. The microphone is listened to on the
/// phone, with two small bundled models: a voice detector (Silero VAD) that says
/// whether anyone is making sound, and a 6 MB English-only recogniser whose output
/// is looked at for a mantra's allowed words. Nothing leaves the phone.
///
/// A chant is counted when one of the mantra's allowed words is heard — at most one
/// per standard chanting time. A mantra with no allowed words is counted by sound
/// alone: one chant for each standard time of it.
///
/// See `assets/models/auto_chant/NOTICE.md` for where the model comes from.
abstract final class AutoChantConfig {
  static const int sampleRate = 16000;

  // ── Model asset ─────────────────────────────────────────────────────────
  static const String vadModelAsset = 'assets/models/auto_chant/vad/silero_vad.onnx';
  static const String kwsEncoderAsset = 'assets/models/auto_chant/kws/encoder.onnx';
  static const String kwsDecoderAsset = 'assets/models/auto_chant/kws/decoder.onnx';
  static const String kwsJoinerAsset = 'assets/models/auto_chant/kws/joiner.onnx';
  static const String kwsTokensAsset = 'assets/models/auto_chant/kws/tokens.txt';

  // ── Is anyone making sound? (Silero VAD) ────────────────────────────────
  /// How sure the detector must be that a stretch is a voice, as a fraction:
  /// 0.08 is 8%. **The number to change.** Chanting is long, even and often soft,
  /// which the detector scores far below ordinary speech, so the usual 0.5 would
  /// miss it. The price of so low a bar is that a loud fan or a busy street can
  /// read as a voice: raise it if auto count runs on in a noisy room.
  static const double vadThreshold = 0.08;

  /// Silence this long ends a stretch of sound. Shorter gaps (a breath between
  /// two chants) do not break it.
  static const double vadMinSilenceDurationSeconds = 0.5;

  /// Sound must last this long to be a voice at all, so a click is not one.
  static const double vadMinSpeechDurationSeconds = 0.25;

  /// A safety cap on one continuous stretch, not a pace limit.
  static const double vadMaxSpeechDurationSeconds = 20.0;

  // ── What the English recogniser writes ──────────────────────────────────
  /// A running transcript this long is closed off and started afresh, so one
  /// unbroken hour of chanting never becomes one unbounded string.
  static const int maxTranscriptLetters = 400;

  /// Silence fed after a stretch of voice so the recogniser flushes the last
  /// syllables it was still holding back.
  static const int endPaddingSamples = 6400;

  // ── How long one chant takes ────────────────────────────────────────────
  /// Every mantra carries its own standard time (`Mantra.durationMs`, set on the
  /// admin **Mantras** page). One that has none is taken to be this long per
  /// letter of its text.
  static const double chantSecondsPerLetter = 0.2;

  /// Never shorter than this, so a one-syllable mantra is not counted every blink.
  static const double minChantSeconds = 1.0;

  /// A last, unfinished chant still counts when sound stops if at least this
  /// share of a standard time was chanted.
  static const double partialChantShare = 0.6;

  /// How often the clock is read while listening. Fine enough that a count lands
  /// on time, coarse enough to cost nothing.
  static const Duration countTick = Duration(milliseconds: 100);

  // ── Feedback ────────────────────────────────────────────────────────────
  /// How long the status row says "counted" after a chant.
  static const Duration defaultCooldown = Duration(milliseconds: 900);
}
