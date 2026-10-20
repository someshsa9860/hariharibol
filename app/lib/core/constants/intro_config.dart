import 'package:flutter/animation.dart';

/// Every number behind the welcome pages, in one place.
///
/// Each page has two clocks. The **entrance** runs once, when the page becomes
/// the one on screen, and everything arrives on it in order: the picture, then
/// the title word by word, then the line under it. The **loop** runs for as long
/// as the page is there and keeps the picture alive — a bead running round a
/// mala, a page turning, a reply being written.
///
/// Both are plain 0–1 controllers. A piece of a drawing says *when*, in
/// milliseconds on the entrance, through [beat] — `beat(t, 400, 900)` is
/// "between 0.4 s and 0.9 s" — so retiming a piece is changing two numbers, not
/// working out a fraction.
abstract final class IntroConfig {
  /// The pages, in order. The scenes and the texts are matched to this by index.
  static const int pageCount = 5;

  // ── The two clocks ─────────────────────────────────────────────────────────

  /// The entrance of one page, start to finish.
  static const int enterMs = 2200;
  static const Duration enter = Duration(milliseconds: enterMs);

  /// One turn of the loop. Long and slow: this is a place to be still in, not a
  /// slot machine.
  static const int loopMs = 6400;
  static const Duration loop = Duration(milliseconds: loopMs);

  /// The loop value a page holds still at with the system's reduce-motion
  /// setting on — the pose in which each picture reads best.
  static const double stillLoop = 0.18;

  /// [t] (0–1 on the entrance) as a 0–1 progress between [fromMs] and [toMs].
  static double beat(double t, int fromMs, int toMs, [Curve curve = Curves.easeOutCubic]) {
    final ms = t * enterMs;
    if (ms <= fromMs) return 0;
    if (ms >= toMs) return 1;
    return curve.transform((ms - fromMs) / (toMs - fromMs));
  }

  // ── The text of a page ─────────────────────────────────────────────────────

  /// The title comes in a word at a time. Word `i` starts [titleFromMs] +
  /// `i × step` after the page arrives, where the step is squeezed so the last
  /// word never starts after [titleSpanMs] — a long title is not slower than a
  /// short one by much.
  static const int titleFromMs = 380;
  static const int titleSpanMs = 520;
  static const int titleStepMs = 130;
  static const int wordMs = 620;

  /// How far a word rises into its place and how blurred it starts.
  static const double wordRise = 18;
  static const double wordBlur = 7;

  /// The space between two words of the title, as a share of its font size, and
  /// the room added to the width the title is balanced to so that rounding in
  /// the text's own measuring can never push a word onto an extra line.
  static const double wordGap = 0.28;
  static const double balancePad = 2;

  /// The line under the title.
  static const int bodyFromMs = 1050;
  static const int bodyToMs = 1650;
  static const double bodyRise = 14;

  // ── Moving between pages ───────────────────────────────────────────────────

  /// How fast the picture travels against the finger, as a share of the page
  /// width, and the text — different speeds are what make a pager feel deep.
  static const double sceneParallax = 0.42;
  static const double textParallax = 0.14;

  /// A picture shrinks and fades a little as it leaves.
  static const double sceneLeaveScale = 0.16;

  /// The change of page by the Next button.
  static const Duration pageTurn = Duration(milliseconds: 620);
  static const Curve pageTurnCurve = Curves.easeInOutCubicEmphasized;

  /// The button changing its words on the last page. The old label is gone by
  /// the half-way point of the swap and the new one arrives in the second half,
  /// so the two are never on top of each other, each half-faded; a label also
  /// settles from [labelScale] of its size.
  static const Curve labelSwap = Interval(0.5, 1);
  static const double labelScale = 0.92;

  // ── The ground behind the pages ────────────────────────────────────────────

  /// A page of the backdrop's drifting motes, and the clock they rise on.
  static const int moteCount = 22;
  static const int moteMs = 26000;
  static const double moteMinRadius = 1.2;
  static const double moteMaxRadius = 3.4;
  static const double moteAlpha = 0.34;
  static const double moteAlphaDark = 0.2;

  /// How far the backdrop's lights travel with the pages, and their strength.
  static const double backdropParallax = 0.22;
  static const double glowRadius = 0.85;
  static const double glowAlpha = 0.26;
  static const double glowAlphaDark = 0.11;

  // ── The page indicator ─────────────────────────────────────────────────────

  static const double dotSize = 8;
  static const double dotGap = 14;
  static const double dotAlpha = 0.55;

  // ── Layout ─────────────────────────────────────────────────────────────────

  /// The picture's share of the height left once the text is placed, and the
  /// widest it grows on a tablet.
  static const double sceneShare = 0.54;
  static const double sceneMaxSide = 420;
  static const double textMaxWidth = 440;

  // ── The welcome picture ────────────────────────────────────────────────────

  static const int rayCount = 40;
  static const int petalCount = 8;
  static const int rippleCount = 3;

  /// Share of the picture's side the feather takes.
  static const double featherShare = 0.36;

  // ── The reading picture ────────────────────────────────────────────────────

  static const int verseLines = 5;

  /// Where in the loop the page turns, from and to.
  static const double flipFrom = 0.52;
  static const double flipTo = 0.84;

  // ── The chanting picture ───────────────────────────────────────────────────

  static const int beadCount = 27;

  /// How many beads of light follow the running one.
  static const double beadTrail = 6;
  static const int soundBars = 5;

  // ── Ask Sakha picture ──────────────────────────────────────────────────────

  static const int replyLines = 3;

  /// Steps a streaming line grows in, so it arrives in chunks like words.
  static const int streamSteps = 9;

  // ── The reels picture ──────────────────────────────────────────────────────

  /// The tilt of the phone, in radians, and how far it floats.
  static const double phoneTilt = -0.07;
  static const double phoneFloat = 0.018;

  /// The two swipes in one turn of the loop: when each starts and how long it
  /// takes, as shares of the loop.
  static const double swipeOneFrom = 0.22;
  static const double swipeTwoFrom = 0.72;
  static const double swipeSpan = 0.14;

  /// Hearts that float up when the reel is liked.
  static const int floatingHearts = 3;
}
