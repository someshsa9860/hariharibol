import 'package:flutter/material.dart';

/// A peacock feather — the eye on a curved quill, with barbs either side.
///
/// Drawn rather than shipped, like the motifs: a few strokes, any size, and it
/// takes its colour from whatever it sits on, so it can stand in anywhere an
/// [Icon] would. Decorative; the control it sits in carries the label.
class PeacockFeatherIcon extends StatelessWidget {
  const PeacockFeatherIcon({super.key, required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: SizedBox.square(
        dimension: size,
        child: CustomPaint(painter: _FeatherPainter(color)),
      ),
    );
  }
}

class _FeatherPainter extends CustomPainter {
  const _FeatherPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width;
    Offset at(double x, double y) => Offset(x * s, y * s);

    final line = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = s * 0.07;
    final fine = Paint.from(line)..strokeWidth = s * 0.045;

    // The plume: a tall leaf, wide at the eye and drawn in to the quill.
    final plume = Path()
      ..moveTo(at(0.56, 0.02).dx, at(0.56, 0.02).dy)
      ..cubicTo(at(0.98, 0.20).dx, at(0.98, 0.20).dy, at(0.92, 0.62).dx,
          at(0.92, 0.62).dy, at(0.52, 0.80).dx, at(0.52, 0.80).dy)
      ..cubicTo(at(0.14, 0.62).dx, at(0.14, 0.62).dy, at(0.14, 0.20).dx,
          at(0.14, 0.20).dy, at(0.56, 0.02).dx, at(0.56, 0.02).dy);
    canvas.drawPath(plume, fine);

    // The quill, from the foot up through the plume to the eye.
    final quill = Path()
      ..moveTo(at(0.30, 0.99).dx, at(0.30, 0.99).dy)
      ..quadraticBezierTo(at(0.44, 0.84).dx, at(0.44, 0.84).dy, at(0.54, 0.58).dx,
          at(0.54, 0.58).dy);
    canvas.drawPath(quill, line);

    // Barbs, slanting out from the quill to the edge of the plume.
    for (final (x, y, dx, dy) in const [
      (0.50, 0.72, -0.20, -0.10),
      (0.52, 0.66, 0.20, -0.10),
      (0.53, 0.60, -0.17, -0.12),
    ]) {
      canvas.drawLine(at(x, y), at(x + dx, y + dy), fine);
    }

    // The eye: a ring, and the dark heart of it.
    final eye = at(0.54, 0.34);
    canvas.drawOval(
      Rect.fromCenter(center: eye, width: s * 0.34, height: s * 0.42),
      line,
    );
    canvas.drawOval(
      Rect.fromCenter(center: eye, width: s * 0.13, height: s * 0.18),
      Paint()..color = color,
    );
  }

  @override
  bool shouldRepaint(_FeatherPainter old) => old.color != color;
}
