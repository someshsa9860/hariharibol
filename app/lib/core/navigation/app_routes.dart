/// Every route path and name, in one list.
///
/// Views never type a path. They call the navigator with one of these, so a
/// renamed route is a compile error rather than a dead link found by a user.
abstract final class AppRoutes {
  static const String splash = '/splash';
  static const String signIn = '/sign-in';

  // The four dashboard tabs. Each is a branch of the shell route, which is why
  // they are top-level paths rather than children of `/dashboard`.
  static const String home = '/home';
  static const String sadhana = '/sadhana';
  static const String library = '/library';
  static const String profile = '/profile';

  static const List<String> tabs = [home, sadhana, library, profile];
}

/// Route names, for `goNamed` calls where a path would need building.
abstract final class RouteNames {
  static const String splash = 'splash';
  static const String signIn = 'signIn';
  static const String home = 'home';
  static const String sadhana = 'sadhana';
  static const String library = 'library';
  static const String profile = 'profile';
}
