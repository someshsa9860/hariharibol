import 'package:flutter/material.dart';
import 'package:liquid_glass_renderer/liquid_glass_renderer.dart';

import '../../core/theme/app_theme.dart';

/// A liquid-glass panel: whatever sits behind it is refracted and blurred
/// through a real lens shape, the way iOS 26 renders its own chrome — this
/// is `liquid_glass_renderer`'s Impeller shader doing the work, not an
/// imitation built from a blurred, tinted box.
///
/// It renders the same way on Android and iOS, since the shader is Flutter's
/// own rather than a platform API — there is no "real glass on the newest
/// iPhones, something else everywhere else" split to maintain. Where a device
/// truly cannot run it, the package itself falls back to a plain blurred
/// panel; nothing here has to special-case that.
///
/// It only looks like anything if content actually passes behind it. For a
/// floating pill that means sitting in a Stack over the scroll view.
class GlassSurface extends StatelessWidget {
  const GlassSurface({
    super.key,
    required this.child,
    this.radius = 0,
    this.blur = 10,
    this.opacity,
    this.border,
    this.shadows,
  });

  final Widget child;

  /// Uniform corner radius. Half the shorter side saturates the shape to a
  /// stadium or a circle on its own — there is no separate "pill" shape.
  final double radius;

  /// Frost intensity — the glass's own setting, not a `BackdropFilter` sigma.
  final double blur;

  /// How much of the surface colour tints the glass. Defaults to a little
  /// heavier in dark mode, where a thin tint over black still reads as clear.
  final double? opacity;

  /// Drawn as part of the shape itself, not a separate decoration.
  final BorderSide? border;

  /// Drawn behind the panel, outside the shape — a shadow the glass cast on
  /// itself would just be refracted away.
  final List<BoxShadow>? shadows;

  @override
  Widget build(BuildContext context) {
    final isDark = context.theme.brightness == Brightness.dark;
    final tint = opacity ?? (isDark ? 0.34 : 0.42);

    final panel = LiquidGlass.withOwnLayer(
      shape: LiquidRoundedSuperellipse(
        borderRadius: radius,
        side: border ?? BorderSide.none,
      ),
      settings: LiquidGlassSettings(
        thickness: 22,
        blur: blur,
        glassColor: context.colors.surface.withValues(alpha: tint),
        lightIntensity: isDark ? 0.35 : 0.6,
        saturation: 1.4,
      ),
      child: child,
    );

    if (shadows == null) return panel;

    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        boxShadow: shadows,
      ),
      child: panel,
    );
  }
}
