import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../core/constants/intro_config.dart';
import '../../core/theme/app_colors.dart';
import 'intro_scene.dart';

/// The reels page: a phone, tilted a little and floating, playing a reel that is
/// swiped to the next and back again, with the like, comment and share buttons
/// along its edge. A heart is tapped and a few float away from it.
///
/// What plays inside is drawn on the reel's own black ground in both themes —
/// the one surface in the app that does not follow the palette (see
/// `AppColors.reelGround`).
class ReelsScene extends StatelessWidget {
  const ReelsScene({super.key, required this.enter, required this.loop});

  final Animation<double> enter;
  final Animation<double> loop;

  @override
  Widget build(BuildContext context) {
    return IntroCanvas(enter: enter, loop: loop, painter: _ReelsPainter.new);
  }
}

class _ReelsPainter extends IntroScenePainter {
  _ReelsPainter(Animation<double> enter, Animation<double> loop, IntroPalette palette)
    : super(enter: enter, loop: loop, palette: palette);

  // The phone, in units of the picture's half-side.
  static const double _phoneWidth = 0.78;
  static const double _phoneHeight = 1.5;

  @override
  void paint(Canvas canvas, Size size) {
    final r = size.width / 2;
    canvas.translate(r, r);

    final rise = IntroShapes.pop(beat(0, 1000));
    if (rise <= 0) return;

    _halo(canvas, r, rise);

    final bob = math.sin(turn() * math.pi * 2) * r * IntroConfig.phoneFloat;
    canvas.save();
    canvas.translate(0, bob + (1 - rise) * r * 0.2);
    canvas.rotate(IntroConfig.phoneTilt * rise);
    canvas.scale(0.82 + 0.18 * rise);

    final w = _phoneWidth * r;
    final h = _phoneHeight * r;
    final body = RRect.fromRectAndRadius(
      Rect.fromCenter(center: Offset.zero, width: w, height: h),
      Radius.circular(w * 0.15),
    );

    canvas.drawRRect(
      body.shift(Offset(0, r * 0.05)),
      Paint()
        ..color = IntroShapes.fade(palette.ink, 0.16 * rise)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 16),
    );
    canvas.drawRRect(body, Paint()..color = AppColors.reelGround);

    final screen = body.deflate(w * 0.04);
    canvas.save();
    canvas.clipRRect(screen);
    _reels(canvas, screen.outerRect);
    _caption(canvas, screen.outerRect);
    _rail(canvas, screen.outerRect);
    _progress(canvas, screen.outerRect);
    canvas.restore();

