/// Tuning and asset locations for auto count: listen to the microphone and, while
/// there is sound, count one chant for each standard time of it. Nothing is
/// recognised, nothing leaves the phone — a small voice detector (Silero VAD) is
/// the only model.
///
/// See `assets/models/auto_chant/NOTICE.md` for where the model comes from.
abstract final class AutoChantConfig {
  static const int sampleRate = 16000;

  // ── Model asset ─────────────────────────────────────────────────────────
  static const String vadModelAsset = 'assets/models/auto_chant/vad/silero_vad.onnx';

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
