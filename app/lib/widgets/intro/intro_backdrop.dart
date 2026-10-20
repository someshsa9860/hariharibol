import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../core/constants/intro_config.dart';
import 'intro_scene.dart';

/// The ground the welcome pages stand on: two lights that drift sideways as the
/// pages are turned, and a few motes rising slowly through them.
///
/// It is one painter over the whole pager rather than a part of each page, so
/// the lights can move at their own pace against the pages — which is most of
/// what makes the turn feel deep.
class IntroBackdrop extends StatelessWidget {
  const IntroBackdrop({super.key, required this.position, required this.clock});

  /// The pager's position, in pages (1.5 is halfway from the second to the
  /// third).
  final ValueListenable<double> position;

  /// 0 → 1 over [IntroConfig.moteMs], over and over.
  final Animation<double> clock;

  @override
  Widget build(BuildContext context) {
    final palette = IntroPalette.of(context);
    return RepaintBoundary(
      child: CustomPaint(
        painter: _BackdropPainter(position: position, clock: clock, palette: palette),
        size: Size.infinite,
      ),
    );
  }
}

class _BackdropPainter extends CustomPainter {
  _BackdropPainter({required this.position, required this.clock, required this.palette})
    : super(repaint: Listenable.merge([position, clock]));

  final ValueListenable<double> position;
  final Animation<double> clock;
  final IntroPalette palette;

  /// The motes, drawn once so they are the same on every launch and every
  /// repaint: where each starts, how it sways, how deep it is (deep ones move
  /// less with the pages), and whether it rises once or twice per clock.
  static final List<_Mote> _motes = _makeMotes();

  static List<_Mote> _makeMotes() {
    final random = math.Random(108);
    return List.generate(IntroConfig.moteCount, (_) {
      return _Mote(
        x: random.nextDouble(),
        y: random.nextDouble(),
        radius: IntroConfig.moteMinRadius +
            random.nextDouble() * (IntroConfig.moteMaxRadius - IntroConfig.moteMinRadius),
        depth: 0.35 + random.nextDouble() * 0.65,
        sway: 6 + random.nextDouble() * 14,
        phase: random.nextDouble(),
        laps: random.nextBool() ? 1 : 2,
      );
    });
  }

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final page = position.value;

    _light(
      canvas,
      Offset(w * (0.5 - page * IntroConfig.backdropParallax), h * 0.3),
      w * IntroConfig.glowRadius,
      1,
    );
    _light(
      canvas,
      Offset(w * (1.15 - page * IntroConfig.backdropParallax * 1.4), h * 0.72),
      w * IntroConfig.glowRadius * 0.7,
      0.55,
    );

    final alpha = palette.isLight ? IntroConfig.moteAlpha : IntroConfig.moteAlphaDark;
    for (final mote in _motes) {
      // Rising: y falls with the clock, wrapping, and the mote fades in and out
      // at the ends of its climb so the wrap is never seen.
      final climb = (mote.y - clock.value * mote.laps) % 1.0;
      final rise = climb < 0 ? climb + 1 : climb;
      final fade = math.sin(rise * math.pi);

      final sway = math.sin((clock.value * mote.laps + mote.phase) * math.pi * 2) * mote.sway;
      final x = w * mote.x + sway - page * w * IntroConfig.backdropParallax * mote.depth * 1.6;
      final wrapped = ((x % w) + w) % w;

      canvas.drawCircle(
        Offset(wrapped, h * rise),
        mote.radius * mote.depth + 0.4,
        Paint()..color = IntroShapes.fade(palette.glow, alpha * fade * mote.depth),
      );
    }
  }

  void _light(Canvas canvas, Offset at, double radius, double strength) {
    final alpha = (palette.isLight ? IntroConfig.glowAlpha : IntroConfig.glowAlphaDark) * strength;
    canvas.drawCircle(
      at,
      radius,
      Paint()
        ..shader = ui.Gradient.radial(at, radius, [
          IntroShapes.fade(palette.glow, alpha),
          IntroShapes.fade(palette.glow, 0),
        ]),
    );
  }

  @override
  bool shouldRepaint(covariant _BackdropPainter oldDelegate) =>
      oldDelegate.palette != palette ||
      oldDelegate.position != position ||
      oldDelegate.clock != clock;
}

class _Mote {
  const _Mote({
    required this.x,
    required this.y,
    required this.radius,
    required this.depth,
    required this.sway,
    required this.phase,
    required this.laps,
  });

  final double x;
  final double y;
  final double radius;
  final double depth;
  final double sway;
  final double phase;
  final int laps;
}
