/// Support, feedback and the store-rating prompt.
///
/// The categories and the throttle must agree with `backend/services/support.js`
/// (`CATEGORIES`, `PROMPT_GAP_DAYS`).
abstract final class SupportConfig {
  /// The topics a ticket can be filed under, in the order they are offered.
  /// The wire value is what the API stores; the words come from the ARB.
  static const List<String> categories = ['bug', 'payment', 'account', 'content', 'suggestion', 'other'];

  /// The category a quick star rating is filed under.
  static const String feedbackCategory = 'suggestion';

  static const int ticketMaxChars = 4000;
  static const int starCount = 5;

  /// A screenshot is scaled to this before it is sent (the server takes up to 5 MB).
  static const double screenshotMaxEdge = 1600;
  static const int screenshotQuality = 80;

  /// How a reader is asked for a store rating (the server checks the same and more).
  static const Duration reviewMinGap = Duration(days: 90);
  static const String triggerStreak = 'streak';
  static const String triggerSession = 'session';
  static const Duration reviewPromptDelay = Duration(milliseconds: 900);
}