    canvas.drawRRect(
      body,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = r * 0.025
        ..color = palette.isLight ? palette.ink : palette.line,
    );
    canvas.restore();
  }

  void _halo(Canvas canvas, double r, double t) {
    final radius = r * 0.9 * (1 + 0.03 * swing());
    canvas.drawCircle(
      Offset.zero,
      radius,
      Paint()
        ..shader = ui.Gradient.radial(Offset.zero, radius, [
          IntroShapes.fade(palette.glow, (palette.isLight ? 0.34 : 0.13) * t.clamp(0.0, 1.0)),
          IntroShapes.fade(palette.glow, 0),
        ]),
    );
  }

  /// Two reels, swiped up one after the other. Three screens are laid out in a
  /// column — sun, lotus, sun again — and the two swipes carry the column up by
  /// two screens, so the second sun stands where the first began and the loop
  /// closes without the picture ever being swiped back down.
  void _reels(Canvas canvas, Rect screen) {
    const length = IntroConfig.swipeSpan;
    final first = span(IntroConfig.swipeOneFrom, IntroConfig.swipeOneFrom + length);
    final second = span(IntroConfig.swipeTwoFrom, IntroConfig.swipeTwoFrom + length);
    final shift = (first + second) * screen.height;

    canvas.save();
    canvas.translate(0, -shift);
    _sun(canvas, screen);
    canvas.translate(0, screen.height);
    _lotus(canvas, screen);
    canvas.translate(0, screen.height);
    _sun(canvas, screen);
    canvas.restore();
  }

  /// How far the reel on screen has been watched (0–1), and how visible the bar
  /// is: it dims as a swipe begins and comes back, empty, as the next reel lands.
  (double, double) _watching() {
    const one = IntroConfig.swipeOneFrom;
    const two = IntroConfig.swipeTwoFrom;
    const length = IntroConfig.swipeSpan;
    final v = loop.value;

    for (final start in const [one, two]) {
      if (v >= start && v < start + length) {
        final p = (v - start) / length;
        return p < 0.5 ? (1.0, 1 - p * 2) : (0.0, p * 2 - 1);
      }
    }

    final lastEnd = v >= two + length
        ? two + length
        : v >= one + length
        ? one + length
        : two + length - 1;
    final nextStart = v < one
        ? one
        : v < two
        ? two
        : one + 1;
    return ((v - lastEnd) / (nextStart - lastEnd), 1.0);
  }

  /// A rising sun with rays turning slowly.
  void _sun(Canvas canvas, Rect screen) {
    final c = screen.center + Offset(0, -screen.height * 0.08);
    final radius = screen.width * 0.2;
    final colour = palette.isLight ? AppColors.saffron : AppColors.inkSubtleDark;

    canvas.drawCircle(
      c,
      radius * 2.1,
      Paint()
        ..shader = ui.Gradient.radial(c, radius * 2.1, [
          IntroShapes.fade(colour, 0.34),
          IntroShapes.fade(colour, 0),
        ]),
    );
    canvas.drawCircle(c, radius, Paint()..color = colour);

    final ray = Paint()
      ..strokeCap = StrokeCap.round
      ..strokeWidth = screen.width * 0.018
      ..color = IntroShapes.fade(colour, 0.75);
    const count = 16;
    final turning = turn() * math.pi * 2 / count;
    for (var i = 0; i < count; i++) {
      final angle = i / count * math.pi * 2 + turning;
      final d = Offset(math.cos(angle), math.sin(angle));
      canvas.drawLine(c + d * radius * 1.3, c + d * radius * (i.isEven ? 1.85 : 1.6), ray);
    }
  }

  /// A lotus that opens and closes.
  void _lotus(Canvas canvas, Rect screen) {
    final c = screen.center + Offset(0, -screen.height * 0.04);
    final open = 0.75 + 0.25 * swing();
    final colour = palette.isLight ? AppColors.saffronLight : AppColors.inkSubtleDark;
    final length = screen.width * 0.34 * open;

    for (var ring = 0; ring < 2; ring++) {
      for (var i = 0; i < 8; i++) {
        canvas.save();
        canvas.translate(c.dx, c.dy);
        canvas.rotate((i + ring * 0.5) / 8 * math.pi * 2);
        canvas.drawPath(
          IntroShapes.petal(length * (ring == 0 ? 1 : 0.7), screen.width * (ring == 0 ? 0.09 : 0.07)),
          Paint()..color = IntroShapes.fade(colour, ring == 0 ? 0.55 : 0.9),
        );
        canvas.restore();
      }
    }
  }

  /// Two lines of caption along the foot of the reel.
  void _caption(Canvas canvas, Rect screen) {
    final t = beat(1300, 1800, Curves.easeOut);
    final bar = Paint()
      ..strokeCap = StrokeCap.round
      ..strokeWidth = screen.width * 0.04;
    final left = screen.left + screen.width * 0.09;
    final y = screen.bottom - screen.height * 0.13;

    bar.color = IntroShapes.fade(AppColors.reelInk, 0.9 * t);
    canvas.drawLine(Offset(left, y), Offset(left + screen.width * 0.5 * t, y), bar);
    bar.color = IntroShapes.fade(AppColors.reelInk, 0.5 * t);
    canvas.drawLine(
      Offset(left, y + screen.height * 0.045),
      Offset(left + screen.width * 0.32 * t, y + screen.height * 0.045),
      bar,
    );
  }

  /// Like, comment, share down the right edge, each popping in; the heart is
  /// pressed once a turn and lets a few hearts go.
  void _rail(Canvas canvas, Rect screen) {
    final x = screen.right - screen.width * 0.14;
    final top = screen.center.dy - screen.height * 0.02;
    final step = screen.height * 0.12;
    final size = screen.width * 0.12;

    for (var i = 0; i < 3; i++) {
      final t = IntroShapes.pop(beat(1100 + i * 160, 1600 + i * 160));
      if (t <= 0) continue;
      final at = Offset(x, top + i * step);
      final body = Paint()..color = IntroShapes.fade(AppColors.reelInk, 0.95);

      switch (i) {
        case 0:
          _likeButton(canvas, at, size * t, screen);
        case 1:
          final bubble = RRect.fromRectAndRadius(
            Rect.fromCenter(center: at, width: size * 1.1 * t, height: size * 0.85 * t),
            Radius.circular(size * 0.3 * t),
          );
          canvas.drawRRect(bubble, body..style = PaintingStyle.stroke..strokeWidth = size * 0.14);
        default:
          final arrow = Path()
            ..moveTo(at.dx - size * 0.5 * t, at.dy + size * 0.05 * t)
            ..lineTo(at.dx + size * 0.5 * t, at.dy - size * 0.45 * t)
            ..lineTo(at.dx + size * 0.12 * t, at.dy + size * 0.5 * t)
            ..close();
          canvas.drawPath(arrow, body..style = PaintingStyle.stroke..strokeWidth = size * 0.14..strokeJoin = StrokeJoin.round);
      }
    }
  }

  /// The heart is outline, then filled at the moment it is pressed, bumping once.
  void _likeButton(Canvas canvas, Offset at, double size, Rect screen) {
    final press = span(0.38, 0.46, Curves.easeOut) * (1 - span(0.86, 0.92, Curves.linear));
    final bump = 1 + 0.35 * math.sin(span(0.38, 0.5, Curves.linear) * math.pi);
    final path = IntroShapes.heart(at, size * 1.15 * bump);

    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = size * 0.14
        ..strokeJoin = StrokeJoin.round
        ..color = IntroShapes.fade(AppColors.reelInk, 0.95 * (1 - press)),
    );
    canvas.drawPath(
      path,
      Paint()..color = IntroShapes.fade(palette.isLight ? AppColors.saffronLight : AppColors.reelInk, press),
    );

    for (var i = 0; i < IntroConfig.floatingHearts; i++) {
      final life = span(0.4 + i * 0.045, 0.78 + i * 0.045, Curves.easeOut);
      if (life <= 0 || life >= 1) continue;
      final drift = (i - 1) * screen.width * 0.07 * life + math.sin(life * math.pi * 2 + i) * screen.width * 0.02;
      final spot = at + Offset(drift - screen.width * 0.05, -screen.height * 0.32 * life);
      canvas.drawPath(
        IntroShapes.heart(spot, size * (0.5 - i * 0.07)),
        Paint()..color = IntroShapes.fade(AppColors.reelInk, 0.9 * (1 - life)),
      );
    }
  }

  /// The thin bar along the very bottom, filling as each reel plays.
  void _progress(Canvas canvas, Rect screen) {
    final y = screen.bottom - screen.height * 0.035;
    final width = screen.width * 0.82;
    final left = screen.left + screen.width * 0.09;
    final (watched, visible) = _watching();
    final fill = watched.clamp(0.0, 1.0);
    final bar = Paint()
      ..strokeCap = StrokeCap.round
      ..strokeWidth = screen.width * 0.02;

    bar.color = IntroShapes.fade(AppColors.reelInk, 0.28 * visible);
    canvas.drawLine(Offset(left, y), Offset(left + width, y), bar);
    bar.color = IntroShapes.fade(AppColors.reelInk, 0.95 * visible);
    canvas.drawLine(Offset(left, y), Offset(left + width * fill, y), bar);
  }
}
