/// Everything the chat would otherwise type inline: timings, limits, sizes.
abstract final class ChatConfig {
  // ── Streaming ──────────────────────────────────────────────────────────────

  /// Streamed text is buffered and shown at most this often. The server sends a
  /// piece every few milliseconds; repainting a markdown tree for each one is
  /// what makes a reply flicker.
  static const Duration flushInterval = Duration(milliseconds: 50);

  /// A stopped reply is charged a moment after the connection closes, so the
  /// meter is re-read a little later rather than straight away.
  static const Duration creditsRefreshDelay = Duration(milliseconds: 1500);

  // ── The message box ───────────────────────────────────────────────────────

  /// Used until the server's own limit arrives.
  static const int fallbackMaxInputChars = 4000;

  /// The composer grows to this many lines, then scrolls.
  static const int composerMaxLines = 6;

  /// The character count appears once the message passes this share of the limit.
  static const double counterShowsAt = 0.8;

  // ── Bubbles ───────────────────────────────────────────────────────────────

  /// A bubble is never wider than this share of the screen.
  static const double bubbleMaxShare = 0.88;

  /// The corner of a bubble that points at its speaker is tighter than the rest.
  static const double bubbleTailRadius = 6;

  /// Sakha's face beside an answer.
  static const double bubbleAvatar = 28;

  /// A picture in an answer is never taller than this.
  static const double imageMaxHeight = 280;

  /// A picture the reader sent is shown as a square this big, inside the bubble.
  static const double sentImageSize = 240;

  /// A new message rises this far while it fades in, over [messageEntrance].
  static const double messageRise = 14;
  static const Duration messageEntrance = Duration(milliseconds: 260);

  /// The "latest" button appears once the reader has scrolled this far up.
  static const double jumpToLatestAt = 240;

  // ── The credit meter ──────────────────────────────────────────────────────

  /// The bar in the app bar. It is thin because it shares the line with the
  /// title and the clear button.
  static const double meterHeight = 4;

  /// How long the meter's longer explanation stays up after a tap.
  static const Duration meterTipShown = Duration(seconds: 4);

  // ── Waiting ───────────────────────────────────────────────────────────────

  /// The typing indicator: dot size and one pulse.
  static const double typingDot = 8;
  static const Duration typingPulse = Duration(milliseconds: 900);

  // ── Suggestions ───────────────────────────────────────────────────────────

  /// A starter card on the empty chat.
  static const double suggestionWidth = 208;
  static const double suggestionHeight = 136;

  /// Starter cards come in one after another, this far apart.
  static const Duration suggestionStagger = Duration(milliseconds: 70);

  // ── Pictures ──────────────────────────────────────────────────────────────

  /// A picture is scaled down on the phone before it goes up: nothing needs
  /// more than this on its longest side to be read.
  static const double imageMaxEdge = 1280;
  static const int imageQuality = 82;

  /// The picture waiting in the message box.
  static const double draftThumbnail = 72;

  // ── Talking instead of typing ─────────────────────────────────────────────

  /// Listening ends by itself after this long, or after this much silence.
  static const Duration listenFor = Duration(seconds: 60);
  static const Duration pauseFor = Duration(seconds: 4);

  /// Where the phone offers several accents of the reader's language
  /// (`en_US`, `en_IN`, `hi_IN`…), this region is the one picked.
  static const String speechRegion = 'IN';

  /// One swell of the microphone button while it is listening.
  static const Duration micPulse = Duration(milliseconds: 1200);
}
