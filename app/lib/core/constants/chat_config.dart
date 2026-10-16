/// Everything the chat would otherwise type inline: timings, limits, sizes.
abstract final class ChatConfig {
  /// Streamed text is buffered and shown at most this often. The server sends a
  /// piece every few milliseconds; repainting a markdown tree for each one is
  /// what makes a reply flicker.
  static const Duration flushInterval = Duration(milliseconds: 50);

  /// A stopped reply is charged a moment after the connection closes, so the
  /// meter is re-read a little later rather than straight away.
  static const Duration creditsRefreshDelay = Duration(milliseconds: 1500);

  static const int conversationPageSize = 30;

  /// Used until the server's own limit arrives.
  static const int fallbackMaxInputChars = 4000;

  /// The composer grows to this many lines, then scrolls.
  static const int composerMaxLines = 6;

  /// The character count appears once the message passes this share of the limit.
  static const double counterShowsAt = 0.8;

  /// A bubble is never wider than this share of the screen.
  static const double bubbleMaxShare = 0.88;

  /// An image in an answer is never taller than this.
  static const double imageMaxHeight = 280;

  /// The credit meter's bar.
  static const double meterHeight = 4;

  /// The typing indicator: dot size and one pulse.
  static const double typingDot = 8;
  static const Duration typingPulse = Duration(milliseconds: 900);

  /// The longest name the server accepts for a chat.
  static const int titleMaxChars = 120;

  /// The route id of a chat that does not exist yet. The conversation is made
  /// on the server when the first message is sent, so opening "New chat" and
  /// walking away leaves nothing behind.
  static const String newChatId = 'new';
}
