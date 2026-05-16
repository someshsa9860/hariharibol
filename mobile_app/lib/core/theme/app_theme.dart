import 'package:flutter/material.dart';
import 'app_colors.dart';
import 'app_typography.dart';

class AppTheme {
  static ThemeData get lightTheme => ThemeData(
        brightness: Brightness.light,
        primaryColor: AppColors.saffron,
        scaffoldBackgroundColor: AppColors.bgLight,
        colorScheme: const ColorScheme.light(
          primary: AppColors.saffron,
          secondary: AppColors.gold,
          surface: Colors.white,
          // ignore: deprecated_member_use
          background: AppColors.bgLight,
          error: AppColors.error,
          onPrimary: Colors.white,
          onSecondary: Colors.white,
          onSurface: AppColors.textDark,
          // ignore: deprecated_member_use
          onBackground: AppColors.textDark,
        ),
        textTheme: AppTypography.textTheme,
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: AppColors.textDark,
          elevation: 0.5,
          centerTitle: true,
        ),
        cardTheme: CardTheme(
          color: AppColors.sandstone.withOpacity(0.18),
          elevation: 0,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.saffron,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24)),
            padding:
                const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
            textStyle: const TextStyle(
                fontWeight: FontWeight.w600, fontSize: 16),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.saffron,
            side: const BorderSide(color: AppColors.saffron),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24)),
            padding:
                const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          ),
        ),
        switchTheme: SwitchThemeData(
          thumbColor: WidgetStateProperty.resolveWith((s) =>
              s.contains(WidgetState.selected) ? AppColors.saffron : null),
          trackColor: WidgetStateProperty.resolveWith((s) => s
                  .contains(WidgetState.selected)
              ? AppColors.saffron.withOpacity(0.45)
              : null),
        ),
        inputDecorationTheme: InputDecorationTheme(
          border:
              OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
        dividerTheme:
            const DividerThemeData(color: Color(0xFFEEE8E0), thickness: 1),
      );

  static ThemeData get darkTheme => ThemeData(
        brightness: Brightness.dark,
        primaryColor: AppColors.saffronLight,
        scaffoldBackgroundColor: AppColors.bgDark,
        colorScheme: ColorScheme.dark(
          primary: AppColors.saffronLight,
          secondary: AppColors.gold,
          surface: const Color(0xFF1E1610),
          // ignore: deprecated_member_use
          background: AppColors.bgDark,
          error: AppColors.error,
          onPrimary: Colors.white,
          onSecondary: Colors.white,
          onSurface: Colors.white,
          // ignore: deprecated_member_use
          onBackground: Colors.white,
        ),
        textTheme: AppTypography.textThemeDark,
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF1E1610),
          foregroundColor: Colors.white,
          elevation: 0,
          centerTitle: true,
        ),
        cardTheme: CardTheme(
          color: Colors.white.withOpacity(0.08),
          elevation: 0,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.saffronLight,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24)),
            padding:
                const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
            textStyle: const TextStyle(
                fontWeight: FontWeight.w600, fontSize: 16),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.saffronLight,
            side: const BorderSide(color: AppColors.saffronLight),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24)),
            padding:
                const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          ),
        ),
        switchTheme: SwitchThemeData(
          thumbColor: WidgetStateProperty.resolveWith((s) =>
              s.contains(WidgetState.selected)
                  ? AppColors.saffronLight
                  : null),
          trackColor: WidgetStateProperty.resolveWith((s) => s
                  .contains(WidgetState.selected)
              ? AppColors.saffronLight.withOpacity(0.45)
              : null),
        ),
        inputDecorationTheme: InputDecorationTheme(
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Colors.white30),
          ),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          filled: true,
          fillColor: Colors.white.withOpacity(0.06),
        ),
        dividerTheme:
            const DividerThemeData(color: Colors.white12, thickness: 1),
      );
}
