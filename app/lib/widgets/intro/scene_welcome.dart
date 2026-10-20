import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../core/constants/intro_config.dart';
import '../common/peacock_feather_icon.dart';
import 'intro_scene.dart';

/// The first page: the app's mark rising out of an opening lotus, with a ring of
/// light turning behind it and ripples spreading from it — the way a sound does,
/// because it is a chanting app.
class WelcomeScene extends StatelessWidget {
  const WelcomeScene({super.key, required this.enter, required this.loop});

  final Animation<double> enter;
  final Animation<double> loop;

  @override
  Widget build(BuildContext context) {
    return IntroCanvas(
      enter: enter,
      loop: loop,
      painter: _WelcomePainter.new,
      overlays: (context, side) => [
        Positioned.fill(
          child: Center(
            child: AnimatedBuilder(
              animation: Listenable.merge([enter, loop]),
              builder: (context, child) {
                final arrive = IntroConfig.beat(enter.value, 350, 1250, Curves.linear);
                final bob = math.sin(loop.value * math.pi * 2) * side * 0.012;
                return Opacity(
                  opacity: Curves.easeOut.transform(arrive.clamp(0.0, 1.0)),
                  child: Transform.translate(
                    offset: Offset(0, bob),
                    child: Transform.scale(
                      scale: 0.5 + 0.5 * IntroShapes.pop(arrive),
                      child: child,
                    ),
                  ),
                );
              },
              child: PeacockFeatherIcon(size: side * IntroConfig.featherShare),
            ),
          ),
        ),
      ],
    );
  }
}

class _WelcomePainter extends IntroScenePainter {
  _WelcomePainter(Animation<double> enter, Animation<double> loop, IntroPalette palette)
    : super(enter: enter, loop: loop, palette: palette);

  @override
  void paint(Canvas canvas, Size size) {
    final r = size.width / 2;
    canvas.translate(r, r);

    _light(canvas, r);
    _rays(canvas, r);
    _ripples(canvas, r);
    _lotus(canvas, r);
  }

  /// The warm disc the mark sits in.
  void _light(Canvas canvas, double r) {
    final t = beat(0, 1000, Curves.easeOut);
    final strength = (palette.isLight ? 0.42 : 0.16) * t;
    final radius = r * (0.62 + 0.38 * t) * (1 + 0.025 * swing());
    canvas.drawCircle(
      Offset.zero,
      radius,
      Paint()
        ..shader = ui.Gradient.radial(Offset.zero, radius, [
          IntroShapes.fade(palette.glow, strength),
          IntroShapes.fade(palette.glow, 0),
        ]),
    );
  }

  /// A ring of rays that draws itself round, then turns for good. They alternate
  /// long and short, so turning by two rays looks exactly like not having
  /// turned — which is what lets the loop close without a seam.
  void _rays(Canvas canvas, double r) {
    const count = IntroConfig.rayCount;
    final turning = turn() * 4 * math.pi / count;
    final stroke = Paint()
      ..strokeCap = StrokeCap.round
      ..strokeWidth = r * 0.02;

    for (var i = 0; i < count; i++) {
      final long = i.isEven;
      final t = beat(150 + i * 16, 850 + i * 16);
      if (t <= 0) continue;

      final angle = i / count * math.pi * 2 - math.pi / 2 + turning;
      final from = r * 0.68;
      final length = r * (long ? 0.28 : 0.13) * t;
      final direction = Offset(math.cos(angle), math.sin(angle));

      stroke.color = IntroShapes.fade(
        long ? palette.glow : palette.muted,
        (long ? 0.95 : 0.5) * t * (palette.isLight ? 1 : 0.7),
      );
      canvas.drawLine(direction * from, direction * (from + length), stroke);
    }
  }

  /// Rings leaving the mark, each a third of a turn behind the one before.
  void _ripples(Canvas canvas, double r) {
    final arrive = beat(800, 1500, Curves.easeOut);
    if (arrive <= 0) return;

    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = r * 0.012;

    for (var k = 0; k < IntroConfig.rippleCount; k++) {
      final phase = turn(phase: k / IntroConfig.rippleCount);
      final radius = ui.lerpDouble(r * 0.4, r * 0.98, Curves.easeOutCubic.transform(phase))!;
      final fade = math.pow(1 - phase, 1.6).toDouble();
      stroke.color = IntroShapes.fade(palette.accent, 0.34 * fade * arrive);
      canvas.drawCircle(Offset.zero, radius, stroke);
    }
  }

  /// Two rings of petals that open outward, one a beat behind the other, and
  /// breathe afterwards.
  void _lotus(Canvas canvas, double r) {
    const count = IntroConfig.petalCount;
    final breathe = 1 + 0.03 * swing();

    for (var ring = 0; ring < 2; ring++) {
      final open = IntroShapes.pop(beat(250 + ring * 220, 1250 + ring * 220));
      if (open <= 0) continue;

      final inner = ring == 1;
      final length = r * (inner ? 0.5 : 0.62) * open * breathe;
      final width = r * (inner ? 0.17 : 0.2) * open;
      final fill = Paint()
        ..color = inner
            ? IntroShapes.fade(palette.glow, palette.isLight ? 0.4 : 0.22)
            : IntroShapes.fade(palette.soft, 0.96);
      final edge = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = IntroShapes.fade(palette.line, 0.55);

      for (var i = 0; i < count; i++) {
        canvas.save();
        canvas.rotate((i + (inner ? 0.5 : 0)) / count * math.pi * 2);
        final path = IntroShapes.petal(length, width);
        canvas.drawPath(path, fill);
        canvas.drawPath(path, edge);
        canvas.restore();
      }
    }
  }
}
