import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/constants/intro_config.dart';
import '../chat/sakha_avatar.dart';
import 'intro_scene.dart';

/// The Ask Sakha page: a question arriving, three dots while Sakha thinks, and
/// the reply written out a few words at a time — over and over — with the
/// starter cards drifting by underneath. No letters are drawn: the bars stand for
/// words in any language.
class SakhaScene extends StatelessWidget {
  const SakhaScene({super.key, required this.enter, required this.loop});

  final Animation<double> enter;
  final Animation<double> loop;

  @override
  Widget build(BuildContext context) {
    return IntroCanvas(
      enter: enter,
      loop: loop,
      painter: _SakhaPainter.new,
      overlays: (context, side) => [
        Positioned(
          left: side * 0.035,
          top: side * _SakhaPainter.replyTop - side * 0.005,
          child: AnimatedBuilder(
            animation: enter,
            builder: (context, child) {
              final t = IntroConfig.beat(enter.value, 850, 1450, Curves.linear);
              return Opacity(
                opacity: t.clamp(0.0, 1.0),
                child: Transform.scale(scale: IntroShapes.pop(t), child: child),
              );
            },
            child: SakhaAvatar(size: side * 0.17, glow: true),
          ),
        ),
      ],
    );
  }
}

class _SakhaPainter extends IntroScenePainter {
  _SakhaPainter(Animation<double> enter, Animation<double> loop, IntroPalette palette)
    : super(enter: enter, loop: loop, palette: palette);

  // Layout, as shares of the picture's side.
  static const double askTop = 0.07;
  static const double askBottom = 0.27;
  static const double replyTop = 0.36;
  static const double replyBottom = 0.7;
  static const double chipTop = 0.8;
  static const double chipHeight = 0.085;
  static const List<double> _chipWidths = [0.3, 0.22, 0.34, 0.26];
  static const double _chipGap = 0.035;

