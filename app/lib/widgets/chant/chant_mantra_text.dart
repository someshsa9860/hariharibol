import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/mantra.dart';

/// The words above the ring: the mantra being chanted, or — while a prayer is
/// being said between rounds — the prayer's name and text with the line telling
/// the reader to tap the ring when it is done.
class ChantMantraText extends StatelessWidget {
  const ChantMantraText({super.key, required this.mantra, this.prayer});

  /// The mantra being chanted; nothing is shown for a sitting with none.
  final Mantra? mantra;

  /// The prayer on screen in place of the mantra, if one is.
  final Mantra? prayer;

  @override
  Widget build(BuildContext context) {
    final shown = prayer;
    if (shown != null) {
      return Column(
        children: [
          Text(
            shown.name,
            textAlign: TextAlign.center,
            style: context.texts.titleMedium?.copyWith(color: context.colors.primary),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(shown.text, textAlign: TextAlign.center, style: AppTypography.verse(context, size: 22)),
          const SizedBox(height: AppSpacing.sm),
          Text(
            AppLocalizations.of(context).chantPrayerHint,
            textAlign: TextAlign.center,
            style: context.texts.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
          ),
          const SizedBox(height: AppSpacing.lg),
        ],
      );
    }

    final own = mantra;
    if (own == null) return const SizedBox.shrink();
    return Column(
      children: [
        Text(own.text, textAlign: TextAlign.center, style: AppTypography.verse(context, size: 22)),
        const SizedBox(height: AppSpacing.lg),
      ],
    );
  }
}
