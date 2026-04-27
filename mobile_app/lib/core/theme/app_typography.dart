import 'package:flutter/material.dart';

class AppTypography {
  static const String fontFamily = 'Roboto'; // Or a devotional font

  static TextTheme textTheme = const TextTheme(
    displayLarge: TextStyle(
      fontSize: 32,
      fontWeight: FontWeight.bold,
      fontFamily: fontFamily,
    ),
    displayMedium: TextStyle(
      fontSize: 28,
      fontWeight: FontWeight.bold,
      fontFamily: fontFamily,
    ),
    displaySmall: TextStyle(
      fontSize: 24,
      fontWeight: FontWeight.bold,
      fontFamily: fontFamily,
    ),
    headlineLarge: TextStyle(
      fontSize: 22,
      fontWeight: FontWeight.w600,
      fontFamily: fontFamily,
    ),
    headlineMedium: TextStyle(
      fontSize: 20,
      fontWeight: FontWeight.w600,
      fontFamily: fontFamily,
    ),
    headlineSmall: TextStyle(
      fontSize: 18,
      fontWeight: FontWeight.w600,
      fontFamily: fontFamily,
    ),
    titleLarge: TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.w500,
      fontFamily: fontFamily,
    ),
    titleMedium: TextStyle(
      fontSize: 14,
      fontWeight: FontWeight.w500,
      fontFamily: fontFamily,
    ),
    titleSmall: TextStyle(
      fontSize: 12,
      fontWeight: FontWeight.w500,
      fontFamily: fontFamily,
    ),
    bodyLarge: TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.normal,
      fontFamily: fontFamily,
    ),
    bodyMedium: TextStyle(
      fontSize: 14,
      fontWeight: FontWeight.normal,
      fontFamily: fontFamily,
    ),
    bodySmall: TextStyle(
      fontSize: 12,
      fontWeight: FontWeight.normal,
      fontFamily: fontFamily,
    ),
    labelLarge: TextStyle(
      fontSize: 14,
      fontWeight: FontWeight.w500,
      fontFamily: fontFamily,
    ),
    labelMedium: TextStyle(
      fontSize: 12,
      fontWeight: FontWeight.w500,
      fontFamily: fontFamily,
    ),
    labelSmall: TextStyle(
      fontSize: 11,
      fontWeight: FontWeight.w500,
      fontFamily: fontFamily,
    ),
  );

  static TextTheme textThemeDark = textTheme; // Same for now, can customize
}