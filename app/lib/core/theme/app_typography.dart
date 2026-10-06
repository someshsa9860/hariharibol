import 'package:flutter/material.dart';

/// How large the reading screen sets its verse and translation text, on top
/// of the base sizes below — a device preference, not a per-book setting; see
/// `providers/reading_prefs_provider.dart`.
enum ReadingFontSize {
  small,
  medium,
  large,
  extraLarge;

  double get scale => switch (this) {
        ReadingFontSize.small => 0.9,
        ReadingFontSize.medium => 1.0,
        ReadingFontSize.large => 1.15,
        ReadingFontSize.extraLarge => 1.3,
      };
}

/// Type scale.
///
/// Two voices. Headings, the greeting and the big counters are set in Playfair
/// Display — a high-contrast serif, bundled with the app. Body copy, labels and
/// controls stay on the platform's own font: San Francisco on iOS and Roboto on
/// Android are both excellent and cost nothing to ship, and neither is improved
/// on by bundling a third-party sans.
///
/// Devanagari and other Indic scripts stay on the platform font too, which
/// covers them correctly on both platforms. Playfair has no Devanagari at all,
/// which is why [verse] never touches it.
abstract final class AppTypography {
  static const String? fontFamily = null;

  /// The heading serif.
  static const String serif = 'PlayfairDisplay';

  /// Playfair ships as a variable font with a `wght` axis. Flutter will not
  /// move that axis from `fontWeight` alone — it needs the variation named
  /// explicitly — so every serif style is built through [_serif] rather than
  /// by copying a style and setting a weight.
  static TextStyle _serif({
    required double size,
    FontWeight weight = FontWeight.w400,
    double height = 1.2,
    double letterSpacing = -0.2,
    FontStyle style = FontStyle.normal,
    Color? color,
  }) {
    return TextStyle(
      fontFamily: serif,
      fontVariations: [FontVariation('wght', weight.value.toDouble())],
      fontWeight: weight,
      fontStyle: style,
      fontSize: size,
      height: height,
      letterSpacing: letterSpacing,
      color: color,
    );
  }

  static TextTheme textTheme(ColorScheme scheme) {
    final base = ThemeData(brightness: scheme.brightness).textTheme;

    // Headings are set at a normal weight. The design leans on size and space
    // for hierarchy, not on bold — and Playfair at 700 next to Sanskrit reads
    // as shouting.
    return base.copyWith(
      displayLarge: _serif(size: 44),
      displayMedium: _serif(size: 38),
      displaySmall: _serif(size: 32),
      headlineLarge: _serif(size: 30),
      headlineMedium: _serif(size: 26),
      headlineSmall: _serif(size: 22),

      titleLarge: base.titleLarge?.copyWith(fontWeight: FontWeight.w600, height: 1.3),
      titleMedium: base.titleMedium?.copyWith(fontWeight: FontWeight.w600),
      titleSmall: base.titleSmall?.copyWith(fontWeight: FontWeight.w600),
      bodyLarge: base.bodyLarge?.copyWith(height: 1.5),
      bodyMedium: base.bodyMedium?.copyWith(height: 1.5),
      bodySmall: base.bodySmall?.copyWith(height: 1.45, color: scheme.onSurfaceVariant),
      labelLarge: base.labelLarge?.copyWith(fontWeight: FontWeight.w600, letterSpacing: 0.1),
    );
  }

  /// Sanskrit and transliteration. Larger, looser, and left on the platform
  /// font — scripts with matras need the extra leading to stay legible, and
  /// Playfair has no Devanagari to offer.
  ///
  /// [scale] is the reading screen's font-size preference
  /// ([ReadingFontSize.scale]) — left at 1.0 everywhere else, which keeps
  /// every existing call site unchanged.
  static TextStyle verse(BuildContext context, {double? size, double scale = 1.0}) {
    final base = Theme.of(context).textTheme.titleMedium!;
    return base.copyWith(
      fontFamily: null,
      fontSize: (size ?? base.fontSize ?? 16) * scale,
      height: 1.9,
      fontWeight: FontWeight.w500,
    );
  }

  /// The romanised line under the Sanskrit. Playfair's italic, which is what
  /// makes it read as a pronunciation aid rather than as more body copy.
  static TextStyle transliteration(BuildContext context, {double scale = 1.0}) {
    return _serif(
      size: 16 * scale,
      height: 1.6,
      style: FontStyle.italic,
      letterSpacing: 0,
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
          fontFamily: null,
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
    return _serif(
      size: size,
      height: 1.0,
      letterSpacing: -1,
      color: Theme.of(context).colorScheme.onSurface,
    );
  }
}
