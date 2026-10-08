import 'dart:ui' show ImageFilter, lerpDouble;

import 'package:flutter/material.dart';

import '../../core/constants/splash_config.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';

/// The line that closes the launch sequence.
///
/// It arrives by tightening: the letters start spread wide and blurred and draw
/// in to the eyebrow's own tracking as they sharpen. The same capitals-from-
/// ordinary-case mapping as [Eyebrow], so the translation is not written
/// shouting.
class SplashTagline extends StatelessWidget {
  const SplashTagline({super.key, required this.progress});

  final Animation<double> progress;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context).splashTagline.toUpperCase();
    final base = AppTypography.eyebrow(context);

    return AnimatedBuilder(
      animation: progress,
      builder: (context, _) {
        final t = SplashConfig.tagline.transform(progress.value);
        final blur = (1 - t) * SplashConfig.taglineBlur;

        Widget line = Text(
          text,
          textAlign: TextAlign.center,
          style: base.copyWith(
            letterSpacing: lerpDouble(
              SplashConfig.taglineFromSpacing,
              SplashConfig.taglineToSpacing,
              t,
            ),
          ),
        );

        if (blur > 0.05) {
          line = ImageFiltered(
            imageFilter: ImageFilter.blur(sigmaX: blur, sigmaY: blur, tileMode: TileMode.decal),
            child: line,
          );
        }

        return Opacity(opacity: t.clamp(0.0, 1.0), child: line);
      },
    );
  }
}
