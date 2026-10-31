/// Tuning for what the app keeps so it works with no connection. Nothing here
/// is user-facing. See "Offline" in app/CLAUDE.md.
abstract final class OfflineConfig {
  // ── The saved answers (`ResponseCache`) ──────────────────────────────────

  /// Answers kept at most. Past this the oldest go first. Each is small (a
  /// calendar month, an etiquette item, a page of reels), and the box is held
  /// in memory, so this bounds the memory as much as the disk.
  static const int maxSavedResponses = 1000;

  /// An answer longer than this (characters of JSON) is not kept. Book text is
  /// not kept here at all (it is in the offline library); this only stops one
  /// unusually large answer from crowding out the rest.
  static const int maxSavedResponseLength = 400000;

  /// How many of the oldest answers go at once when [maxSavedResponses] is
  /// passed, so the box is not trimmed on every write.
  static const int evictBatch = 50;

  // ── Fetching ahead (`OfflineWarmer`) ─────────────────────────────────────

  /// How often the app fetches ahead what a reader might open offline. Coming
  /// back to the app, or the connection returning, within this of the last
  /// pass that reached the server does nothing. A change of reading or app
  /// language does not wait.
  static const Duration warmInterval = Duration(hours: 6);

  /// Calendar months fetched ahead: this many before the current one and this
  /// many after it.
  static const int calendarMonthsBefore = 1;
  static const int calendarMonthsAfter = 3;

  /// Days of upcoming festivals Home shows (`CalendarService.upcoming`).
  static const int upcomingFestivalDays = 30;

  /// An etiquette item's page saved longer ago than this is fetched again, so
  /// an edit or a new translation reaches a phone that already has the item.
  static const Duration itemRefreshAfter = Duration(days: 7);

  /// Requests made at once while fetching etiquette items or a book's cantos
  /// one by one.
  static const int warmConcurrency = 4;

  /// How long after sign-in or launch the first pass waits, so the screen the
  /// reader is looking at gets the network first.
  static const Duration warmDelay = Duration(seconds: 10);

  // ── Mala recordings (`MalaAudioCache`) ───────────────────────────────────

  /// Chant-along recordings kept on the phone at most — a few MB each. Past
  /// this the one played least recently goes.
  static const int maxSavedRecordings = 6;

  /// How long a recording's download may take to connect, and to go quiet
  /// mid-file, before it is given up (to be tried again the next time).
  static const Duration recordingConnectTimeout = Duration(seconds: 15);
  static const Duration recordingReceiveTimeout = Duration(seconds: 30);
}
