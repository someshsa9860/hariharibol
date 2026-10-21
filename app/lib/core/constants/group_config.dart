/// Numbers for chanting groups and their live room. The server's own limits
/// (`GROUP_LIVE_MAX` and friends in `backend/config/constants.js`) are the
/// other half; these are only how often the phone talks.
abstract final class GroupConfig {
  /// "Still here" to the server while in the room. It drops a phone after a
  /// minute of silence, so three beats fit in that.
  static const Duration heartbeat = Duration(seconds: 20);

  /// The realtime socket: a ping to keep it open through proxies, and the wait
  /// before opening it again after it drops (doubling, to the cap).
  static const Duration socketPing = Duration(seconds: 25);
  static const Duration reconnectFirst = Duration(seconds: 1);
  static const Duration reconnectMax = Duration(seconds: 30);

  /// The socket stays open this long after its last listener leaves, so a
  /// screen replaced by another does not close and reopen it.
  static const Duration socketLinger = Duration(seconds: 1);

  /// The server closes a socket with this code for a token it does not accept.
  static const int closeBadToken = 4001;

  /// A new member's email: the server checks properly; this only stops a
  /// button being pressed on an empty box.
  static const int nameMin = 2;
  static const int nameMax = 80;
  static const int aboutMax = 300;

  /// Audio sent to the room. Echo cancellation matters most: phones are held
  /// near the mouth and the speaker is a hand away.
  static const Map<String, dynamic> microphone = {
    'echoCancellation': true,
    'noiseSuppression': true,
    'autoGainControl': true,
  };
}
