/// Keys for the two stores, so a typo cannot silently orphan saved state.
///
/// Tokens live in `flutter_secure_storage` (Keychain / Keystore) because they
/// are credentials. Everything else lives in a `hive_ce` box.
abstract final class SecureKeys {
  static const String accessToken = 'auth.access_token';
  static const String refreshToken = 'auth.refresh_token';
  static const String refreshExpiresAt = 'auth.refresh_expires_at';
}

abstract final class BoxNames {
  static const String app = 'app';
}

abstract final class BoxKeys {
  /// The signed-in user, as returned by the API. Kept so the app can draw the
  /// first frame without waiting on the network.
  static const String user = 'user';

  /// A stable per-install id sent as `X-Device-Id`. Generated once.
  static const String deviceId = 'device.id';

  /// Whether auto count was left on. The chant counter opens already listening
  /// when it was.
  static const String autoChantEnabled = 'settings.auto_chant_enabled';

  /// Beads counted into the round in progress, one key per mantra (`any` for a
  /// sitting with none), so the counter opens on the count it was left at.
  /// Deleted when the round completes.
  static String chantProgress(String? mantraId) => 'chant.progress.${mantraId ?? 'any'}';

  static const String themeMode = 'settings.theme_mode';
  static const String locale = 'settings.locale';

  /// The three independent language settings (LanguageSettings). Each is its
  /// own key so changing one cannot touch the others.
  static const String languageApp = 'settings.language.app';
  static const String languageReading = 'settings.language.reading';
  static const String languageSpeaking = 'settings.language.speaking';
  static const String readingFontSize = 'settings.reading_font_size';

  /// Whether each verse's "Word meanings" is left open. One answer for every
  /// verse, the way the font size is: someone who studies word by word wants it
  /// open everywhere, and someone who does not wants it out of the way.
  static const String wordMeaningsOpen = 'settings.word_meanings_open';

  /// Whether a part of every verse (a `VersePart` name) is hidden. One key per
  /// part, so choosing one never rewrites the others.
  static String readingHiddenPart(String part) => 'settings.reading_hidden.$part';

  /// How a chapter is laid out (`ReadingMode` name), which part story mode shows
  /// (`StoryPart` name) and whether it numbers the verses. One answer for every
  /// chapter in every book, like the font size.
  static const String readingMode = 'settings.reading_mode';
  static const String storyPart = 'settings.story_part';
  static const String storyNumbers = 'settings.story_numbers';

  /// Chapter → the verse the audio last played there.
  static const String readingLastPlayed = 'reading.last_played';

  /// Book slug → where the reader stopped in it (`{ canto?, chapter, verse }`).
  /// The account's own, so `AppSession.clear` removes it.
  static const String readingPlaces = 'reading.places';

  /// Hold the silent book sync to Wi-Fi. Off by default: it is small, and
  /// the point is that the reader never has to think about it.
  static const String syncWifiOnly = 'settings.sync_wifi_only';
  static const String onboardingSeen = 'onboarding.seen';
  static const String lastHomePayload = 'cache.home';
  static const String lastHomeFetchedAt = 'cache.home_at';

  /// Everything the Jap tab keeps so it can draw with no connection: today's
  /// practice screen and the mantras, as the API last sent them. Personal (a
  /// mantra's page carries the reader's own rounds), so `AppSession.clear`
  /// removes every key under this prefix.
  static const String sadhanaCachePrefix = 'cache.sadhana.';
  static const String sadhanaToday = '${sadhanaCachePrefix}today';

  /// The mantra copies alone. The server words them in the account's
  /// languages, so they are dropped when those change.
  static const String mantraCachePrefix = '${sadhanaCachePrefix}mantras.';
  static const String mantraCategories = '${mantraCachePrefix}categories';

  /// The mantras of one category, or all of them for `null`.
  static String mantraList(String? category) =>
      '${mantraCachePrefix}list.${category == null ? 'all' : 'category.$category'}';

  /// One mantra's own page, by slug.
  static String mantraDetail(String slug) => '${mantraCachePrefix}detail.$slug';

  /// The tasks added for a particular day. Each carries the day it belongs to.
  /// Kept here first and mirrored to the account (see `routine_sync.dart`).
  static const String routineTasks = 'routine.tasks';

  /// The optional daily routine: items that repeat every day from the day they
  /// were added.
  static const String routineDaily = 'routine.daily';

  /// Which daily items were checked on which day, each with the time it was
  /// checked at: `{ '2026-10-11': { id: minute, … } }`.
  static const String routineChecks = 'routine.checks';

  /// The id of the account the routine above belongs to. A different account
  /// signing in starts with an empty routine and gets its own from the server;
  /// without this, one person's list would be uploaded into another's account.
  static const String routineOwner = 'routine.owner';

  /// The routine as the server last answered it — what the next sync is
  /// measured against to find what this phone has changed since.
  static const String routineSynced = 'routine.synced';

  /// Legacy. Before tasks carried their own day this held the one day the list
  /// belonged to; it is read once, to date tasks saved by that version.
  static const String routineDate = 'routine.date';
}
