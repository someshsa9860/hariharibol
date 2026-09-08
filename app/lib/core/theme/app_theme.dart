import 'package:flutter/material.dart';

import 'app_colors.dart';
import 'app_spacing.dart';
import 'app_typography.dart';

/// The two themes, built once from the tokens in this folder.
///
/// Widgets never build their own decoration for something the theme already
/// covers — if a card, button or input looks wrong everywhere, it is fixed
/// here, not in the view.
abstract final class AppTheme {
  static ThemeData get light => _build(Brightness.light);
  static ThemeData get dark => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final isLight = brightness == Brightness.light;
    final scheme = _scheme(brightness);
    final textTheme = AppTypography.textTheme(scheme);

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      textTheme: textTheme,
      fontFamily: AppTypography.fontFamily,
      scaffoldBackgroundColor: scheme.surface,
      extensions: [isLight ? AppSemanticColors.light : AppSemanticColors.dark],

      appBarTheme: AppBarTheme(
        backgroundColor: scheme.surface,
        surfaceTintColor: Colors.transparent,
        foregroundColor: scheme.onSurface,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        centerTitle: false,
        titleTextStyle: textTheme.titleLarge,
      ),

      // Cards are a lighter plane than the page with a hairline round them,
      // not a shadow. Elevation on a warm ground reads as dirt.
      cardTheme: CardThemeData(
        color: scheme.surfaceContainerLowest,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.lgAll,
          side: BorderSide(color: scheme.outlineVariant),
        ),
      ),

      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(AppSizes.buttonHeight),
          shape: const RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
          textStyle: textTheme.labelLarge,
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(AppSizes.buttonHeight),
          shape: const RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
          side: BorderSide(color: scheme.outlineVariant),
          textStyle: textTheme.labelLarge,
        ),
      ),

      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(textStyle: textTheme.labelLarge),
      ),

      listTileTheme: const ListTileThemeData(
        contentPadding: EdgeInsets.symmetric(horizontal: AppSpacing.lg),
        shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: scheme.surfaceContainerHighest,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md,
        ),
        border: const OutlineInputBorder(
          borderRadius: AppRadius.mdAll,
          borderSide: BorderSide.none,
        ),
        enabledBorder: const OutlineInputBorder(
          borderRadius: AppRadius.mdAll,
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: AppRadius.mdAll,
          borderSide: BorderSide(color: scheme.primary, width: 1.5),
        ),
      ),

      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: scheme.surface,
        surfaceTintColor: Colors.transparent,
        indicatorColor: scheme.primaryContainer,
        elevation: 3,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        labelTextStyle: WidgetStatePropertyAll(textTheme.labelMedium),
      ),

      chipTheme: ChipThemeData(
        backgroundColor: scheme.surfaceContainerLowest,
        selectedColor: scheme.onSurface,
        side: BorderSide(color: scheme.outlineVariant),
        shape: const StadiumBorder(),
        showCheckmark: false,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
        labelStyle: textTheme.labelLarge,
      ),

      dividerTheme: DividerThemeData(
        color: scheme.outlineVariant,
        space: 1,
        thickness: 1,
      ),

      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        insetPadding: const EdgeInsets.all(AppSpacing.lg),
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
        contentTextStyle: textTheme.bodyMedium?.copyWith(color: scheme.onInverseSurface),
      ),

      dialogTheme: const DialogThemeData(
        shape: RoundedRectangleBorder(borderRadius: AppRadius.lgAll),
      ),

      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: scheme.primary,
        linearTrackColor: scheme.surfaceContainerHighest,
      ),

      // Solid brand, not the pale container Material 3 defaults to. It is the
      // one saturated thing on a page of paper and it is meant to be found.
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: scheme.primary,
        foregroundColor: scheme.onPrimary,
        elevation: 2,
        focusElevation: 2,
        hoverElevation: 3,
        highlightElevation: 4,
        shape: const CircleBorder(),
      ),
    );
  }

  /// The two schemes, written out rather than generated.
  ///
  /// `ColorScheme.fromSeed` cannot produce this palette: it always derives a
  /// tertiary by rotating the hue, which is exactly the fourth colour the
  /// design does not have. So every role is stated here, and the only colours
  /// that can reach a widget are the ones in [AppColors].
  static ColorScheme _scheme(Brightness brightness) {
    if (brightness == Brightness.light) {
      return const ColorScheme(
        brightness: Brightness.light,

        // Orange is the only colour an action is ever drawn in.
        primary: AppColors.orange,
        onPrimary: AppColors.white,
        primaryContainer: AppColors.saffronPale,
        onPrimaryContainer: AppColors.orangeDeep,

        secondary: AppColors.orangeDark,
        onSecondary: AppColors.white,
        secondaryContainer: AppColors.saffronPale,
        onSecondaryContainer: AppColors.orangeDeep,

        // Saffron never carries text: it is about 2:1 on white. Anything on it
        // is ink.
        tertiary: AppColors.saffron,
        onTertiary: AppColors.ink,
        tertiaryContainer: AppColors.paperTint,
        onTertiaryContainer: AppColors.orangeDeep,

        // There is no red to spend, so destructive is the deepest orange. It
        // reads as "heavier", not as "danger" — which is why every destructive
        // action in the app also carries an icon and a confirmation.
        error: AppColors.orangeDeep,
        onError: AppColors.white,
        errorContainer: AppColors.saffronPale,
        onErrorContainer: AppColors.orangeDeep,

        surface: AppColors.paper,
        onSurface: AppColors.ink,
        onSurfaceVariant: AppColors.inkMuted,
        surfaceContainerLowest: AppColors.white,
        surfaceContainerLow: AppColors.white,
        surfaceContainer: AppColors.paperTint,
        surfaceContainerHigh: AppColors.paperTint,
        surfaceContainerHighest: AppColors.paperTint,

        outline: AppColors.outline,
        outlineVariant: AppColors.hairline,
        shadow: AppColors.ink,
        scrim: AppColors.ink,
        inverseSurface: AppColors.ink,
        onInverseSurface: AppColors.paper,
        inversePrimary: AppColors.saffronLight,
        surfaceTint: AppColors.orange,
      );
    }

    return const ColorScheme(
      brightness: Brightness.dark,

      // White is the accent. There is no orange on black anywhere.
      primary: AppColors.white,
      onPrimary: AppColors.black,
      primaryContainer: AppColors.hairlineDark,
      onPrimaryContainer: AppColors.white,

      secondary: AppColors.inkMutedDark,
      onSecondary: AppColors.black,
      secondaryContainer: AppColors.paperTintDark,
      onSecondaryContainer: AppColors.white,

      tertiary: AppColors.inkSubtleDark,
      onTertiary: AppColors.black,
      tertiaryContainer: AppColors.paperTintDark,
      onTertiaryContainer: AppColors.white,

      error: AppColors.white,
      onError: AppColors.black,
      errorContainer: AppColors.hairlineDark,
      onErrorContainer: AppColors.white,

      surface: AppColors.paperDark,
      onSurface: AppColors.inkDark,
      onSurfaceVariant: AppColors.inkMutedDark,
      surfaceContainerLowest: AppColors.cardDark,
      surfaceContainerLow: AppColors.cardDark,
      surfaceContainer: AppColors.paperTintDark,
      surfaceContainerHigh: AppColors.paperTintDark,
      surfaceContainerHighest: AppColors.hairlineDark,

      outline: AppColors.outlineDark,
      outlineVariant: AppColors.hairlineDark,
      shadow: AppColors.black,
      scrim: AppColors.black,
      inverseSurface: AppColors.white,
      onInverseSurface: AppColors.black,
      inversePrimary: AppColors.black,
      surfaceTint: AppColors.white,
    );
  }
}

/// Shorthands so views read `context.colors.primary` instead of a
/// `Theme.of(context).colorScheme` chain on every line.
extension AppThemeContext on BuildContext {
  ThemeData get theme => Theme.of(this);
  ColorScheme get colors => Theme.of(this).colorScheme;
  TextTheme get texts => Theme.of(this).textTheme;
  AppSemanticColors get semanticColors => Theme.of(this).extension<AppSemanticColors>()!;
}
