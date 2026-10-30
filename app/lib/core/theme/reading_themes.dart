import 'package:flutter/material.dart';

/// The look of the reading page: the paper and ink a chapter is read on.
///
/// These are the reading page's own, kept apart from [AppColors] on purpose:
/// the app's chrome is one orange and never white on black, but a long read
/// wants something softer. None of these is pure white or pure black — a
/// bright page or white letters on black glare, worst for Devanagari's fine
/// matras. `test/reading_themes_test.dart` checks every pairing against WCAG.
enum ReadingLook {
  /// Follows the app's light or dark theme, as the reading page always has.
  matchApp,
  warmPaper,
  sepia,
  mist,
  dusk,
  night;

  /// The palette for this look, or null for [matchApp].
  ReadingPalette? get palette => switch (this) {
        ReadingLook.matchApp => null,
        ReadingLook.warmPaper => ReadingPalette.warmPaper,
        ReadingLook.sepia => ReadingPalette.sepia,
        ReadingLook.mist => ReadingPalette.mist,
        ReadingLook.dusk => ReadingPalette.dusk,
        ReadingLook.night => ReadingPalette.night,
      };
}

/// One reading look. The accent is the only colour that is not a neutral tone
/// of the page; in the dark looks it is a soft amber rather than white, because
/// amber on charcoal is gentler than white on black at the same contrast.
@immutable
class ReadingPalette {
  const ReadingPalette({
    required this.isDark,
    required this.page,
    required this.card,
    required this.selected,
    required this.hairline,
    required this.text,
    required this.muted,
    required this.accent,
  });

  final bool isDark;

  /// The page behind the text.
  final Color page;

  /// A verse card, a step lighter or darker than the page.
  final Color card;

  /// A selected verse, and the fill of an unselected chip.
  final Color selected;
  final Color hairline;

  /// Body text, Sanskrit and the meaning.
  final Color text;

  /// Transliteration and secondary text.
  final Color muted;

  /// Links, the selected verse's border and the chosen chip.
  final Color accent;

  static const warmPaper = ReadingPalette(
    isDark: false,
    page: Color(0xFFF5ECD9),
    card: Color(0xFFFBF5E8),
    selected: Color(0xFFEFE2C6),
    hairline: Color(0xFFE0D0B4),
    text: Color(0xFF2E2418),
    muted: Color(0xFF5E4B38),
    accent: Color(0xFFB5420F),
  );

  static const sepia = ReadingPalette(
    isDark: false,
    page: Color(0xFFEBDBBC),
    card: Color(0xFFF2E5CA),
    selected: Color(0xFFE0CDA6),
    hairline: Color(0xFFD2BE98),
    text: Color(0xFF3B2A1A),
    muted: Color(0xFF64492F),
    accent: Color(0xFF9A3A0C),
  );

  /// A cool neutral, for anyone who finds the warm papers yellow.
  static const mist = ReadingPalette(
    isDark: false,
    page: Color(0xFFE3E8E1),
    card: Color(0xFFECF0EA),
    selected: Color(0xFFD6DED3),
    hairline: Color(0xFFC8D1C6),
    text: Color(0xFF232B26),
    muted: Color(0xFF4A5750),
    accent: Color(0xFFA8400E),
  );

  static const dusk = ReadingPalette(
    isDark: true,
    page: Color(0xFF24211E),
    card: Color(0xFF2E2A26),
    selected: Color(0xFF3A342E),
    hairline: Color(0xFF3D3832),
    text: Color(0xFFD9D2C5),
    muted: Color(0xFFA89F90),
    accent: Color(0xFFE8A15A),
  );

  static const night = ReadingPalette(
    isDark: true,
    page: Color(0xFF141210),
    card: Color(0xFF1D1A17),
    selected: Color(0xFF2A2520),
    hairline: Color(0xFF2E2A25),
    text: Color(0xFFC8B79B),
    muted: Color(0xFF9A8A72),
    accent: Color(0xFFD99A55),
  );
}

/// The app's theme with the reading page's colours laid over it. A verse, the
/// app bar and the player bar all read their colours from the theme, so they
/// change together with no colour set in the widgets.
ThemeData readingLookTheme(ReadingLook look, ThemeData base) {
  final palette = look.palette;
  if (palette == null) return base;
  final p = palette;

  final scheme = base.colorScheme.copyWith(
    brightness: p.isDark ? Brightness.dark : Brightness.light,
    surface: p.page,
    onSurface: p.text,
    onSurfaceVariant: p.muted,
    surfaceContainerLowest: p.card,
    surfaceContainerLow: p.card,
    surfaceContainer: p.selected,
    surfaceContainerHigh: p.selected,
    surfaceContainerHighest: p.selected,
    outline: p.muted,
    outlineVariant: p.hairline,
    primary: p.accent,
    onPrimary: p.card,
    primaryContainer: p.selected,
    onPrimaryContainer: p.text,
    inverseSurface: p.text,
    onInverseSurface: p.page,
  );

  return base.copyWith(
    colorScheme: scheme,
    scaffoldBackgroundColor: p.page,
    textTheme: base.textTheme.apply(bodyColor: p.text, displayColor: p.text).copyWith(
          bodySmall: base.textTheme.bodySmall?.copyWith(color: p.muted),
        ),
    appBarTheme: base.appBarTheme.copyWith(backgroundColor: p.page, foregroundColor: p.text),
    cardTheme: base.cardTheme.copyWith(color: p.card),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: p.card,
      selectedColor: p.accent,
      secondaryLabelStyle: base.chipTheme.secondaryLabelStyle?.copyWith(color: p.card),
    ),
  );
}
