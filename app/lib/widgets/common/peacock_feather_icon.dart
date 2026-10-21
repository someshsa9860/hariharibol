import 'package:flutter/material.dart';

/// A peacock feather: the eye at the top, the quill curving down. Drawn in code
/// so it takes the surrounding icon colour and size like any Material icon.
class PeacockFeatherIcon extends StatelessWidget {
  const PeacockFeatherIcon({super.key, this.size, this.color});

  final double? size;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final iconTheme = IconTheme.of(context);
    final dimension = size ?? iconTheme.size ?? 24;
    return ExcludeSemantics(
      child: CustomPaint(
        size: Size.square(dimension),
        painter: _FeatherPainter(color ?? iconTheme.color ?? Theme.of(context).colorScheme.onSurface),
      ),
    );
  }
}

class _FeatherPainter extends CustomPainter {
  _FeatherPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final unit = size.width / 24;
    final line = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.8 * unit
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    // The quill.
    final quill = Path()
      ..moveTo(12 * unit, 22 * unit)
      ..cubicTo(12 * unit, 19 * unit, 11 * unit, 17 * unit, 12 * unit, 14.5 * unit);
    canvas.drawPath(quill, line);

    // The feather's outline, a pointed oval.
    final outline = Path()
      ..moveTo(12 * unit, 2.5 * unit)
      ..cubicTo(16.5 * unit, 5 * unit, 18 * unit, 9 * unit, 17 * unit, 12 * unit)
      ..cubicTo(16 * unit, 14.5 * unit, 14 * unit, 15 * unit, 12 * unit, 15 * unit)
      ..cubicTo(10 * unit, 15 * unit, 8 * unit, 14.5 * unit, 7 * unit, 12 * unit)
      ..cubicTo(6 * unit, 9 * unit, 7.5 * unit, 5 * unit, 12 * unit, 2.5 * unit)
      ..close();
    canvas.drawPath(outline, line);

    // The eye.
    canvas.drawOval(Rect.fromCenter(center: Offset(12 * unit, 9 * unit), width: 4.2 * unit, height: 5.4 * unit), line);
  }

  @override
  bool shouldRepaint(_FeatherPainter old) => old.color != color;
}
