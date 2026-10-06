/// Every route path and name, in one list.
///
/// Views never type a path. They call the navigator with one of these, so a
/// renamed route is a compile error rather than a dead link found by a user.
abstract final class AppRoutes {
  static const String splash = '/splash';
  static const String signIn = '/sign-in';

  /// Asked once, on the first run of a new account.
  static const String languageSetup = '/language';

  // The four dashboard tabs. Each is a branch of the shell route, which is why
  // they are top-level paths rather than children of `/dashboard`.
  static const String home = '/home';
  static const String sadhana = '/sadhana';
  static const String library = '/library';
  static const String routine = '/routine';

  /// Pushed from Home's avatar, so it keeps the tab bar behind it.
  static const String settings = '/settings';

  /// Plans and what each unlocks. Pushed from settings.
  static const String plans = '/plans';

  /// The search screen. Pushed from Library's app bar; searches the server's
  /// index, never a local one.
  static const String search = '/search';

  /// One kind's full, lazy-loaded results — what a search's "see all" opens.
  /// `query` rides in the query string, the same way [chapterPath] carries
  /// its position, so the screen can always rebuild itself from the URL.
  static const String searchResultsPattern = '/search/:scope';
  static String searchResultsPath(String scope, String query) =>
      '/search/$scope?q=${Uri.encodeQueryComponent(query)}';

  /// A single mantra. The `:slug` route is registered under [mantraPattern];
  /// this builds the concrete path for `push`/`go`.
  static const String mantraPattern = '/mantras/:slug';
  static String mantraPath(String slug) => '/mantras/$slug';

  /// A book: its cantos (Srimad Bhagavatam) or chapters (everything else)
  /// directly.
  static const String bookPattern = '/library/:slug';
  static String bookPath(String slug) => '/library/$slug';

  /// One canto's chapters — the Bhagavatam only. The Gita has no canto level
  /// and goes straight from [bookPattern] to [chapterPattern].
  static const String bookCantoPattern = '/library/:slug/cantos/:canto';
  static String bookCantoPath(String slug, int canto) => '/library/$slug/cantos/$canto';

  /// The reading screen. `canto` and `verse` ride in the query string rather
  /// than `extra` so the screen is deep-link-safe — it can always rebuild its
  /// own state from the URL alone, the same way the API itself takes
  /// `?canto=`. `verse` is where in the chapter to scroll to, not which
  /// chapter to open, so it never affects which page loads — only where it
  /// lands.
  static const String chapterPattern = '/library/:slug/chapters/:number';
  static String chapterPath(String slug, int number, {int? canto, int? verse}) {
    final path = '/library/$slug/chapters/$number';
    final query = <String>[
      if (canto != null) 'canto=$canto',
      if (verse != null) 'verse=$verse',
    ];
    return query.isEmpty ? path : '$path?${query.join('&')}';
  }

  /// The chant counter. Pushed with no tab bar behind it — a round in progress
  /// is not a screen to half-see while switching tabs.
  static const String chant = '/chant';

  /// Reels. Pushed from the nav bar's action circle rather than a tab — the
  /// one thing worth reaching from anywhere, same treatment [chant] used to
  /// get before Jap became a tab of its own.
  static const String reels = '/reels';

  /// One reel on its own — what a share link and a push notification open.
  /// Registered under [reelPattern]; [reelPath] builds the concrete path.
  static const String reelPattern = '/reels/:id';
  static String reelPath(String id) => '/reels/$id';

  /// A creator's profile and everything they have posted.
  static const String creatorPattern = '/creators/:id';
  static String creatorPath(String id) => '/creators/$id';

  static const List<String> tabs = [home, sadhana, library, routine];
}

/// Route names, for `goNamed` calls where a path would need building.
abstract final class RouteNames {
  static const String splash = 'splash';
  static const String signIn = 'signIn';
  static const String languageSetup = 'languageSetup';
  static const String home = 'home';
  static const String sadhana = 'sadhana';
  static const String library = 'library';
  static const String routine = 'routine';
  static const String settings = 'settings';
  static const String plans = 'plans';
  static const String search = 'search';
  static const String searchResults = 'searchResults';
  static const String mantraDetail = 'mantraDetail';
  static const String bookDetail = 'bookDetail';
  static const String bookCanto = 'bookCanto';
  static const String chapterRead = 'chapterRead';
  static const String chant = 'chant';
  static const String reels = 'reels';
  static const String reelDetail = 'reelDetail';
  static const String creatorProfile = 'creatorProfile';
}
