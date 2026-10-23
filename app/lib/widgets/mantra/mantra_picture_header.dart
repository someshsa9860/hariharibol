import 'package:flutter/material.dart';

import '../../core/constants/own_mantra_config.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/mantra.dart';
import '../common/app_image.dart';
import '../common/motif.dart';

/// The picture across the top of a mantra the reader added, with the word
/// "Private" on it. It is the mantra's own picture, else its deity's, else its
/// guru's, else a drawn motif — never a grey box.
class MantraPictureHeader extends StatelessWidget {
  const MantraPictureHeader({super.key, required this.mantra});

  final Mantra mantra;

  /// The first picture there is, and the key to cache it under.
  (String, String)? get _picture {
    final own = mantra.imageUrl;
    if (own != null && own.isNotEmpty) return (own, mantra.imageCacheKey ?? own);
    final deity = mantra.deity;
    if (deity?.imageUrl case final image? when image.isNotEmpty) return (image, 'deity-${deity!.id}');
    final guru = mantra.guru;
    if (guru?.imageUrl case final image? when image.isNotEmpty) return (image, 'guru-${guru!.id}');
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final picture = _picture;
    final isLight = context.theme.brightness == Brightness.light;

    return ClipRRect(
      borderRadius: AppRadius.lgAll,
      child: AspectRatio(
        aspectRatio: OwnMantraConfig.pictureAspect,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (picture != null)
              AppImage(url: picture.$1, cacheKey: picture.$2, borderRadius: BorderRadius.zero)
            else
              MotifPanel(
                motif: Motif.values[mantra.name.hashCode.abs() % Motif.values.length],
                from: isLight ? AppColors.panelFrom : AppColors.panelFromDark,
                to: isLight ? AppColors.panelTo : AppColors.panelToDark,
                lineColor: context.colors.primary,
                lineOpacity: isLight ? 0.40 : 0.55,
              ),
            if (mantra.isPrivate)
              Positioned(
                left: AppSpacing.sm,
                bottom: AppSpacing.sm,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xxs),
                  decoration: BoxDecoration(
                    color: context.colors.surface,
                    borderRadius: AppRadius.smAll,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.lock_outline_rounded, size: AppSizes.iconSm, color: context.colors.onSurface),
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        text.ownMantraPrivate,
                        style: context.texts.bodySmall?.copyWith(color: context.colors.onSurface),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
