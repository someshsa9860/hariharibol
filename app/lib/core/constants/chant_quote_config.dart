/// How the quotes on the chanting page behave.
abstract final class ChantQuoteConfig {
  /// A new quote after this many chants counted, so a round of 108 shows nine.
  static const int chantsPerQuote = 12;

  /// The lines of a quote that are drawn before it is cut with an ellipsis; the
  /// quotes are short, so this is only a guard against a very long edit.
  static const int maxLines = 12;
}
