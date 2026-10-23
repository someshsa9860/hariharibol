/// Tuning and asset locations for auto count. The microphone is listened to on the
/// phone, with one small bundled model: a voice detector (Silero VAD) that says
/// whether anyone is making sound. Nothing is recognised and nothing leaves the phone.
///
/// A chant is counted for each standard chanting time of sound — see
/// `VoiceChantCounter`.
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
  /// letter of its text — a rough guess, so set the real time where it matters.
  static const double chantSecondsPerLetter = 0.1;

  /// Never shorter than this, so a one-syllable mantra is not counted every blink.
  static const double minChantSeconds = 1.0;

  /// How long one chant is taken to last is the reader's: it starts as the
  /// standard time, the reader can lengthen or shorten it by a step
  /// ([paceStepShare]), and a round they finish tells it what their real pace is
  /// (`ChantPace`). It stays between these two shares of the standard time.
  /// **The numbers to change** if auto count is still counting ahead of people
  /// (raise [fastestShare]) or too many are held back (lower it).
  ///
  /// Counting is never faster than 45% of the standard time, however it came by
  /// the pace — a round measured over a few taps, a stray tap on "shorter".
  static const double fastestShare = 0.45;

  /// ...nor slower than this many times the standard time, so a round left half
  /// done while the phone was put down does not teach auto count a crawl.
  static const double slowestShare = 3.0;

  /// One press of "shorter" or "longer" moves the pace by this share of the
  /// standard time (never less than [minPaceStepMs]).
  static const double paceStepShare = 0.05;
  static const int minPaceStepMs = 100;

  /// With auto count off the ring is tapped by hand, and a tap that comes sooner
  /// than this share of one chant (at the reader's pace) after the last is
  /// ignored — nobody has finished a chant in that time, so it would only be a
  /// tap with no chanting behind it. Half of the pace is always shorter than the
  /// quickest real chant.
  static const double manualTapGapShare = 0.5;

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
