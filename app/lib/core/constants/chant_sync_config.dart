/// How often the counter's progress is sent to the server.
abstract final class ChantSyncConfig {
  /// Taps are sent together, at most once in this long. A chant takes several
  /// seconds, so sending after every pause in the tapping meant a request or
  /// two for nearly every chant; the server also allows only 60 writes a
  /// minute per person. What is lost if the app is killed (rather than closed
  /// or sent to the background, which both send at once) is this much of a
  /// sitting at most.
  static const Duration batchInterval = Duration(seconds: 30);
}
