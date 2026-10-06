import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../common/animations.dart';
import '../dashboard/mala_ring.dart';

/// The thing that is tapped: the bead ring on a soft round panel, with a ring
/// that opens outward and fades on every tap, so a tap is felt as well as
/// counted.
///
/// [pulse] is the running tap count — a changed value restarts the ripple,
/// and zero means nothing has been tapped yet so none is drawn.
class ChantDisc extends StatelessWidget {
  const ChantDisc({
    super.key,
    required this.beadsInRound,
    required this.roundsCompleted,
    required this.roundsLabel,
    required this.beadsPerRound,
    required this.pulse,
    required this.onTap,
  });

  final int beadsInRound;
  final int roundsCompleted;
  final String roundsLabel;
  final int beadsPerRound;
  final int pulse;
  final VoidCallback onTap;

  /// The largest the disc grows; on a narrower screen it takes the width it
  /// is given instead.
  static const double _maxSize = 304;
  static const double _inset = 12;
  static const double _rippleStart = 0.9;
  static const double _rippleGrow = 0.1;
  static const double _rippleOpacity = 0.5;

  @override
  Widget build(BuildContext context) {
    final isLight = context.theme.brightness == Brightness.light;

    return LayoutBuilder(
      builder: (context, constraints) {
        final size = constraints.maxWidth < _maxSize ? constraints.maxWidth : _maxSize;
        return _disc(context, size, isLight);
      },
    );
  }

  Widget _disc(BuildContext context, double size, bool isLight) {
    return TapScale(
      onTap: onTap,
      scale: 0.985,
      child: SizedBox(
        width: size,
        height: size,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Padding(
              padding: const EdgeInsets.all(_inset),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: isLight
                        ? const [AppColors.white, AppColors.panelFrom, AppColors.panelTo]
                        : const [AppColors.panelFromDark, AppColors.panelToDark],
                    stops: isLight ? const [0.0, 0.62, 1.0] : const [0.0, 1.0],
                  ),
                  border: Border.all(color: context.colors.outlineVariant),
                ),
                child: const SizedBox.expand(),
              ),
            ),
            if (pulse > 0)
              IgnorePointer(
                child: TweenAnimationBuilder<double>(
                  key: ValueKey(pulse),
                  tween: Tween(begin: 0, end: 1),
                  duration: AppDurations.slow,
                  curve: Curves.easeOut,
                  builder: (context, t, _) => Opacity(
                    opacity: (1 - t) * _rippleOpacity,
                    child: Transform.scale(
                      scale: _rippleStart + _rippleGrow * t,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: context.colors.primary, width: 2),
                        ),
                        child: const SizedBox.expand(),
                      ),
                    ),
                  ),
                ),
              ),
            MalaRing(
              beadsInRound: beadsInRound,
              roundsCompleted: roundsCompleted,
              roundsLabel: roundsLabel,
              beadsPerRound: beadsPerRound,
              size: size - _inset * 2,
            ),
          ],
        ),
      ),
    );
  }
}
