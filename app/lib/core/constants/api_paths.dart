/// Every endpoint the app calls, in one list.
///
/// Mirrors `backend/routes/app/` — if a path changes there it changes here, and
/// nowhere else. Paths are relative to `AppConfig.apiBaseUrl`.
abstract final class ApiPaths {
  static const String _app = '/api/app';

  // Auth
  static const String signInSocial = '$_app/auth/social';
  static const String refresh = '$_app/auth/refresh';
  static const String logout = '$_app/auth/logout';
  static const String logoutAll = '$_app/auth/logout-all';
  static const String deleteAccount = '$_app/auth/account';

  // Device and push
  static const String registerDevice = '$_app/devices';
  static const String fcmToken = '$_app/devices/fcm-token';
  static const String topics = '$_app/devices/topics';
  static String topic(String key) => '$_app/devices/topics/$key';

  // Account
  static const String me = '$_app/me';
  static const String meLanguages = '$_app/me/languages';
  static const String meSadhanaProfile = '$_app/me/sadhana-profile';
  static const String meSummary = '$_app/me/summary';

  // Dashboard
  static const String home = '$_app/home';

  // Library
  static const String books = '$_app/books';
  static String book(String slug) => '$_app/books/$slug';
  static String bookCantos(String slug) => '$_app/books/$slug/cantos';
  static String bookChapters(String slug) => '$_app/books/$slug/chapters';
  static String bookChapter(String slug, int number) => '$_app/books/$slug/chapters/$number';

  static const String verses = '$_app/verses';
  static String verse(String verseId) => '$_app/verses/$verseId';
  static String verseTranslations(String verseId) => '$_app/verses/$verseId/translations';
  static String verseNarrations(String verseId) => '$_app/verses/$verseId/narrations';
  static String verseRelated(String verseId) => '$_app/verses/$verseId/related';

  static const String mantras = '$_app/mantras';
  static const String mantraCategories = '$_app/mantras/categories';
  static String mantra(String slug) => '$_app/mantras/$slug';

  static const String search = '$_app/search';

  // Sadhana
  static const String sadhanaToday = '$_app/sadhana/today';
  static const String chantManual = '$_app/sadhana/chant/manual';
  static const String chantSession = '$_app/sadhana/chant/session';
  static String chantSessionById(String id) => '$_app/sadhana/chant/session/$id';
  static const String sadhanaDays = '$_app/sadhana/days';
  static const String sadhanaReport = '$_app/sadhana/report';

  static const String tasks = '$_app/sadhana/tasks';
  static const String tasksCarried = '$_app/sadhana/tasks/carried';
  static String task(String id) => '$_app/sadhana/tasks/$id';
  static String taskMove(String id) => '$_app/sadhana/tasks/$id/move';

  // Sloka for you
  static const String slokaToday = '$_app/sloka/today';
  static const String slokaMine = '$_app/sloka/mine';
  static const String slokaMood = '$_app/sloka/mood';
  static String slokaSeen(String id) => '$_app/sloka/$id/seen';
  static const String slokaHistory = '$_app/sloka/history';

  // Issues (the moods a sloka answers)
  static const String issues = '$_app/issues';
  static const String issueReport = '$_app/issues/report';
  static const String issuesMine = '$_app/issues/mine';
  static const String issueTrends = '$_app/issues/trends';

  // Reading
  static const String favorites = '$_app/favorites';
  static String favorite(String id) => '$_app/favorites/$id';
  static const String progress = '$_app/progress';
  static String progressForBook(String bookId) => '$_app/progress/$bookId';

  // Notifications
  static const String notifications = '$_app/notifications';
  static const String unreadCount = '$_app/notifications/unread-count';
  static String notificationRead(String id) => '$_app/notifications/$id/read';
  static const String notificationsReadAll = '$_app/notifications/read-all';

  // Money
  static const String plans = '$_app/subscription/plans';
  static const String mySubscription = '$_app/subscription/me';
  static const String verifyPurchase = '$_app/subscription/verify';
  static const String restorePurchases = '$_app/subscription/restore';
  static const String razorpayOrder = '$_app/donations/razorpay/order';
  static const String razorpayVerify = '$_app/donations/razorpay/verify';
  static const String storeDonation = '$_app/donations/store';
  static const String myDonations = '$_app/donations/mine';

  // Reference data
  static const String languages = '$_app/reference/languages';
  static const String deities = '$_app/reference/deities';
  static const String gurus = '$_app/reference/gurus';
  static const String translators = '$_app/reference/translators';
}

/// Header names the API reads. `middleware/context.js` is the other half.
abstract final class ApiHeaders {
  static const String authorization = 'Authorization';
  static const String deviceId = 'X-Device-Id';
  static const String platform = 'X-Platform';
  static const String appVersion = 'X-App-Version';
  static const String requestId = 'X-Request-Id';
  static const String appCheck = 'X-Firebase-AppCheck';
  static const String acceptLanguage = 'Accept-Language';
}
