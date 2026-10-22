/// Gaps, paddings and radii — the only numbers a layout is built from.
abstract final class AppSpacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;

  static const double radius = 12;
  static const double radiusLarge = 20;

  /// Side padding of a screen.
  static const double gutter = 16;

  /// The widest a chat bubble gets, as a share of the screen.
  static const double bubbleMaxShare = 0.78;
}
