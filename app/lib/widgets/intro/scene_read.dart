import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../core/constants/intro_config.dart';
import 'intro_scene.dart';

/// The reading page: an open book whose lines write themselves in, a soft
/// highlight following the reader down the right-hand page with the sound of
/// the recitation beneath it, and a leaf that turns over now and again.
class ReadScene extends StatelessWidget {
  const ReadScene({super.key, required this.enter, required this.loop});

  final Animation<double> enter;
  final Animation<double> loop;

  @override
  Widget build(BuildContext context) {
    return IntroCanvas(enter: enter, loop: loop, painter: _ReadPainter.new);
  }
}

class _ReadPainter extends IntroScenePainter {
  _ReadPainter(Animation<double> enter, Animation<double> loop, IntroPalette palette)
    : super(enter: enter, loop: loop, palette: palette);

  // The proportions of the book, in units of the picture's half-side.
  static const double _width = 1.58;
  static const double _height = 1.06;

  // How each line of a page ends, as a share of the line's full length. Left
  // and right differ so the spread does not look stamped.
  static const List<double> _leftLines = [0.62, 1, 0.92, 1, 0.7];
  static const List<double> _rightLines = [0.9, 1, 0.78, 0.96, 0.5];

  @override
  void paint(Canvas canvas, Size size) {
    final r = size.width / 2;
    canvas.translate(r, r * 1.02);

    final rise = IntroShapes.pop(beat(0, 950));
    if (rise <= 0) return;

    _sparks(canvas, r);

    canvas.save();
    canvas.scale(0.78 + 0.22 * rise);
    canvas.translate(0, (1 - rise) * r * 0.12);

    final w = _width * r;
    final h = _height * r;
    _shadow(canvas, w, h, rise);
    _cover(canvas, w, h);
    _stack(canvas, w, h);
    _page(canvas, -1, w, h, lines: _leftLines, medallion: true);
    _page(canvas, 1, w, h, lines: _rightLines, reading: true);
    _leaf(canvas, w, h);

    canvas.restore();
  }

  Path _pagePath(double sign, double w, double h) {
    final half = w / 2;
    return Path()
      ..moveTo(0, -h / 2 + h * 0.03)
      ..quadraticBezierTo(sign * half * 0.5, -h / 2 - h * 0.06, sign * half, -h / 2)
      ..lineTo(sign * half, h / 2)
      ..quadraticBezierTo(sign * half * 0.5, h / 2 + h * 0.06, 0, h / 2 + h * 0.03)
      ..close();
  }

