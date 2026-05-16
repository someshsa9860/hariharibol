import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTypography {
  static TextTheme get textTheme => _build(Colors.black87);
  static TextTheme get textThemeDark => _build(Colors.white);

  static TextTheme _build(Color base) => TextTheme(
        displayLarge: GoogleFonts.playfairDisplay(
            fontSize: 32, fontWeight: FontWeight.bold, color: base),
        displayMedium: GoogleFonts.playfairDisplay(
            fontSize: 28, fontWeight: FontWeight.bold, color: base),
        displaySmall: GoogleFonts.playfairDisplay(
            fontSize: 24, fontWeight: FontWeight.bold, color: base),
        headlineLarge: GoogleFonts.playfairDisplay(
            fontSize: 22, fontWeight: FontWeight.w600, color: base),
        headlineMedium: GoogleFonts.playfairDisplay(
            fontSize: 20, fontWeight: FontWeight.w600, color: base),
        headlineSmall: GoogleFonts.playfairDisplay(
            fontSize: 18, fontWeight: FontWeight.w600, color: base),
        titleLarge: GoogleFonts.inter(
            fontSize: 16, fontWeight: FontWeight.w500, color: base),
        titleMedium: GoogleFonts.inter(
            fontSize: 14, fontWeight: FontWeight.w500, color: base),
        titleSmall: GoogleFonts.inter(
            fontSize: 12, fontWeight: FontWeight.w500, color: base),
        bodyLarge: GoogleFonts.inter(fontSize: 16, color: base),
        bodyMedium: GoogleFonts.inter(fontSize: 14, color: base),
        bodySmall: GoogleFonts.inter(fontSize: 12, color: base),
        labelLarge: GoogleFonts.inter(
            fontSize: 14, fontWeight: FontWeight.w500, color: base),
        labelMedium: GoogleFonts.inter(
            fontSize: 12, fontWeight: FontWeight.w500, color: base),
        labelSmall: GoogleFonts.inter(
            fontSize: 11, fontWeight: FontWeight.w500, color: base),
      );
}
