import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../common/animations.dart';
import '../common/app_image.dart';
import '../dashboard/mala_ring.dart';
import 'chant_disc_count.dart';

/// The thing that is tapped: the bead ring on a soft round panel, with a ring
/// that opens outward and fades on every tap, so a tap is felt as well as
/// counted.
///
/// [pulse] is the running tap count — a changed value restarts the ripple,
/// and zero means nothing has been tapped yet so none is drawn.
///
/// With a [pictureUrl] the deity fills the middle of the ring at full
/// strength and the count moves to a line under it ([ChantDiscCount]); without
/// one the count is the middle, as it always was. [onOpenPicture] puts an
/// expand button on the picture.
class ChantDisc extends StatelessWidget {
  const ChantDisc({
    super.key,
    required this.beadsInRound,
    required this.roundsCompleted,
    required this.roundsLabel,
    required this.beadsPerRound,
    required this.pulse,
    required this.onTap,
    this.pictureUrl,
    this.pictureKey,
    this.onOpenPicture,
    this.openPictureTooltip,
  });

  final int beadsInRound;
  final int roundsCompleted;
  final String roundsLabel;
  final int beadsPerRound;
  final int pulse;
  final VoidCallback onTap;

  /// The deity, in the middle of the ring.
  final String? pictureUrl;
  final String? pictureKey;

  /// Opens the picture full screen. The button is drawn only when this is given.
  final VoidCallback? onOpenPicture;
  final String? openPictureTooltip;

  /// The largest the disc grows; on a narrower screen it takes the width it
  /// is given instead.
  static const double _maxSize = 304;
  static const double _inset = 12;

  /// The picture's share of the disc: as much as fits inside the beads with a
  /// small gap, so the deity is as large as the ring allows.
  static const double _pictureShare = 0.78;

  /// The expand button is a 48-point target; its centre sits this far inside
  /// the picture's rim so the button does not stick out over the beads.
  static const double _expandButton = 48;
  static const double _expandInRim = 20;
  static const double _expandWash = 0.72;
  static const double _rippleStart = 0.9;
  static const double _rippleGrow = 0.1;
  static const double _rippleOpacity = 0.5;

  bool get _hasPicture => pictureUrl != null && pictureUrl!.isNotEmpty;

  @override
  Widget build(BuildContext context) {
    final isLight = context.theme.brightness == Brightness.light;

    return LayoutBuilder(
      builder: (context, constraints) {
        final size = constraints.maxWidth < _maxSize ? constraints.maxWidth : _maxSize;
        final disc = _disc(context, size, isLight);
        if (!_hasPicture) return disc;

        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            disc,
            const SizedBox(height: AppSpacing.md),
            SizedBox(
              width: size,
              child: ChantDiscCount(
                roundsCompleted: roundsCompleted,
                roundsLabel: roundsLabel,
                beadsInRound: beadsInRound,
                beadsPerRound: beadsPerRound,
              ),
            ),
          ],
        );
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
            if (_hasPicture) _picture(context, size * _pictureShare),
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
              showCount: !_hasPicture,
            ),
            if (_hasPicture && onOpenPicture != null) _expandButtonAt(context, size),
          ],
        ),
      ),
    );
  }

  /// The deity, drawn as it is — not faded — in a circle with a hairline on its
  /// rim. A tap on it is a tap on the disc, so it takes none of its own.
  Widget _picture(BuildContext context, double diameter) {
    return IgnorePointer(
      child: DecoratedBox(
        position: DecorationPosition.foreground,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: context.colors.outlineVariant),
        ),
        child: ClipOval(
          child: AppImage(
            url: pictureUrl,
            cacheKey: pictureKey,
            width: diameter,
            height: diameter,
            borderRadius: BorderRadius.zero,
          ),
        ),
      ),
    );
  }

  /// On the picture's lower right rim, where a thumb on the ring rarely rests.
  Widget _expandButtonAt(BuildContext context, double size) {
    final fromCentre = size * _pictureShare / 2 - _expandInRim;
    final offset = size / 2 + fromCentre * math.sqrt1_2 - _expandButton / 2;

    return Positioned(
      left: offset,
      top: offset,
      child: IconButton(
        onPressed: onOpenPicture,
        tooltip: openPictureTooltip,
        icon: const Icon(Icons.fullscreen_rounded),
        style: IconButton.styleFrom(
          backgroundColor: context.colors.surface.withValues(alpha: _expandWash),
          foregroundColor: context.colors.onSurface,
        ),
      ),
    );
  }
}
