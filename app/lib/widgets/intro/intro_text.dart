import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../core/constants/intro_config.dart';

/// A page's title, arriving a word at a time: each word rises into place out of
/// a blur, a little after the one before. It is one `Text` to a screen reader,
/// read whole, so the staging costs nothing for someone not watching it.
///
/// A title that needs more than one line is broken evenly (see
/// [balancedWidth]), so it never ends on a lonely word.
class IntroTitle extends StatelessWidget {
  const IntroTitle({super.key, required this.text, required this.enter, required this.style});

  final String text;

  /// The page's entrance (0 → 1, once).
  final Animation<double> enter;
  final TextStyle style;

  @override
  Widget build(BuildContext context) {
    final words = text.trim().split(RegExp(r'\s+'));
    final gap = (style.fontSize ?? 28) * IntroConfig.wordGap;

    // The step between words shrinks for a long title, so the last word never
    // starts later than the title's span allows.
    final step = words.length < 2
        ? 0
        : math.min(
            IntroConfig.titleStepMs,
            IntroConfig.titleSpanMs ~/ (words.length - 1),
          );

    return Semantics(
      header: true,
      label: text,
      excludeSemantics: true,
      // Outside the animation, so the words are measured when the title's width
      // is known and not on every frame of its entrance.
      child: LayoutBuilder(
        builder: (context, constraints) {
          final limit = constraints.maxWidth;
          final width = math.min(
            limit,
            balancedWidth([for (final word in words) _widthOf(context, word)], gap, limit) +
                IntroConfig.balancePad,
          );
          return ConstrainedBox(
            constraints: BoxConstraints(maxWidth: width),
            child: AnimatedBuilder(
              animation: enter,
              builder: (context, _) {
                return Wrap(
                  alignment: WrapAlignment.center,
                  spacing: gap,
                  children: [
                    for (var i = 0; i < words.length; i++)
                      _Word(
                        text: words[i],
                        style: style,
                        progress: IntroConfig.beat(
                          enter.value,
                          IntroConfig.titleFromMs + i * step,
                          IntroConfig.titleFromMs + i * step + IntroConfig.wordMs,
                        ),
                      ),
                  ],
                );
              },
            ),
          );
        },
      ),
    );
  }

  /// How wide [word] is once drawn: set the way a `Text` of this style sets it
  /// (the default style it inherits, the system's bold and text scale, the
  /// locale), so the widths agree with what the `Wrap` will lay out.
  double _widthOf(BuildContext context, String word) {
    var resolved = style.inherit ? DefaultTextStyle.of(context).style.merge(style) : style;
    if (MediaQuery.boldTextOf(context)) {
      resolved = resolved.merge(const TextStyle(fontWeight: FontWeight.bold));
    }
    final painter = TextPainter(
      text: TextSpan(text: word, style: resolved),
      textDirection: Directionality.of(context),
      textScaler: MediaQuery.textScalerOf(context),
      locale: Localizations.maybeLocaleOf(context),
    )..layout();
    final width = painter.width;
    painter.dispose();
    return width;
  }
}

/// The narrowest width, no wider than [limit], at which words of the given
/// [widths] still fall into as many lines as they do at [limit] — what CSS calls
/// `text-wrap: balance`. Held to it, a title that would have run on to a long
/// first line and a single word is two lines of nearly one length.
///
/// Lines are broken the way `Wrap` breaks them: a word joins the line while it
/// fits, with [gap] between words. A title that fits on one line is left alone.
double balancedWidth(List<double> widths, double gap, double limit) {
  if (widths.length < 2 || !limit.isFinite) return limit;

  final lines = _lineCount(widths, gap, limit);
  var narrow = widths.reduce(math.max);
  if (lines < 2 || narrow >= limit) return limit;

  // Wider never means more lines, so squeeze: keep a width that is wide enough
  // and one that is too narrow, and halve the space between them.
  var wide = limit;
  while (wide - narrow > 0.5) {
    final middle = (narrow + wide) / 2;
    if (_lineCount(widths, gap, middle) > lines) {
      narrow = middle;
    } else {
      wide = middle;
    }
  }
  return wide;
}

int _lineCount(List<double> widths, double gap, double max) {
  var lines = 1;
  var run = widths.first;
  for (final width in widths.skip(1)) {
    if (run + gap + width <= max) {
      run += gap + width;
    } else {
      lines++;
      run = width;
    }
  }
  return lines;
}

class _Word extends StatelessWidget {
  const _Word({required this.text, required this.style, required this.progress});

  final String text;
  final TextStyle style;
  final double progress;

  @override
  Widget build(BuildContext context) {
    Widget word = Text(text, style: style);
    if (progress >= 1) return word;

    final blur = (1 - progress) * IntroConfig.wordBlur;
    if (blur > 0.1) {
      word = ImageFiltered(
        imageFilter: ui.ImageFilter.blur(sigmaX: blur, sigmaY: blur, tileMode: TileMode.decal),
        child: word,
      );
    }
    return Opacity(
      opacity: progress,
      child: Transform.translate(
        offset: Offset(0, (1 - progress) * IntroConfig.wordRise),
        child: word,
      ),
    );
  }
}

/// A block that fades and rises in between two moments of a page's entrance —
/// the line of text under the title.
class IntroReveal extends StatelessWidget {
  const IntroReveal({
    super.key,
    required this.enter,
    required this.child,
    this.fromMs = IntroConfig.bodyFromMs,
    this.toMs = IntroConfig.bodyToMs,
  });

  final Animation<double> enter;
  final Widget child;
  final int fromMs;
  final int toMs;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: enter,
      child: child,
      builder: (context, child) {
        final t = IntroConfig.beat(enter.value, fromMs, toMs);
        return Opacity(
          opacity: t,
          child: Transform.translate(
            offset: Offset(0, (1 - t) * IntroConfig.bodyRise),
            child: child,
          ),
        );
      },
    );
  }
}
