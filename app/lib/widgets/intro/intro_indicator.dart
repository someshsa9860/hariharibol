import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../core/constants/intro_config.dart';
import '../../core/theme/app_theme.dart';

/// Where the person is in the pages: a row of dots with a worm that stretches
/// from one to the next as the pager is dragged, and follows the finger exactly
/// — it reads the pager's fractional position, not the page it settled on.
class IntroIndicator extends StatelessWidget {
  const IntroIndicator({super.key, required this.position, this.count = IntroConfig.pageCount});

  final ValueListenable<double> position;
  final int count;

  @override
  Widget build(BuildContext context) {
    const spacing = IntroConfig.dotSize + IntroConfig.dotGap;
    final colors = context.colors;

    return RepaintBoundary(
      child: CustomPaint(
        size: Size((count - 1) * spacing + IntroConfig.dotSize, IntroConfig.dotSize),
        painter: _WormPainter(
          position: position,
          count: count,
          idle: colors.outline.withValues(alpha: IntroConfig.dotAlpha),
          active: colors.primary,
        ),
      ),
    );
  }
}

class _WormPainter extends CustomPainter {
  _WormPainter({
    required this.position,
    required this.count,
    required this.idle,
    required this.active,
  }) : super(repaint: position);

  final ValueListenable<double> position;
  final int count;
  final Color idle;
  final Color active;

  @override
  void paint(Canvas canvas, Size size) {
    const dot = IntroConfig.dotSize;
    const spacing = dot + IntroConfig.dotGap;
    const radius = dot / 2;
    final y = size.height / 2;

    final idlePaint = Paint()..color = idle;
    for (var i = 0; i < count; i++) {
      canvas.drawCircle(Offset(radius + i * spacing, y), radius, idlePaint);
    }

    // The head leaves first and the tail catches up in the second half, which
    // is what stretches the worm between two dots mid-drag.
    final at = position.value.clamp(0.0, count - 1.0);
    final from = at.floor();
    final share = at - from;
    final head = share < 0.5 ? share * 2 : 1.0;
    final tail = share < 0.5 ? 0.0 : (share - 0.5) * 2;

    final left = (from + Curves.easeOut.transform(tail)) * spacing;
    final right = (from + Curves.easeOut.transform(head)) * spacing + dot;
    canvas.drawRRect(
      RRect.fromLTRBR(left, 0, right, dot, const Radius.circular(radius)),
      Paint()..color = active,
    );
  }

  @override
  bool shouldRepaint(covariant _WormPainter oldDelegate) =>
      oldDelegate.idle != idle ||
      oldDelegate.active != active ||
      oldDelegate.count != count ||
      oldDelegate.position != position;
}
