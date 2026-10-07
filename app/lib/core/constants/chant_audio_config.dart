/// Tuning for the mala recording the counter can play and count along to.
abstract final class ChantAudioConfig {
  /// How often the playback position is read. A chant is a second or more
  /// long, so a tenth of a second puts each count within a tenth of the
  /// moment its chant ended — fine enough for the counter's timings, and
  /// cheap enough to read all sitting.
  static const Duration positionTick = Duration(milliseconds: 100);

  /// The most the position may move between two readings and still be
  /// listening. Anything further is a seek, and a seek must re-find its place
  /// in the count rather than count every chant it skipped (or repeated).
  static const Duration continuousStep = Duration(seconds: 2);
}
