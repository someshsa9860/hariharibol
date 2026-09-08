import 'package:flutter/material.dart';

/// Type scale.
///
/// Two voices. Body copy, labels and controls use the platform's own font — San
/// Francisco on iOS, Roboto on Android — because it costs nothing to download
/// and always looks native. Headings, the greeting and the big chant counters
/// use a serif, which is what makes the app read as a book rather than a
/// dashboard.
///
/// Devanagari and other Indic scripts stay on the platform font, which covers
/// them correctly on both platforms; the one thing they need is more line
/// height, which [verse] provides.
abstract final class AppTypography {
  static const String? fontFamily = null;

  /// The heading serif.
  ///
  /// Nothing is bundled. Georgia ships with iOS; Android has neither Georgia
  /// nor Times, and resolves the rest of the chain to Noto Serif. A downloaded
  /// face would be another asset to ship and a flash of unstyled text on every
  /// cold start, for type that is only ever a few lines of any screen.
  ///
  /// Devanagari is deliberately not this font's problem — none of these faces
  /// cover it, so verse text uses [verse] and stays on the platform default.
  static const String serif = 'Georgia';
  static const List<String> serifFallback = <String>[
    'Times New Roman',
    'Noto Serif',
    'serif',
  ];

  static TextTheme textTheme(ColorScheme scheme) {
    final base = ThemeData(brightness: scheme.brightness).textTheme;

    // Headings are set in the serif at a normal weight. The design leans on
    // size and space for hierarchy, not on bold — a heavy serif would fight the
    // Sanskrit sitting under it.
    TextStyle? heading(TextStyle? style, double size) => style?.copyWith(
          fontFamily: serif,
          fontFamilyFallback: serifFallback,
          fontSize: size,
          fontWeight: FontWeight.w400,
          height: 1.2,
          letterSpacing: -0.2,
        );

    return base.copyWith(
      displayLarge: heading(base.displayLarge, 44),
      displayMedium: heading(base.displayMedium, 38),
      displaySmall: heading(base.displaySmall, 32),
      headlineLarge: heading(base.headlineLarge, 30),
      headlineMedium: heading(base.headlineMedium, 26),
      headlineSmall: heading(base.headlineSmall, 22),

      titleLarge: base.titleLarge?.copyWith(fontWeight: FontWeight.w600, height: 1.3),
      titleMedium: base.titleMedium?.copyWith(fontWeight: FontWeight.w600),
      titleSmall: base.titleSmall?.copyWith(fontWeight: FontWeight.w600),
      bodyLarge: base.bodyLarge?.copyWith(height: 1.5),
      bodyMedium: base.bodyMedium?.copyWith(height: 1.5),
      bodySmall: base.bodySmall?.copyWith(height: 1.45, color: scheme.onSurfaceVariant),
      labelLarge: base.labelLarge?.copyWith(fontWeight: FontWeight.w600, letterSpacing: 0.1),
    );
  }

  /// Sanskrit and transliteration. Larger, looser, and centred by the widget
  /// that uses it — scripts with matras need the extra leading to stay legible.
  static TextStyle verse(BuildContext context, {double? size}) {
    return Theme.of(context).textTheme.titleMedium!.copyWith(
          fontSize: size,
          height: 1.9,
          fontWeight: FontWeight.w500,
        );
  }

  /// The romanised line under the Sanskrit. Italic, and quieter than both the
  /// script above it and the translation below, because it is a pronunciation
  /// aid rather than something to read.
  static TextStyle transliteration(BuildContext context) {
    return Theme.of(context).textTheme.bodyMedium!.copyWith(
          fontStyle: FontStyle.italic,
          height: 1.6,
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        );
  }

  /// A section heading above a list.
  static TextStyle section(BuildContext context) {
    return Theme.of(context).textTheme.headlineSmall!.copyWith(fontSize: 20);
  }

  /// The small letterspaced caps that label a block — "VERSE OF THE DAY".
  ///
  /// The letterspacing is what makes it read as a label rather than as shouted
  /// body copy, so it is part of the style and not left to the caller.
  static TextStyle eyebrow(BuildContext context, {Color? color}) {
    return Theme.of(context).textTheme.labelSmall!.copyWith(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.4,
          height: 1.2,
          color: color ?? Theme.of(context).colorScheme.onSurfaceVariant,
        );
  }

  /// A number meant to be looked at — the chant count, a streak. Serif, because
  /// the lining figures of the UI font look like a spreadsheet at this size.
  static TextStyle numeral(BuildContext context, {double size = 40}) {
    return TextStyle(
      fontFamily: serif,
      fontFamilyFallback: serifFallback,
      fontSize: size,
      fontWeight: FontWeight.w400,
      height: 1.0,
      letterSpacing: -1,
      color: Theme.of(context).colorScheme.onSurface,
    );
  }
}
