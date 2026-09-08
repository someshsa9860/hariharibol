import 'package:flutter/material.dart';

/// The spacing scale. A 4pt grid — every gap, pad and inset in the app is one
/// of these, so nothing drifts to a stray `EdgeInsets.all(13)`.
abstract final class AppSpacing {
  static const double xxs = 2;
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;
  static const double xxxl = 48;

  /// Horizontal padding for full-width screen content.
  static const EdgeInsets screenH = EdgeInsets.symmetric(horizontal: lg);

  /// Standard padding inside a card or tile.
  static const EdgeInsets card = EdgeInsets.all(lg);

  /// Padding for a scrollable page: screen gutters plus breathing room at the
  /// bottom so the last item clears the navigation bar.
  static const EdgeInsets page = EdgeInsets.fromLTRB(lg, lg, lg, xxxl);
}

/// Corner radii. Three sizes, no more.
abstract final class AppRadius {
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 20;
  static const double pill = 999;

  static const BorderRadius smAll = BorderRadius.all(Radius.circular(sm));
  static const BorderRadius mdAll = BorderRadius.all(Radius.circular(md));
  static const BorderRadius lgAll = BorderRadius.all(Radius.circular(lg));
}

/// Sizes that would otherwise be typed inline.
abstract final class AppSizes {
  static const double iconSm = 16;
  static const double iconMd = 24;
  static const double iconLg = 32;

  static const double avatarSm = 32;
  static const double avatarMd = 44;
  static const double avatarLg = 72;

  static const double buttonHeight = 52;
  static const double coverWidth = 128;
  static const double coverHeight = 176;

  /// Widest a text column is allowed to get on a tablet.
  static const double readingMaxWidth = 680;
}

/// Animation and delay durations.
abstract final class AppDurations {
  static const Duration fast = Duration(milliseconds: 150);
  static const Duration normal = Duration(milliseconds: 250);
  static const Duration slow = Duration(milliseconds: 400);

  /// How long a snack bar stays up.
  static const Duration snack = Duration(seconds: 4);

  /// Debounce before a search query is sent.
  static const Duration searchDebounce = Duration(milliseconds: 350);
}
