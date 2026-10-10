/// Tuning for the silent offline book sync. Nothing here is user-facing.
abstract final class BookSyncConfig {
  /// Units downloaded at once. A unit is a chapter or a canto, a few hundred KB
  /// to a few MB gzipped; more than three starts to compete with reading.
  static const int maxConcurrent = 2;

  /// The newest file shape this build understands (`schemaVersion` in the
  /// file, `BOOK_CACHE` `SCHEMA_VERSION` on the server). A unit with a higher
  /// one is left alone until the app is updated.
  static const int supportedSchemaVersion = 1;

  /// How long a fetched manifest is trusted. Opening a book twice in a minute
  /// is one request.
  static const Duration manifestTtl = Duration(minutes: 1);

  // ── One download ──────────────────────────────────────────────────────
  static const Duration connectTimeout = Duration(seconds: 15);

  /// Per read of the body, not for the whole download — a slow connection that
  /// keeps delivering is fine, a stalled one is not.
  static const Duration receiveTimeout = Duration(seconds: 30);

  /// Tries per unit inside one pass, with exponential backoff between them.
  static const int attempts = 4;
  static const Duration backoffBase = Duration(seconds: 1);
  static const Duration backoffMax = Duration(seconds: 20);

  /// A failed unit is retried each time its book is opened. After this many
  /// failures it is no longer retried by the app starting or the network
  /// returning — only by the person opening the book again.
  static const int autoRetryLimit = 5;

  // ── Background (workmanager) ──────────────────────────────────────────
  static const String backgroundTaskName = 'hariharibol.bookSync';
  static const String backgroundTaskId = 'hariharibol.bookSync.once';

  /// A background pass gives up after this long; the OS would kill it anyway.
  static const Duration backgroundBudget = Duration(minutes: 8);

  // ── Reading ───────────────────────────────────────────────────────────
  /// How long a reader waits for a unit that is not on the device yet before
  /// the screen falls back to the ordinary API call.
  static const Duration readerWait = Duration(seconds: 20);
}
