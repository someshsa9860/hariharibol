import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../core/constants/intro_config.dart';
import 'intro_scene.dart';

/// The chanting page: a mala hanging by its tassel, its beads threading on one
/// after another, then a point of light going round it bead by bead while a tally
/// of small dots fills inside — and, in the middle, the sound bars of a voice,
/// because the count here is made by listening to the chanting.
class ChantScene extends StatelessWidget {
  const ChantScene({super.key, required this.enter, required this.loop});

  final Animation<double> enter;
  final Animation<double> loop;

  @override
  Widget build(BuildContext context) {
    return IntroCanvas(enter: enter, loop: loop, painter: _ChantPainter.new);
  }
}

class _ChantPainter extends IntroScenePainter {
  _ChantPainter(Animation<double> enter, Animation<double> loop, IntroPalette palette)
    : super(enter: enter, loop: loop, palette: palette);

  /// Beads on the string, the large one (the meru) included.
  static const int _places = IntroConfig.beadCount + 1;

  /// The ring's radius, a bead's, and the meru's, in units of the half-side.
  static const double _ring = 0.66;
  static const double _bead = 0.07;
  static const double _meru = 0.1;

  @override
  void paint(Canvas canvas, Size size) {
    final r = size.width / 2;
    canvas.translate(r, r * 0.9);

    final ring = r * _ring;
    _voice(canvas, r);
    _tally(canvas, ring);
    _string(canvas, ring, r);
    _tassel(canvas, ring, r);
    _beads(canvas, ring, r);
  }

  /// Where the bead at [place] sits. Place 0 is the meru, at the bottom, and the
  /// others follow it round the way the hand moves.
  Offset _at(int place, double ring) {
    final angle = math.pi / 2 + place / _places * math.pi * 2;
    return Offset(math.cos(angle), math.sin(angle)) * ring;
  }

  /// A disc at the centre with five bars rising and falling in it, and a ring
  /// leaving it every now and then.
  void _voice(Canvas canvas, double r) {
    final t = IntroShapes.pop(beat(900, 1500));
    if (t <= 0) return;

    final disc = r * 0.3 * t;
    canvas.drawCircle(
      Offset.zero,
      disc,
      Paint()..color = IntroShapes.fade(palette.soft, 0.9),
    );
    canvas.drawCircle(
      Offset.zero,
      disc,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = IntroShapes.fade(palette.line, 0.5),
    );

    final wave = turn(times: 2);
    canvas.drawCircle(
      Offset.zero,
      disc + r * 0.22 * Curves.easeOut.transform(wave),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = r * 0.012
        ..color = IntroShapes.fade(palette.accent, 0.3 * (1 - wave) * t.clamp(0.0, 1.0)),
    );

    final width = r * 0.05;
    final gap = r * 0.095;
    final bar = Paint()..color = IntroShapes.fade(palette.accent, 0.85 * t.clamp(0.0, 1.0));
    for (var i = 0; i < IntroConfig.soundBars; i++) {
      final height = r * 0.22 * (0.22 + 0.78 * swing(phase: i * 0.17, times: 3)) * t;
      final x = (i - (IntroConfig.soundBars - 1) / 2) * gap;
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(center: Offset(x, 0), width: width, height: height),
          Radius.circular(width / 2),
        ),
        bar,
      );
    }
  }

  /// One dot per bead, filling as the light passes — the count of the round.
  void _tally(Canvas canvas, double ring) {
    final t = beat(1300, 1900, Curves.easeOut);
    if (t <= 0) return;

    final position = turn() * _places;
    // The tally clears itself over the end of the turn, then starts again empty.
    final clearing = 1 - span(0.94, 1, Curves.linear);
    final radius = ring * 0.74;
    final dot = ring * 0.026;

    for (var k = 1; k < _places; k++) {
      final angle = math.pi / 2 + k / _places * math.pi * 2;
      final at = Offset(math.cos(angle), math.sin(angle)) * radius;
      final counted = position >= k;
      canvas.drawCircle(
        at,
        counted ? dot * 1.25 : dot,
        Paint()
          ..color = counted
              ? IntroShapes.fade(palette.accent, 0.9 * clearing * t)
              : IntroShapes.fade(palette.line, 0.55 * t),
      );
    }
  }

  /// The thread, drawn round from the meru.
  void _string(Canvas canvas, double ring, double r) {
    final t = beat(0, 900, Curves.easeInOut);
    if (t <= 0) return;
    canvas.drawArc(
      Rect.fromCircle(center: Offset.zero, radius: ring),
      math.pi / 2,
      math.pi * 2 * t,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = r * 0.012
        ..color = IntroShapes.fade(palette.line, 0.8),
    );
  }

  /// Three strands and a knot below the meru, swaying a little.
  void _tassel(Canvas canvas, double ring, double r) {
    final t = beat(700, 1400);
    if (t <= 0) return;

    final root = _at(0, ring) + Offset(0, r * _meru);
    final sway = math.sin(turn() * math.pi * 2) * 0.07;
    final strand = Paint()
      ..strokeCap = StrokeCap.round
      ..strokeWidth = r * 0.017
      ..color = IntroShapes.fade(palette.isLight ? palette.accent : palette.muted, t);

    canvas.save();
    canvas.translate(root.dx, root.dy);
    canvas.rotate(sway);
    for (final spread in [-0.2, 0.0, 0.2]) {
      final length = r * 0.26 * t * (spread == 0 ? 1.0 : 0.88);
      canvas.drawLine(
        Offset.zero,
        Offset(math.sin(spread) * length, math.cos(spread) * length),
        strand,
      );
    }
    canvas.drawCircle(Offset(0, r * 0.03), r * 0.034, Paint()..color = strand.color);
    canvas.restore();
  }

  /// The beads, each popping on in turn, and the light running through them.
  void _beads(Canvas canvas, double ring, double r) {
    final position = turn() * _places;

    for (var k = 0; k < _places; k++) {
      final pop = IntroShapes.pop(beat(150 + k * 32, 520 + k * 32));
      if (pop <= 0) continue;

      final lit = _lit((position - k) % _places);
      final radius = r * (k == 0 ? _meru : _bead) * pop * (1 + 0.34 * lit);
      final at = _at(k, ring);

      if (lit > 0.04) {
        canvas.drawCircle(
          at,
          radius * 1.9,
          Paint()
            ..color = IntroShapes.fade(palette.glow, 0.5 * lit)
            ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 9),
        );
      }

      canvas.drawCircle(
        at,
        radius,
        Paint()
          ..shader = ui.Gradient.radial(
            at + Offset(-radius * 0.32, -radius * 0.36),
            radius * 1.5,
            [
              Color.lerp(palette.beadLight, palette.glow, lit * 0.6)!,
              palette.beadDark,
            ],
          ),
      );
    }
  }

  /// How lit a bead is when the light is [behind] places past it. The light
  /// starts to reach a bead just before it arrives, is brightest as it passes,
  /// and trails off behind — and at the seam between two turns the two ends meet
  /// at the same value, so the loop has no joint.
  double _lit(double behind) {
    const lead = 0.9;
    final double value;
    if (behind >= _places - lead) {
      value = (behind - (_places - lead)) / lead;
    } else if (behind < IntroConfig.beadTrail) {
      value = 1 - behind / IntroConfig.beadTrail;
    } else {
      value = 0;
    }
    return Curves.easeOut.transform(value.clamp(0.0, 1.0));
  }
}
