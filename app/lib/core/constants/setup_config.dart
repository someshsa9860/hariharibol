/// The first-run setup: the questions asked once, in order, before the app opens.
abstract final class SetupConfig {
  /// Steps in order: app language, reading language, favourite mantra, daily
  /// rounds, routine. The progress line reads "Step n of this".
  static const int stepCount = 5;
}
