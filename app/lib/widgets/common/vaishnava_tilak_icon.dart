import 'package:flutter/material.dart';

/// The Vaishnava tilak (urdhva pundra): two lines rising from a joined foot,
/// the space between them marked with a single stroke.
///
/// Drawn rather than shipped, like the motifs, so it stays sharp at the few
/// pixels it is used at and takes the colour of whatever it sits on.
/// Decorative; whatever shows it says "Ekadashi" in words for a screen reader.
class VaishnavaTilakIcon extends StatelessWidget {
  const VaishnavaTilakIcon({super.key, required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: SizedBox.square(
        dimension: size,
        child: CustomPaint(painter: _TilakPainter(color)),
      ),
    );
  }
}

class _TilakPainter extends CustomPainter {
  const _TilakPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width;
    Offset at(double x, double y) => Offset(x * s, y * s);

    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..strokeWidth = s * 0.11;

    // The U: out at the top, drawn in to a rounded foot.
    final u = Path()
      ..moveTo(at(0.24, 0.06).dx, at(0.24, 0.06).dy)
      ..cubicTo(
        at(0.25, 0.50).dx,
        at(0.25, 0.50).dy,
        at(0.34, 0.94).dx,
        at(0.34, 0.94).dy,
        at(0.50, 0.94).dx,
        at(0.50, 0.94).dy,
      )
      ..cubicTo(
        at(0.66, 0.94).dx,
        at(0.66, 0.94).dy,
        at(0.75, 0.50).dx,
        at(0.75, 0.50).dy,
        at(0.76, 0.06).dx,
        at(0.76, 0.06).dy,
      );
    canvas.drawPath(u, stroke);

    // The centre mark, a leaf shape standing in the opening.
    final mark = Path()
      ..moveTo(at(0.50, 0.12).dx, at(0.50, 0.12).dy)
      ..quadraticBezierTo(at(0.58, 0.42).dx, at(0.58, 0.42).dy, at(0.50, 0.74).dx, at(0.50, 0.74).dy)
      ..quadraticBezierTo(at(0.42, 0.42).dx, at(0.42, 0.42).dy, at(0.50, 0.12).dx, at(0.50, 0.12).dy);
    canvas.drawPath(mark, Paint()..color = color);
  }

  @override
  bool shouldRepaint(_TilakPainter old) => old.color != color;
}
