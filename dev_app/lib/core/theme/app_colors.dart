import 'package:flutter/material.dart';

/// The palette. This is a working tool, not the reader's app: cool indigo for actions, and three signal
/// colours for how much an event matters. Every colour in the app comes from here or from the
/// [ColorScheme] built from it.
abstract final class AppColors {
  static const Color seed = Color(0xFF3F51B5);

  // Severity of a feed event. Always shown with an icon as well, so colour is never the only signal.
  static const Color info = Color(0xFF1E88E5);
  static const Color warning = Color(0xFFEF8F00);
  static const Color critical = Color(0xFFD32F2F);
  static const Color good = Color(0xFF2E7D32);

  static const Color infoDark = Color(0xFF64B5F6);
  static const Color warningDark = Color(0xFFFFB74D);
  static const Color criticalDark = Color(0xFFEF9A9A);
  static const Color goodDark = Color(0xFF81C784);
}
