import 'dart:math' as math;
import 'dart:ui' show ImageFilter, lerpDouble;
import 'dart:ui' as ui show Gradient;

import 'package:flutter/material.dart';

import '../../core/constants/app_assets.dart';
import '../../core/constants/splash_config.dart';
import '../../core/theme/app_colors.dart';

/// The logo, arriving.
///
/// It is one picture, so it arrives as one thing. It comes into focus — a little
/// small and blurred at first, growing and sharpening into place — while it is
/// uncovered outward from the eye of the feather, like a light spreading; then a
/// single sheen crosses it. When the timeline ends the picture is exactly the
/// asset, with nothing left on it.
///
/// It keeps its own colours in both themes. It is artwork, not UI, and it was
/// drawn to sit on cream and on black alike.
class SplashLogo extends StatelessWidget {
  const SplashLogo({super.key, required this.progress, this.width = SplashConfig.logoWidth});

  /// The splash's 0→1 timeline.
  final Animation<double> progress;
  final double width;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: progress,
      // Built once; only what wraps it changes frame to frame.
      child: Image.asset(
        AppAssets.logo,
        fit: BoxFit.contain,
        filterQuality: FilterQuality.high,
        excludeFromSemantics: true,
      ),
      builder: (context, logo) {
        final t = progress.value;
        final focus = SplashConfig.focus.transform(t);

        // The same widgets in the same order on every frame, including the
        // last, where each has been wound back to doing nothing. Adding and
        // dropping them as they become idle would re-mount the picture.
        //
        // The blur goes over the reveal, not under it. A blur spills past the
        // edge of the picture and a mask only covers the picture, so ink blurred
        // first would leak round the edge of a reveal that had not reached it.
        return SizedBox.square(
          dimension: width,
          child: Transform.translate(
            offset: Offset(0, (1 - focus) * SplashConfig.logoRise),
            child: Transform.scale(
              scale: lerpDouble(SplashConfig.logoFromScale, 1, focus)!,
              child: _sheen(
                SplashConfig.glint.transform(t),
                child: _blurred(
                  (1 - focus) * SplashConfig.logoBlur,
                  child: _bloom(SplashConfig.bloom.transform(t), child: logo!),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _blurred(double sigma, {required Widget child}) {
    return ImageFiltered(
      imageFilter: ImageFilter.blur(sigmaX: sigma, sigmaY: sigma, tileMode: TileMode.decal),
      child: child,
    );
  }

  /// Shows the picture only inside a circle round the feather's eye. The circle
  /// grows until its solid part has reached the farthest ink, so at 1 nothing
  /// is hidden.
  Widget _bloom(double revealed, {required Widget child}) {
    // Where the circle ends, as a fraction of the logo's width; beyond it
    // nothing shows. The last stretch before it fades from clear to solid. A
    // radius of zero is not a gradient, and the stop below would be 0 / 0,
    // hence the floor.
    final outer = math.max(revealed * (SplashConfig.bloomReach + SplashConfig.bloomEdge), 0.001);
    final solid = math.max(outer - SplashConfig.bloomEdge, 0.0);

    return ShaderMask(
      blendMode: BlendMode.dstIn,
      shaderCallback: (bounds) => RadialGradient(
        center: FractionalOffset(SplashConfig.logoEye.dx, SplashConfig.logoEye.dy),
        radius: outer,
        colors: const [AppColors.black, AppColors.black, Colors.transparent],
        stops: [0, solid / outer, 1],
      ).createShader(bounds),
      child: child,
    );
  }

  /// A band of light across the picture, corner to corner. Laid over the
  /// picture's own pixels only — not the clear ground round them — so the logo
  /// catches it and the screen does not.
  Widget _sheen(double crossed, {required Widget child}) {
    final half = SplashConfig.glintWidth / 2;

    return ShaderMask(
      blendMode: BlendMode.srcATop,
      shaderCallback: (bounds) {
        // The band's middle runs from just before the bottom-left corner to
        // just past the top-right one, so at 0 and at 1 it is wholly off the
        // picture and draws nothing.
        final middle = lerpDouble(-half, 1 + half, crossed)!;
        final run = Offset(bounds.width, -bounds.height);

        // Clear *white*, not `Colors.transparent`: that is clear black, and the
        // band would grey as it faded out.
        final clear = AppColors.white.withValues(alpha: 0);
        final light = AppColors.white.withValues(alpha: SplashConfig.glintAlpha);

        return ui.Gradient.linear(
          bounds.bottomLeft + run * (middle - half),
          bounds.bottomLeft + run * (middle + half),
          [clear, light, clear],
          const [0, 0.5, 1],
        );
      },
      child: child,
    );
  }
}
