import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/constants/intro_config.dart';
import '../../core/theme/app_theme.dart';

/// The colours a welcome picture is drawn in, taken from the theme and from
/// nothing else, so both palettes hold: saffron and orange on warm paper, white
/// and grey on charcoal.
@immutable
class IntroPalette {
  const IntroPalette({
    required this.isLight,
    required this.accent,
    required this.onAccent,
    required this.glow,
    required this.ink,
    required this.muted,
    required this.soft,
    required this.paper,
    required this.line,
    required this.beadLight,
    required this.beadDark,
  });

  factory IntroPalette.of(BuildContext context) {
    final scheme = context.colors;
    final isLight = scheme.brightness == Brightness.light;
    return IntroPalette(
      isLight: isLight,
      accent: scheme.primary,
      onAccent: scheme.onPrimary,
      // Saffron is the light of the page; in the dark theme there is no hue to
      // spend and the light is white.
      glow: isLight ? scheme.tertiary : scheme.primary,
      ink: scheme.onSurface,
      muted: scheme.onSurfaceVariant,
      soft: scheme.primaryContainer,
      paper: scheme.surfaceContainerLowest,
      line: scheme.outline,
      beadLight: isLight ? scheme.inversePrimary : scheme.onSurface,
      beadDark: isLight ? scheme.primary : scheme.onSurfaceVariant,
    );
  }

  final bool isLight;

  /// Primary: orange, or white in the dark theme.
  final Color accent;
  final Color onAccent;

  /// The soft light behind a picture.
  final Color glow;

  final Color ink;
  final Color muted;

  /// A pale fill: saffron paper, or the lifted grey.
  final Color soft;

  /// A page, a card, a bubble.
  final Color paper;
  final Color line;

  /// The two ends of a bead's shading.
  final Color beadLight;
  final Color beadDark;

  @override
  bool operator ==(Object other) =>
      other is IntroPalette &&
      other.isLight == isLight &&
      other.accent == accent &&
      other.glow == glow &&
      other.ink == ink &&
      other.paper == paper;

  @override
  int get hashCode => Object.hash(isLight, accent, glow, ink, paper);
}

/// A welcome picture. [enter] is the page arriving (0 → 1, once) and [loop] is
/// its idle life (0 → 1, over and over, seamlessly): the painter redraws on
/// either, and reads them through [beat] and [turn].
///
/// The painter works in a square of side `size.width`, with the centre as
/// origin — `unit` is half of it — so no picture has a pixel size in it.
abstract class IntroScenePainter extends CustomPainter {
  IntroScenePainter({required this.enter, required this.loop, required this.palette})
    : super(repaint: Listenable.merge([enter, loop]));

  final Animation<double> enter;
  final Animation<double> loop;
  final IntroPalette palette;

  /// Progress between two moments of the entrance, in milliseconds.
  double beat(int fromMs, int toMs, [Curve curve = Curves.easeOutCubic]) =>
      IntroConfig.beat(enter.value, fromMs, toMs, curve);

  /// The loop's progress as a share of one turn, offset by [phase] and wrapped
  /// to 0–1 — what a piece that goes round once, or [times] times, is drawn at.
  double turn({double phase = 0, int times = 1}) {
    final value = (loop.value * times + phase) % 1.0;
    return value < 0 ? value + 1 : value;
  }

  /// A smooth 0 → 1 → 0 swing, once per [turn].
  double swing({double phase = 0, int times = 1}) =>
      0.5 - 0.5 * math.cos(turn(phase: phase, times: times) * math.pi * 2);

  /// Progress of the loop between two shares of it.
  double span(double from, double to, [Curve curve = Curves.easeInOutCubic]) {
    final value = loop.value;
    if (value <= from) return 0;
    if (value >= to) return 1;
    return curve.transform((value - from) / (to - from));
  }

  @override
  bool shouldRepaint(covariant IntroScenePainter oldDelegate) =>
      oldDelegate.palette != palette ||
      oldDelegate.enter != enter ||
      oldDelegate.loop != loop;
}

/// Lays a picture out as a square, with [overlays] — real widgets, such as the
/// feather or Sakha's face — placed over it by the picture's own size.
class IntroCanvas extends StatelessWidget {
  const IntroCanvas({
    super.key,
    required this.enter,
    required this.loop,
    required this.painter,
    this.overlays,
  });

  final Animation<double> enter;
  final Animation<double> loop;

  /// Builds the painter once the palette is known.
  final IntroScenePainter Function(
    Animation<double> enter,
    Animation<double> loop,
    IntroPalette palette,
  )
  painter;

  /// Widgets drawn over the picture, given its side.
  final List<Widget> Function(BuildContext context, double side)? overlays;

  @override
  Widget build(BuildContext context) {
    final palette = IntroPalette.of(context);
    return LayoutBuilder(
      builder: (context, constraints) {
        final side = math.min(constraints.maxWidth, constraints.maxHeight);
        return Center(
          child: SizedBox.square(
            dimension: side,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned.fill(
                  child: RepaintBoundary(
                    child: CustomPaint(painter: painter(enter, loop, palette)),
                  ),
                ),
                ...?overlays?.call(context, side),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Small drawing helpers the pictures share.
abstract final class IntroShapes {
  /// A teardrop petal pointing up from the origin, [length] long.
  static Path petal(double length, double width) {
    return Path()
      ..moveTo(0, 0)
      ..cubicTo(width, -length * 0.28, width * 0.7, -length * 0.82, 0, -length)
      ..cubicTo(-width * 0.7, -length * 0.82, -width, -length * 0.28, 0, 0)
      ..close();
  }

  /// A heart centred on [center], [size] across.
  static Path heart(Offset center, double size) {
    final s = size / 2;
    final x = center.dx;
    final y = center.dy;
    return Path()
      ..moveTo(x, y + s * 0.9)
      ..cubicTo(x - s * 1.5, y - s * 0.1, x - s * 0.7, y - s * 1.1, x, y - s * 0.4)
      ..cubicTo(x + s * 0.7, y - s * 1.1, x + s * 1.5, y - s * 0.1, x, y + s * 0.9)
      ..close();
  }

  /// A spring that overshoots and settles — what a thing popping into place is.
  static double pop(double t) => Curves.easeOutBack.transform(t.clamp(0.0, 1.0));

  /// [color] at [opacity] of its own alpha.
  static Color fade(Color color, double opacity) =>
      color.withValues(alpha: (color.a * opacity).clamp(0.0, 1.0));

  /// How far the fade of [fadeEnds] is drawn past the layer's edge. A pixel the
  /// layer only half covers would otherwise keep half of what it holds: a
  /// hairline standing at each end of the row.
  static const double _bleed = 2;

  /// Fades the left and right [share] of [rect] out of what the layer being
  /// closed holds, so a row sliding under it leaves and arrives softly instead
  /// of being cut off by a straight edge. Call it after the row is drawn and
  /// before `restore`; the layer is [rect]. [ink] is any opaque colour: only its
  /// alpha is used.
  static void fadeEnds(Canvas canvas, Rect rect, double share, Color ink) {
    final clear = fade(ink, 0);
    canvas.drawRect(
      rect.inflate(_bleed),
      Paint()
        ..blendMode = BlendMode.dstIn
        ..shader = LinearGradient(
          colors: [clear, ink, ink, clear],
          stops: [0, share, 1 - share, 1],
        ).createShader(rect),
    );
  }
}
