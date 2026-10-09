import 'package:flutter/material.dart';

import '../../core/format/chant_format.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/chant_log.dart';

/// One chant: its number, the time it was counted, and how many seconds it
/// took — plus what was heard, when word detection was on.
class ChantTapRow extends StatelessWidget {
  const ChantTapRow({super.key, required this.tap});

  final ChantTapLog tap;

  static const double _numberWidth = 52;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final muted = context.texts.bodySmall?.copyWith(color: context.colors.onSurfaceVariant);
    final heard = tap.heard;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: _numberWidth,
            child: Text(text.chantTapNumber(tap.seq), style: AppTypography.numeral(context, size: 18)),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // A Wrap rather than a Row: at a large text size the time and
                // the mic badge no longer fit side by side.
                Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: AppSpacing.sm,
                  children: [
                    Text(formatTimeOfDay(context, tap.at), style: context.texts.bodyMedium),
                    if (tap.auto)
                      Icon(
                        Icons.mic_rounded,
                        size: AppSizes.iconSm,
                        color: context.colors.onSurfaceVariant,
                        semanticLabel: text.chantAutoBadge,
                      ),
                  ],
                ),
                if (heard != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Icons.record_voice_over_rounded,
                        size: AppSizes.iconSm,
                        color: context.colors.onSurfaceVariant,
                        semanticLabel: text.chantHeardLabel,
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Expanded(child: Text(heard, style: muted)),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.timer_outlined, size: AppSizes.iconSm, color: context.colors.onSurfaceVariant),
              const SizedBox(width: AppSpacing.xs),
              Text(
                // The first chant of a sitting has nothing before it to be
                // timed against.
                tap.seq == 1 ? text.chantNoValue : text.sadhanaElapsedSeconds(formatMillisAsSeconds(tap.gapMs)),
                style: context.texts.bodyMedium,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