  void _shadow(Canvas canvas, double w, double h, double rise) {
    final rect = Rect.fromCenter(
      center: Offset(0, h * 0.62),
      width: w * 0.95,
      height: h * 0.16,
    );
    canvas.drawOval(
      rect,
      Paint()
        ..color = IntroShapes.fade(palette.ink, 0.14 * rise)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 14),
    );
  }

  void _cover(Canvas canvas, double w, double h) {
    final rect = RRect.fromRectAndRadius(
      Rect.fromLTRB(-w / 2 - h * 0.05, -h / 2 - h * 0.07, w / 2 + h * 0.05, h / 2 + h * 0.11),
      Radius.circular(h * 0.07),
    );
    canvas.drawRRect(rect, Paint()..color = palette.isLight ? palette.accent : palette.soft);
    canvas.drawRRect(
      rect,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = IntroShapes.fade(palette.line, palette.isLight ? 0.3 : 0.8),
    );
  }

  /// The edges of the pages beneath, so the book has thickness.
  void _stack(Canvas canvas, double w, double h) {
    for (var k = 2; k >= 1; k--) {
      for (final sign in [-1.0, 1.0]) {
        canvas.save();
        canvas.translate(0, k * h * 0.014);
        final path = _pagePath(sign, w, h);
        canvas.drawPath(path, Paint()..color = palette.paper);
        canvas.drawPath(
          path,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1
            ..color = IntroShapes.fade(palette.line, 0.45),
        );
        canvas.restore();
      }
    }
  }

  void _page(
    Canvas canvas,
    double sign,
    double w,
    double h, {
    required List<double> lines,
    bool medallion = false,
    bool reading = false,
  }) {
    final path = _pagePath(sign, w, h);
    canvas.drawPath(path, Paint()..color = palette.paper);
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = IntroShapes.fade(palette.line, 0.6),
    );
    // The gutter: a shade falling toward the spine.
    canvas.drawPath(
      path,
      Paint()
        ..shader = ui.Gradient.linear(
          Offset.zero,
          Offset(sign * w * 0.2, 0),
          [IntroShapes.fade(palette.ink, 0.1), IntroShapes.fade(palette.ink, 0)],
        ),
    );

    if (medallion) _medallion(canvas, sign, w, h);
    _writing(canvas, sign, w, h, lines);

    if (reading) {
      _highlight(canvas, sign, w, h);
      _recitation(canvas, sign, w, h);
    }
  }

  /// The verse number: a small ring with a dot, above the lines.
  void _medallion(Canvas canvas, double sign, double w, double h) {
    final t = IntroShapes.pop(beat(450, 950));
    if (t <= 0) return;
    final center = Offset(sign * w * 0.25, -h / 2 + h * 0.13);
    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = h * 0.012
      ..color = IntroShapes.fade(palette.accent, 0.8 * t.clamp(0.0, 1.0));
    canvas.drawCircle(center, h * 0.05 * t, stroke);
    canvas.drawCircle(center, h * 0.014 * t, Paint()..color = stroke.color);
  }

  /// A block of lines that draw themselves from the left, one after another.
  void _writing(Canvas canvas, double sign, double w, double h, List<double> lines) {
    final half = w / 2;
    final stroke = Paint()
      ..strokeCap = StrokeCap.round
      ..strokeWidth = h * 0.02;
    final start = sign * half * (sign < 0 ? 0.88 : 0.14);
    final reach = sign * half * 0.74 * (sign < 0 ? -1 : 1);

    for (var i = 0; i < IntroConfig.verseLines; i++) {
      final from = 500 + i * 150 + (sign > 0 ? 350 : 0);
      final t = beat(from, from + 560, Curves.easeInOut);
      if (t <= 0) continue;
      final y = _lineY(i, h);
      final length = reach * lines[i] * t;
      stroke.color = IntroShapes.fade(i == 0 && sign < 0 ? palette.accent : palette.muted, 0.62);
      canvas.drawLine(Offset(start, y), Offset(start + length, y), stroke);
    }
  }

  double _lineY(int i, double h) => -h / 2 + h * (0.27 + i * 0.125);

  /// The band that reads down the right page, line to line, easing from one to
  /// the next — what following the recitation looks like.
  void _highlight(Canvas canvas, double sign, double w, double h) {
    final t = beat(1500, 1900, Curves.easeOut);
    if (t <= 0) return;

    final count = IntroConfig.verseLines;
    final position = turn() * count;
    final line = position.floor();
    final glide = Curves.easeInOutCubic.transform(((position - line - 0.55) / 0.45).clamp(0.0, 1.0));
    final from = _lineY(line, h);
    final to = line + 1 < count ? _lineY(line + 1, h) : from;
    final y = from + (to - from) * glide;

    // The band dims after the last line and comes back on the first, so the
    // loop closes without the band jumping up the page.
    var visible = t;
    if (line == count - 1) visible *= 1 - glide;
    if (line == 0) visible *= (position / 0.4).clamp(0.0, 1.0);

    final half = w / 2;
    final band = RRect.fromRectAndRadius(
      Rect.fromCenter(center: Offset(half * 0.5, y), width: half * 0.84, height: h * 0.085),
      Radius.circular(h * 0.04),
    );
    canvas.drawRRect(
      band,
      Paint()..color = IntroShapes.fade(palette.accent, (palette.isLight ? 0.17 : 0.14) * visible),
    );
  }

  /// Five bars rising and falling at the foot of the page — the sound.
  void _recitation(Canvas canvas, double sign, double w, double h) {
    final t = beat(1650, 2100, Curves.easeOut);
    if (t <= 0) return;

    final bar = Paint()..color = IntroShapes.fade(palette.accent, 0.78 * t);
    final width = h * 0.026;
    final gap = h * 0.052;
    final x0 = w / 2 * 0.15;
    final y = h / 2 - h * 0.1;

    for (var i = 0; i < IntroConfig.soundBars; i++) {
      final height = h * 0.075 * (0.3 + 0.7 * swing(phase: i * 0.19, times: 2)) * t;
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(center: Offset(x0 + i * gap, y), width: width, height: height),
          Radius.circular(width / 2),
        ),
        bar,
      );
    }
  }

  /// The right page turning over onto the left. It is the page's own shape
  /// squeezed toward the spine and then stretched out the other side, with a
  /// shade across it while it stands on edge.
  void _leaf(Canvas canvas, double w, double h) {
    final progress = span(IntroConfig.flipFrom, IntroConfig.flipTo);
    if (progress <= 0) return;

    final angle = progress * math.pi;
    final squeeze = math.cos(angle);
    // It dissolves after landing, over the left page it has become, so the loop
    // can start again from the right without a jump.
    final linger = 1 - span(0.92, 1, Curves.linear);
    if (linger <= 0) return;

    canvas.save();
    canvas.scale(squeeze, 1 - 0.05 * math.sin(angle));
    final path = _pagePath(1, w, h);
    canvas.drawPath(path, Paint()..color = IntroShapes.fade(palette.paper, linger));
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = IntroShapes.fade(palette.line, 0.7 * linger),
    );
    canvas.drawPath(
      path,
      Paint()..color = IntroShapes.fade(palette.ink, 0.16 * math.sin(angle) * linger),
    );

    // Its writing, until the far side shows.
    final half = w / 2;
    final stroke = Paint()
      ..strokeCap = StrokeCap.round
      ..strokeWidth = h * 0.02
      ..color = IntroShapes.fade(palette.muted, 0.62 * linger);
    for (var i = 0; i < IntroConfig.verseLines; i++) {
      final y = _lineY(i, h);
      canvas.drawLine(
        Offset(half * 0.14, y),
        Offset(half * 0.14 + half * 0.74 * _rightLines[i], y),
        stroke,
      );
    }
    canvas.restore();
  }

  /// A few points of light lifting off the page. They are drawn behind the
  /// book, so they start clear of its top edge: any lower and a spark at its
  /// brightest would be half hidden by the cover.
  void _sparks(Canvas canvas, double r) {
    final t = beat(1300, 1900, Curves.easeOut);
    if (t <= 0) return;

    const spots = [Offset(-0.46, -0.68), Offset(0.08, -0.76), Offset(0.52, -0.64)];
    for (var i = 0; i < spots.length; i++) {
      final life = turn(phase: i / spots.length);
      final glow = math.sin(life * math.pi);
      final at = Offset(spots[i].dx * r, (spots[i].dy - life * 0.22) * r);
      final size = r * 0.05 * (0.6 + 0.4 * glow);
      final star = Path()
        ..moveTo(at.dx, at.dy - size * 1.6)
        ..quadraticBezierTo(at.dx, at.dy, at.dx + size, at.dy)
        ..quadraticBezierTo(at.dx, at.dy, at.dx, at.dy + size * 1.6)
        ..quadraticBezierTo(at.dx, at.dy, at.dx - size, at.dy)
        ..quadraticBezierTo(at.dx, at.dy, at.dx, at.dy - size * 1.6)
        ..close();
      canvas.drawPath(star, Paint()..color = IntroShapes.fade(palette.glow, 0.95 * glow * t));
    }
  }
}
