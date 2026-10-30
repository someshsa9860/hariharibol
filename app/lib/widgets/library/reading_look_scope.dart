import 'package:flutter/material.dart';

import '../../core/theme/reading_themes.dart';

/// Lays the reading page's look over everything inside it: the colours of the
/// app theme (the app bar and the player bar with them), the line spacing of
/// the verse text, and the warm wash and dim shade on top. The overlays ignore
/// touches, so they never block the page.
class ReadingLookScope extends StatelessWidget {
  const ReadingLookScope({
    super.key,
    required this.look,
    required this.lineScale,
    required this.warmTint,
    required this.dim,
    required this.child,
  });

  final ReadingLook look;
  final double lineScale;

  /// 0 to 1: how far the warm wash is turned up.
  final double warmTint;

  /// 0 to 1: how far the page is dimmed.
  final double dim;

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: readingLookTheme(look, Theme.of(context)),
      child: ReadingLayout(
        lineScale: lineScale,
        child: Stack(
          fit: StackFit.expand,
          children: [
            child,
            if (warmTint > 0)
              IgnorePointer(
                child: ColoredBox(
                  color: readingWarmWash.withValues(alpha: readingWarmWashMax * warmTint),
                ),
              ),
            if (dim > 0)
              IgnorePointer(
                child: ColoredBox(
                  color: readingDimShade.withValues(alpha: readingDimMax * dim),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
