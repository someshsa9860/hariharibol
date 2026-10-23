/// What the screen that adds a reader's own mantra would otherwise type inline:
/// the words the API uses, the limits it holds to and the codes it answers with.
abstract final class OwnMantraConfig {
  // ── Whose mantra it is ─────────────────────────────────────────────────────

  /// `Mantra.mantraType`. A private mantra is listed only for the readers who
  /// hold it; at 11 readers the server makes it public in every language.
  static const String typePublic = 'PUBLIC';
  static const String typePrivate = 'PRIVATE';

  // ── What a suggestion is for ───────────────────────────────────────────────

  static const String kindDeity = 'deity';
  static const String kindSaint = 'saint';

  // ── A suggestion's standing ────────────────────────────────────────────────

  /// Nobody holds it yet.
  static const String statusNew = 'new';

  /// Other readers hold it already; choosing it adds the reader to them.
  static const String statusShared = 'shared';

  /// Already on this reader's list.
  static const String statusYours = 'yours';

  /// Already in the catalogue, open to everyone — opened rather than added.
  static const String statusCatalog = 'catalog';

  // ── What happened to a choice ──────────────────────────────────────────────

  static const String resultCreated = 'created';
  static const String resultShared = 'shared';
  static const String resultAlready = 'already';
  static const String resultFailed = 'failed';

  // ── Limits (the server holds the same ones) ────────────────────────────────

  /// Mantras that can be chosen from one search.
  static const int maxPicks = 5;

  /// The longest thing a reader can type or say.
  static const int maxText = 1000;

  // ── Codes the API answers with ─────────────────────────────────────────────

  static const String codeInputNotUsable = 'MANTRA_INPUT_NOT_USABLE';
  static const String codeListFull = 'MANTRA_LIMIT';
  static const String codeAiUnavailable = 'MANTRA_AI_UNAVAILABLE';
  static const String codePictureTooLarge = 'IMAGE_TOO_LARGE';
  static const String codePictureNotUsable = 'IMAGE_NOT_USABLE';

  /// The suggestions were kept for an hour and the hour has passed. The client
  /// has no kind for it, so it is read from the status.
  static const int statusExpired = 410;

  /// A picture over the size the server takes.
  static const int statusTooLarge = 413;

  // ── The picture ────────────────────────────────────────────────────────────

  /// The picker re-encodes what it returns, so the server is always told JPEG.
  static const String pictureContentType = 'image/jpeg';

  /// The shape of the picture across the top of a mantra's page (wide : high).
  static const double pictureAspect = 16 / 9;
}
