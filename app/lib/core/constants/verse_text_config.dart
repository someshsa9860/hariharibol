/// Numbers the Sanskrit on the reading page needs that are not copy, colour or
/// spacing.
abstract final class VerseTextConfig {
  /// The room a verse's number has at the left in story mode, before the text
  /// starts — the same for every verse, so every line of the verse begins at
  /// one edge. Wide enough for three digits; scaled with the reading size.
  static const double numberGutter = 30;

  /// How large the "…उवाच" line that names the speaker is, against the verse.
  static const double speakerScale = 0.86;
}