  /// How much of the row, at each end, fades out.
  static const double _chipFade = 0.12;
  static const List<double> _replyLengths = [1, 0.92, 0.5];

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width;
    _blob(canvas, s);
    _question(canvas, s);
    _reply(canvas, s);
    _starters(canvas, s);
  }

  Rect _rect(double s, double left, double top, double right, double bottom) =>
      Rect.fromLTRB(left * s, top * s, right * s, bottom * s);

  void _blob(Canvas canvas, double s) {
    final t = beat(0, 900, Curves.easeOut);
    canvas.drawCircle(
      Offset(s * 0.5, s * 0.46),
      s * (0.3 + 0.17 * t) * (1 + 0.02 * swing()),
      Paint()..color = IntroShapes.fade(palette.soft, 0.5 * t),
    );
  }

  /// A bubble that grows out of one of its corners.
  void _bubble(
    Canvas canvas,
    Rect rect, {
    required Alignment from,
    required double t,
    required Paint fill,
    Paint? edge,
  }) {
    if (t <= 0) return;
    final radius = Radius.circular(rect.height * 0.2);
    final anchor = from.alongSize(rect.size) + rect.topLeft;

    canvas.save();
    canvas.translate(anchor.dx, anchor.dy);
    canvas.scale(IntroShapes.pop(t));
    canvas.translate(-anchor.dx, -anchor.dy);
    final shape = RRect.fromRectAndRadius(rect, radius);
    canvas.drawRRect(shape, fill);
    if (edge != null) canvas.drawRRect(shape, edge);
    canvas.restore();
  }

  void _bar(Canvas canvas, double s, double left, double y, double length, Color color) {
    if (length <= 0) return;
    canvas.drawLine(
      Offset(left * s, y * s),
      Offset((left + length) * s, y * s),
      Paint()
        ..strokeCap = StrokeCap.round
        ..strokeWidth = s * 0.022
        ..color = color,
    );
  }

  /// What the reader asked: a filled bubble on the right.
  void _question(Canvas canvas, double s) {
    final rect = _rect(s, 0.4, askTop, 0.96, askBottom);
    _bubble(
      canvas,
      rect,
      from: Alignment.bottomRight,
      t: beat(250, 850, Curves.linear),
      fill: Paint()..color = palette.accent,
    );

    final write = beat(650, 1100, Curves.easeInOut);
    final ink = IntroShapes.fade(palette.onAccent, 0.88);
    _bar(canvas, s, 0.45, 0.13, 0.43 * write, ink);
    _bar(canvas, s, 0.45, 0.2, 0.28 * write, ink);
  }

  /// Sakha's answer. For the first part of every turn three dots wait; then the
  /// lines fill in, each in steps of a few words, with a cursor at the tip; and
  /// the whole thing dims away at the end of the turn so it can begin again.
  /// The dots come in out of that empty bubble, so a turn starts on exactly what
  /// the last one ended on and the loop has no seam.
  void _reply(Canvas canvas, double s) {
    final rect = _rect(s, 0.26, replyTop, 0.96, replyBottom);
    _bubble(
      canvas,
      rect,
      from: Alignment.bottomLeft,
      t: beat(1000, 1600, Curves.linear),
      fill: Paint()..color = palette.paper,
      edge: Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = IntroShapes.fade(palette.line, 0.6),
    );

    final ready = beat(1500, 1800, Curves.easeOut);
    if (ready <= 0) return;

    final dim = 1 - span(0.9, 1, Curves.linear);
    final ink = IntroShapes.fade(palette.muted, 0.7 * ready * dim);

    final waiting = span(0, 0.05, Curves.linear) * (1 - span(0.1, 0.16, Curves.linear));
    if (waiting > 0) _dots(canvas, s, ready * waiting);

    const lines = IntroConfig.replyLines;
    const steps = IntroConfig.streamSteps;
    final written = span(0.14, 0.64, Curves.linear) * lines;
    const max = 0.6;

    for (var k = 0; k < lines; k++) {
      final share = (written - k).clamp(0.0, 1.0);
      final stepped = (share * steps).floor() / steps;
      final y = replyTop + 0.075 + k * 0.085;
      final length = max * _replyLengths[k] * stepped;
      _bar(canvas, s, 0.31, y, length, ink);

      final typing = share > 0 && share < 1;
      if (typing && dim > 0.99) {
        final blink = swing(times: 5);
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromCenter(
              center: Offset((0.31 + length + 0.02) * s, y * s),
              width: s * 0.012,
              height: s * 0.046,
            ),
            Radius.circular(s * 0.006),
          ),
          Paint()..color = IntroShapes.fade(palette.accent, 0.4 + 0.6 * blink),
        );
      }
    }
  }

  void _dots(Canvas canvas, double s, double visible) {
    final y = (replyTop + 0.075) * s;
    for (var i = 0; i < 3; i++) {
      final hop = math.max(0.0, math.sin(turn(phase: -i * 0.03, times: 5) * math.pi * 2));
      canvas.drawCircle(
        Offset((0.33 + i * 0.045) * s, y - hop * s * 0.014),
        s * 0.014,
        Paint()..color = IntroShapes.fade(palette.muted, 0.75 * visible),
      );
    }
  }

  /// Starter cards sliding sideways along the foot of the picture. They repeat
  /// at exactly the length of one set, so the drift never has an end.
  void _starters(Canvas canvas, double s) {
    final t = beat(1700, 2200, Curves.easeOut);
    if (t <= 0) return;

    final period = _chipWidths.fold<double>(0, (sum, w) => sum + w + _chipGap);
    final clip = _rect(s, 0.04, chipTop - 0.02, 0.96, chipTop + chipHeight + 0.02);

    // The row has a layer to itself so its two ends can be faded out: a card
    // leaves and arrives softly rather than being cut off by an edge.
    canvas.saveLayer(clip, Paint());
    final fill = Paint()..color = IntroShapes.fade(palette.paper, t);
    final edge = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = IntroShapes.fade(palette.line, 0.7 * t);

    var x = 0.04 - turn() * period;
    for (var round = 0; round < 3; round++) {
      for (final width in _chipWidths) {
        final pill = RRect.fromRectAndRadius(
          _rect(s, x, chipTop, x + width, chipTop + chipHeight),
          Radius.circular(s * chipHeight / 2),
        );
        canvas.drawRRect(pill, fill);
        canvas.drawRRect(pill, edge);
        _bar(canvas, s, x + 0.04, chipTop + chipHeight / 2, width - 0.08, IntroShapes.fade(palette.muted, 0.45 * t));
        x += width + _chipGap;
      }
    }
    IntroShapes.fadeEnds(canvas, clip, _chipFade, palette.ink);
    canvas.restore();
  }
}
