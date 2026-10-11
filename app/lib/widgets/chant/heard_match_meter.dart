import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';

/// How near what was heard came to the mantra, as a bar with a tick at the
/// mark it had to reach. The numbers sit beside it in words (the caller's
/// text), so this carries no meaning of its own and is hidden from a screen
/// reader.
class HeardMatchMeter extends StatelessWidget {
  const HeardMatchMeter({super.key, required this.match, this.needed});

  /// 0–1.
  final double match;

  /// 0–1, or null when there is no mark to draw.
  final double? needed;

  static const double _trackHeight = 6;
  static const double _tickWidth = 2;
  static const double _tickHeight = 12;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final shown = match.clamp(0.0, 1.0);

    return ExcludeSemantics(
      child: SizedBox(
        height: _tickHeight,
        child: LayoutBuilder(
          builder: (context, box) {
            return Stack(
              alignment: Alignment.centerLeft,
              clipBehavior: Clip.none,
              children: [
                Container(
                  height: _trackHeight,
                  decoration: BoxDecoration(
                    color: colors.outlineVariant,
                    borderRadius: const BorderRadius.all(Radius.circular(AppRadius.pill)),
                  ),
                ),
                TweenAnimationBuilder<double>(
                  tween: Tween(end: shown),
                  duration: AppDurations.normal,
                  curve: Curves.easeOutCubic,
                  builder: (context, value, _) => Container(
                    width: box.maxWidth * value,
                    height: _trackHeight,
                    decoration: BoxDecoration(
                      color: colors.primary,
                      borderRadius: const BorderRadius.all(Radius.circular(AppRadius.pill)),
                    ),
                  ),
                ),
                if (needed != null)
                  Positioned(
                    left: (box.maxWidth * needed!.clamp(0.0, 1.0) - _tickWidth / 2).clamp(0.0, box.maxWidth - _tickWidth),
                    child: Container(
                      width: _tickWidth,
                      height: _tickHeight,
                      color: colors.onSurface,
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}
