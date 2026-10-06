// The palette rule, enforced.
//
// The design is three colours in light mode — dark orange, saffron, white —
// and black and white in dark mode. That is easy to state and easy to break:
// one `ColorScheme.fromSeed`, one stray `Colors.red`, one Material default
// left unset, and a fourth hue is on screen.
//
// So rather than trusting a review, every role in both schemes is checked
// here. Light must be the orange hue or a pure neutral; dark must be neutral
// throughout. A regression fails the build instead of shipping.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/theme/app_colors.dart';
import 'package:hariharibol/core/theme/app_theme.dart';

/// Every role, by name so a failure says which one drifted.
Map<String, Color> roles(ColorScheme s) => {
      'primary': s.primary,
      'onPrimary': s.onPrimary,
      'primaryContainer': s.primaryContainer,
      'onPrimaryContainer': s.onPrimaryContainer,
      'secondary': s.secondary,
      'onSecondary': s.onSecondary,
      'secondaryContainer': s.secondaryContainer,
      'onSecondaryContainer': s.onSecondaryContainer,
      'tertiary': s.tertiary,
      'onTertiary': s.onTertiary,
      'tertiaryContainer': s.tertiaryContainer,
      'onTertiaryContainer': s.onTertiaryContainer,
      'error': s.error,
      'onError': s.onError,
      'errorContainer': s.errorContainer,
      'onErrorContainer': s.onErrorContainer,
      'surface': s.surface,
      'onSurface': s.onSurface,
      'onSurfaceVariant': s.onSurfaceVariant,
      'surfaceContainerLowest': s.surfaceContainerLowest,
      'surfaceContainerLow': s.surfaceContainerLow,
      'surfaceContainer': s.surfaceContainer,
      'surfaceContainerHigh': s.surfaceContainerHigh,
      'surfaceContainerHighest': s.surfaceContainerHighest,
      'outline': s.outline,
      'outlineVariant': s.outlineVariant,
      'inverseSurface': s.inverseSurface,
      'onInverseSurface': s.onInverseSurface,
      'inversePrimary': s.inversePrimary,
      'surfaceTint': s.surfaceTint,
    };

/// Grey, black and white have no hue to be wrong about.
bool isNeutral(Color c) => HSVColor.fromColor(c).saturation < 0.02;

/// Orange through saffron. Nothing sits between saffron and yellow, and
/// nothing crosses into red.
bool isOrangeFamily(Color c) {
  final hue = HSVColor.fromColor(c).hue;
  return hue >= 14 && hue <= 40;
}

void main() {
  test('light mode is orange, saffron and white — nothing else', () {
    final wrong = <String>[];
    roles(AppTheme.light.colorScheme).forEach((name, colour) {
      if (!isNeutral(colour) && !isOrangeFamily(colour)) {
        wrong.add('$name is ${HSVColor.fromColor(colour).hue.toStringAsFixed(0)}°');
      }
    });

    expect(wrong, isEmpty, reason: 'off-palette hues: ${wrong.join(', ')}');
  });

  test('dark mode is black and white — no hue at all', () {
    final wrong = <String>[];
    roles(AppTheme.dark.colorScheme).forEach((name, colour) {
      if (!isNeutral(colour)) {
        wrong.add('$name is ${HSVColor.fromColor(colour).hue.toStringAsFixed(0)}°');
      }
    });

    expect(wrong, isEmpty, reason: 'coloured roles in dark mode: ${wrong.join(', ')}');
  });

  test('the semantic colours obey the same rule', () {
    for (final c in [
      AppSemanticColors.light.success,
      AppSemanticColors.light.warning,
      AppSemanticColors.light.info,
    ]) {
      expect(isOrangeFamily(c) || isNeutral(c), isTrue);
    }

    for (final c in [
      AppSemanticColors.dark.success,
      AppSemanticColors.dark.warning,
      AppSemanticColors.dark.info,
    ]) {
      expect(isNeutral(c), isTrue);
    }
  });

  test('body text clears 4.5:1 on the surface it sits on', () {
    double luminance(Color c) => c.computeLuminance();
    double ratio(Color a, Color b) {
      final high = luminance(a) > luminance(b) ? luminance(a) : luminance(b);
      final low = luminance(a) > luminance(b) ? luminance(b) : luminance(a);
      return (high + 0.05) / (low + 0.05);
    }

    for (final scheme in [AppTheme.light.colorScheme, AppTheme.dark.colorScheme]) {
      expect(ratio(scheme.onSurface, scheme.surface), greaterThan(4.5));
      // The muted tone is the one that drifts when a palette is retuned, and
      // it carries dates, citations and translator names.
      expect(ratio(scheme.onSurfaceVariant, scheme.surface), greaterThan(4.5));
      expect(ratio(scheme.onPrimary, scheme.primary), greaterThan(4.5));
    }

    // Saffron is a fill, never a text colour — this is why.
    expect(ratio(AppColors.saffron, AppColors.white), lessThan(3));
  });
}
