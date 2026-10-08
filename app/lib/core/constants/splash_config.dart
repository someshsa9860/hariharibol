import 'package:flutter/animation.dart';

/// Every number behind the launch animation, in one place.
///
/// The animation is a single timeline, and each piece of it is a *beat* — an
/// [Interval] built from a start and an end in milliseconds on that timeline. Writing them as
/// milliseconds rather than as fractions is the point: "the sheen crosses once
/// the logo is in" is readable, `Interval(0.5, 0.8)` is not.
/// Retiming a piece is changing two numbers here and nothing else.
abstract final class SplashConfig {
  /// The whole timeline, including the rest at the end. The router is held on
  /// the splash for exactly this long, so it is also how long a cold start
  /// waits — keep it short.
  static const int totalMs = 2600;

  /// With the system's reduce-motion setting on there is no animation, only the
  /// finished composition, held for this long so it can still be recognised.
  static const Duration reducedMotionHold = Duration(milliseconds: 700);

  static Duration get total => const Duration(milliseconds: totalMs);

  // ── Beats ──────────────────────────────────────────────────────────────────

  /// The warm light behind the mark comes up and then keeps breathing.
  static final Interval glow = _beat(0, 1000, Curves.easeOut);

  /// The logo comes into focus: it grows from a little small, rises into place
  /// and its blur clears.
  static final Interval focus = _beat(100, 1300, Curves.easeOutCubic);

  /// The logo is uncovered outward from the eye of the feather, in a circle with
  /// a soft edge, until it has reached the farthest ink.
  static final Interval bloom = _beat(100, 1400, Curves.easeInOut);

  /// One sheen crosses the logo, corner to corner, once it is all there.
  static final Interval glint = _beat(1300, 2100, Curves.easeInOut);

  /// The tagline closes the sequence, its letterspacing tightening as it fades
  /// in.
  static final Interval tagline = _beat(1650, 2300, Curves.easeOutCubic);

  // ── Ripples ────────────────────────────────────────────────────────────────

  /// Rings spreading from the eye of the feather, the way a sound does — it is a
  /// chanting app. Each one starts [rippleStaggerMs] after the one before.
  static const int rippleCount = 3;
  static const int rippleBeginMs = 300;
  static const int rippleStaggerMs = 320;
  static const int rippleLifeMs = 1500;

  /// Ring radius, as a fraction of the screen's shorter side, at birth and at
  /// the moment it has faded out.
  static const double rippleFromRadius = 0.16;
  static const double rippleToRadius = 0.62;
  static const double rippleStroke = 1;
  static const double rippleAlpha = 0.34;

  // ── Backdrop ───────────────────────────────────────────────────────────────

  /// The two soft lights behind the mark, as a fraction of the shorter side.
  static const double glowRadius = 0.78;
  static const double driftRadius = 0.56;

  /// Strength of each light. Dark mode gets far less: a light on black reads as
  /// grey fog long before it reads as glow, and the screen there is meant to
  /// be nearly all black.
  static const double glowAlpha = 0.30;
  static const double driftAlpha = 0.12;
  static const double glowAlphaDark = 0.13;
  static const double driftAlphaDark = 0.04;

  /// How far the second light orbits, and how many times it goes round during
  /// the timeline.
  static const double driftOrbit = 0.2;
  static const double driftTurns = 0.6;

  /// How much the main light swells and falls back.
  static const double breathe = 0.06;

  // ── The mark ───────────────────────────────────────────────────────────────

  /// Width and height of the logo on screen at most. The picture is a square
  /// that fills its frame, so it is the whole of the composition; on a screen
  /// too narrow for it, it shrinks to fit inside the side margins.
  static const double logoWidth = 300;

  /// How far above the vertical centre it sits. The tagline is at the bottom
  /// and the picture is heavier below its middle, so the optical centre is
  /// higher than the maths; this is a fraction of the half-height.
  static const double logoLift = 0.08;

  /// The heart of the feather's eye, as a fraction of the logo's width and
  /// height. The light behind the logo, the rings and the reveal all spread
  /// from here. It is measured off `assets/hariharibol_trprt.png`, so a new
  /// picture means measuring it again.
  static const Offset logoEye = Offset(0.635, 0.346);

  /// Where the logo starts: this much smaller, this far below its place
  /// (logical pixels), and blurred by this Gaussian sigma.
  static const double logoFromScale = 0.9;
  static const double logoRise = 16;
  static const double logoBlur = 10;

  /// The reveal, as fractions of the logo's width: how far the farthest ink is
  /// from the eye, and how soft the circle's edge is.
  static const double bloomReach = 0.83;
  static const double bloomEdge = 0.3;

  /// The sheen: the width of its band as a fraction of the corner-to-corner run
  /// it travels, and its opacity at the centre of the band.
  static const double glintWidth = 0.3;
  static const double glintAlpha = 0.45;

  // ── Tagline ────────────────────────────────────────────────────────────────

  static const double taglineFromSpacing = 9;
  static const double taglineToSpacing = 2.2;
  static const double taglineBlur = 4;

  /// How far up from the bottom edge, past the safe area.
  static const double taglineBottom = 48;

  // ── Plumbing ───────────────────────────────────────────────────────────────

  static Interval _beat(int beginMs, int endMs, Curve curve) {
    return Interval(beginMs / totalMs, endMs / totalMs, curve: curve);
  }
}
