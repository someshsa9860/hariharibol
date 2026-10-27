/// How the chanting kept on the phone is sent to the server.
///
/// Every chant is written to the phone at once; the server hears of it in a
/// batch (`ChantSyncer`) — when the app is closed or goes to the background,
/// when it opens, when the connection comes back, and every [batchInterval] in
/// between while someone chants.
abstract final class ChantSyncConfig {
  /// What has been counted is sent together, at most once in this long while
  /// the counter is open. The server allows only 60 writes a minute per person,
  /// and a request per chant would be most of them. What is lost if the app is
  /// killed is nothing: the count is on the phone and goes up with the next
  /// batch, even days later.
  static const Duration batchInterval = Duration(minutes: 2);

  /// After a failed batch, how long to wait before trying again, doubling each
  /// time up to the longest.
  static const Duration retryFirst = Duration(seconds: 30);
  static const Duration retryLongest = Duration(minutes: 15);

  /// Sittings in one request (the server's limit). A phone that was offline for
  /// weeks sends the rest in further requests straight after.
  static const int sittingsPerRequest = 25;

  /// Requests one run sends at most, so a phone with a great deal waiting does
  /// not use up the server's 60 writes a minute in one go. What is left is sent
  /// by the next run, which is asked for at once. Even full to the server's
  /// limits a request is well under its 1 MB body.
  static const int requestsPerRun = 8;

  /// Rounds of one sitting in one request (the server's limit); a very long
  /// sitting sends the rest in the next one.
  static const int malasPerSitting = 200;

  /// A sitting that has been sent and is older than this many days (today
  /// counting as the first) is forgotten on the phone; one the server has not
  /// heard of is kept however old. The days kept are what lets the phone tell
  /// what the server's figures lack while its answer is a moment behind.
  static const int keepSyncedDays = 2;

  /// The most the server takes in each figure of a sitting. The phone holds its
  /// figures to them before sending, so a sitting can never turn into a request
  /// the server refuses again and again.
  static const int maxRounds = 500;
  static const int maxBeads = 108;
  static const int maxMalaIndex = 500;
  static const int maxMalaBeads = 120;
  static const int maxMalaMs = 86400000;
}
