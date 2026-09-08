import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

/// The line-art symbols the design uses instead of photographs.
///
/// Drawn rather than shipped as images: they are a handful of strokes each, so
/// a painter costs less than the asset would, scales to any size without a
/// second file, and takes its colour from whatever card it lands on.
enum Motif { lotus, sun, crescent }

/// A decorative panel — a warm gradient with a motif drawn faintly over it.
///
/// Purely ornamental, so it is hidden from screen readers entirely: announcing
/// "lotus" between a verse and its translation helps nobody.
class MotifPanel extends StatelessWidget {
  const MotifPanel({
    super.key,
    required this.motif,
    required this.from,
    required this.to,
    this.lineColor,
    this.lineOpacity = 0.35,
  });

  final Motif motif;

  /// The gradient, top-left to bottom-right.
  final Color from;
  final Color to;

  /// Defaults to the ink of the gradient's own family, which keeps the motif
  /// legible on both a pale sand panel and a deep indigo one.
  final Color? lineColor;
  final double lineOpacity;

  @override
  Widget build(BuildContext context) {
    final ink = lineColor ??
        (ThemeData.estimateBrightnessForColor(to) == Brightness.dark
            ? AppColors.white
            : AppColors.ink);

    return ExcludeSemantics(
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [from, to],
          ),
        ),
        child: CustomPaint(
          painter: _MotifPainter(motif: motif, color: ink.withValues(alpha: lineOpacity)),
          size: Size.infinite,
        ),
      ),
    );
  }
}

class _MotifPainter extends CustomPainter {
  const _MotifPainter({required this.motif, required this.color});

  final Motif motif;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    // Everything is drawn inside the largest square that fits, so the motif
    // keeps its proportions in a panel of any shape.
    final side = math.min(size.width, size.height);
    final centre = Offset(size.width / 2, size.height / 2);

    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = math.max(0.6, side * 0.006)
      ..strokeCap = StrokeCap.round
      ..isAntiAlias = true;

    switch (motif) {
      case Motif.lotus:
        _lotus(canvas, centre, side, paint);
      case Motif.sun:
        _sun(canvas, centre, side, paint);
      case Motif.crescent:
        _crescent(canvas, centre, side, paint);
    }
  }

  /// A fan of petals rising from a single point, with the waterline through it.
  void _lotus(Canvas canvas, Offset centre, double side, Paint paint) {
    final base = Offset(centre.dx, centre.dy + side * 0.30);
    final height = side * 0.52;
    const petals = 15;

    for (var i = 0; i < petals; i++) {
      // -78°..78° off vertical, so the outermost petals lie almost flat.
      final t = (i / (petals - 1)) * 2 - 1;
      final angle = t * 78 * math.pi / 180;

      // Outer petals are only slightly shorter. Any more and the tips come to
      // a point and the whole thing reads as an open book rather than a bloom.
      final length = height * (1 - 0.12 * t.abs());
      final tip = base + Offset(math.sin(angle) * length, -math.cos(angle) * length);

      // The control point is pushed sideways from the midline to bow each
      // petal away from its neighbours.
      final mid = Offset.lerp(base, tip, 0.55)!;
      final bow = length * 0.16 * (t.isNegative ? -1 : 1) * (1 - t.abs() * 0.4);

      canvas.drawPath(
        Path()
          ..moveTo(base.dx, base.dy)
          ..quadraticBezierTo(mid.dx + bow, mid.dy, tip.dx, tip.dy),
        paint,
      );
    }

    // A short waterline, not a full-width rule — a rule the width of the panel
    // turns the fan above it into the pages of a book.
    canvas.drawLine(
      Offset(centre.dx - side * 0.30, base.dy),
      Offset(centre.dx + side * 0.30, base.dy),
      paint,
    );
  }

  /// A disc with rays, alternating long and short.
  void _sun(Canvas canvas, Offset centre, double side, Paint paint) {
    final radius = side * 0.16;
    canvas.drawCircle(centre, radius, paint);

    const rays = 24;
    for (var i = 0; i < rays; i++) {
      final angle = (i / rays) * 2 * math.pi;
      final direction = Offset(math.cos(angle), math.sin(angle));
      final outer = radius + side * (i.isEven ? 0.26 : 0.16);
      canvas.drawLine(centre + direction * (radius * 1.35), centre + direction * outer, paint);
    }
  }

  /// An open ring with a single mark inside it.
  void _crescent(Canvas canvas, Offset centre, double side, Paint paint) {
    final radius = side * 0.32;

    // Left open at the top right, which is where the dot sits.
    canvas.drawArc(
      Rect.fromCircle(center: centre, radius: radius),
      -math.pi * 0.30,
      math.pi * 1.72,
      false,
      paint,
    );

    canvas.drawCircle(
      centre + Offset(radius * 0.72, -radius * 0.72),
      side * 0.028,
      Paint()..color = paint.color,
    );
  }

  @override
  bool shouldRepaint(_MotifPainter old) => old.motif != motif || old.color != color;
}
