import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/constants/splash_config.dart';
import '../../core/theme/app_theme.dart';

/// The ground the launch mark arrives on: two soft lights that breathe and
/// drift, and rings that spread out from the eye of the feather like a sound.
///
/// Both lights and the rings take their colour from the scheme — saffron and
/// orange in light mode, two steps of white in dark — so the screen is the
/// app's own palette and not a one-off. Nothing here carries meaning, so it is
/// hidden from screen readers.
class SplashBackdrop extends StatelessWidget {
  const SplashBackdrop({super.key, required this.progress, required this.centre});

  /// The splash's 0→1 timeline.
  final Animation<double> progress;

  /// Where the lights and rings are centred, in logical pixels from the top
  /// left of the screen — the eye of the feather, so the light seems to come
  /// from it.
  final Offset centre;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final isDark = colors.brightness == Brightness.dark;

    return ExcludeSemantics(
      child: CustomPaint(
        size: Size.infinite,
        painter: _BackdropPainter(
          progress: progress,
          centre: centre,
          glow: colors.tertiary,
          drift: colors.primary,
          ring: colors.primary,
          glowAlpha: isDark ? SplashConfig.glowAlphaDark : SplashConfig.glowAlpha,
          driftAlpha: isDark ? SplashConfig.driftAlphaDark : SplashConfig.driftAlpha,
        ),
      ),
    );
  }
}

class _BackdropPainter extends CustomPainter {
  _BackdropPainter({
    required this.progress,
    required this.centre,
    required this.glow,
    required this.drift,
    required this.ring,
    required this.glowAlpha,
    required this.driftAlpha,
  }) : super(repaint: progress);

  final Animation<double> progress;
  final Offset centre;
  final Color glow;
  final Color drift;
  final Color ring;
  final double glowAlpha;
  final double driftAlpha;

  @override
  void paint(Canvas canvas, Size size) {
    final t = progress.value;
    final side = math.min(size.width, size.height);
    final lit = SplashConfig.glow.transform(t);

    // One full breath over the timeline, so it is at rest where it began.
    final swell = 1 + math.sin(t * 2 * math.pi) * SplashConfig.breathe;
    _light(canvas, centre, side * SplashConfig.glowRadius * swell, glow, glowAlpha * lit);

    final angle = t * 2 * math.pi * SplashConfig.driftTurns;
    final orbit = Offset(math.cos(angle), math.sin(angle)) * side * SplashConfig.driftOrbit;
    _light(canvas, centre + orbit, side * SplashConfig.driftRadius, drift, driftAlpha * lit);

    _ripples(canvas, centre, side, t * SplashConfig.totalMs);
  }

  /// A disc of colour that fades to nothing at its edge.
  void _light(Canvas canvas, Offset at, double radius, Color color, double alpha) {
    if (alpha <= 0) return;
    final paint = Paint()
      ..shader = RadialGradient(
        colors: [color.withValues(alpha: alpha), color.withValues(alpha: 0)],
      ).createShader(Rect.fromCircle(center: at, radius: radius));
    canvas.drawCircle(at, radius, paint);
  }

  void _ripples(Canvas canvas, Offset at, double side, double ms) {
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = SplashConfig.rippleStroke
      ..isAntiAlias = true;

    for (var i = 0; i < SplashConfig.rippleCount; i++) {
      final born = SplashConfig.rippleBeginMs + i * SplashConfig.rippleStaggerMs;
      final age = (ms - born) / SplashConfig.rippleLifeMs;
      if (age <= 0 || age >= 1) continue;

      final spread = Curves.easeOutCubic.transform(age);
      final radius = side *
          (SplashConfig.rippleFromRadius +
              (SplashConfig.rippleToRadius - SplashConfig.rippleFromRadius) * spread);

      // Fades faster than it grows, so the outer edge of a ring is already
      // nearly gone by the time it gets there.
      paint.color = ring.withValues(alpha: SplashConfig.rippleAlpha * math.pow(1 - age, 1.6));
      canvas.drawCircle(at, radius, paint);
    }
  }

  @override
  bool shouldRepaint(_BackdropPainter old) =>
      old.glow != glow ||
      old.drift != drift ||
      old.ring != ring ||
      old.centre != centre ||
      old.glowAlpha != glowAlpha ||
      old.driftAlpha != driftAlpha;
}
