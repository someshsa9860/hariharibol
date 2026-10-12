/// What a push notification's data carries, and the deeplinks it can point at.
///
/// The backend writes these (`backend/utils/sloka-push.js`, `jobs/processors/`);
/// the names here have to match what it sends. Every value arrives as a string.
abstract final class PushConfig {
  // ── A verse's place in its book (the daily sloka) ───────────────────────
  static const String bookSlugKey = 'bookSlug';
  static const String cantoNumberKey = 'cantoNumber';
  static const String chapterNumberKey = 'chapterNumber';
  static const String verseNumberKey = 'verseNumber';

  // ── The deeplink a notification names, for the ones that are not a verse ─
  static const String deeplinkKey = 'deeplink';
  static const String deeplinkScheme = 'hariharibol';
  static const String deeplinkSadhana = 'sadhana';
  static const String deeplinkPremium = 'premium';
}
