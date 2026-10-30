// The reading page's looks, checked against WCAG 2.x. Each pairing below is a
// text or control colour on the surface it sits on. The bars are the ones in
// the reading-comfort plan: body text 7:1, secondary text and accents 4.5:1.
// No look may use pure white or pure black for its page or its text.

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/core/theme/reading_themes.dart';

double _luminance(Color color) {
  double channel(double value) =>
      value <= 0.03928 ? value / 12.92 : math.pow((value + 0.055) / 1.055, 2.4).toDouble();
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

double _contrast(Color a, Color b) {
  final lighter = math.max(_luminance(a), _luminance(b));
  final darker = math.min(_luminance(a), _luminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

void main() {
  final looks = {
    ReadingLook.warmPaper: ReadingPalette.warmPaper,
    ReadingLook.sepia: ReadingPalette.sepia,
    ReadingLook.mist: ReadingPalette.mist,
    ReadingLook.dusk: ReadingPalette.dusk,
    ReadingLook.night: ReadingPalette.night,
  };

  test('matchApp has no palette and keeps the app theme', () {
    expect(ReadingLook.matchApp.palette, isNull);
    final base = AppTheme.light;
    expect(readingLookTheme(ReadingLook.matchApp, base), same(base));
  });

  for (final entry in looks.entries) {
    final look = entry.key;
    final p = entry.value;

    test('${look.name}: body text reaches 7:1 on the page and the card', () {
      expect(_contrast(p.text, p.page), greaterThanOrEqualTo(7.0), reason: 'text on page');
      expect(_contrast(p.text, p.card), greaterThanOrEqualTo(7.0), reason: 'text on card');
    });

    test('${look.name}: secondary text and the accent reach 4.5:1', () {
      expect(_contrast(p.muted, p.page), greaterThanOrEqualTo(4.5), reason: 'muted on page');
      expect(_contrast(p.muted, p.card), greaterThanOrEqualTo(4.5), reason: 'muted on card');
      expect(_contrast(p.accent, p.page), greaterThanOrEqualTo(4.5), reason: 'accent on page');
      expect(_contrast(p.card, p.accent), greaterThanOrEqualTo(4.5), reason: 'label on accent chip');
    });

    test('${look.name}: no pure white or pure black on the page or in the text', () {
      final pure = {const Color(0xFFFFFFFF), const Color(0xFF000000)};
      expect(pure.contains(p.page), isFalse);
      expect(pure.contains(p.card), isFalse);
      expect(pure.contains(p.text), isFalse);
    });

    test('${look.name}: the theme takes the page colours and brightness', () {
      final themed = readingLookTheme(look, AppTheme.light);
      expect(themed.scaffoldBackgroundColor, p.page);
      expect(themed.colorScheme.surface, p.page);
      expect(themed.colorScheme.onSurface, p.text);
      expect(themed.colorScheme.primary, p.accent);
      expect(
        themed.colorScheme.brightness,
        p.isDark ? Brightness.dark : Brightness.light,
      );
    });
  }
}
