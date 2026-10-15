import 'package:flutter/material.dart';

import '../../core/format/chant_format.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/chant_log.dart';
import '../common/eyebrow.dart';

/// One round in the analytics list: when it started, when it ended and how
/// long it took. Nothing below the round — the chants inside it are not kept,
/// and a list of them would be most of the page.
class ChantMalaTile extends StatelessWidget {
  const ChantMalaTile({super.key, required this.mala});

  final ChantMalaLog mala;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final start = mala.startedAt;
    final end = mala.endedAt;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  mala.complete ? Icons.task_alt_rounded : Icons.hourglass_bottom_rounded,
                  size: AppSizes.iconMd,
                  color: context.colors.primary,
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Text(
                    text.chantMalaTitle(mala.index),
                    style: context.texts.titleMedium,
                  ),
                ),
                Text(
                  mala.complete ? text.chantMalaChants(mala.beads) : text.chantMalaInProgress,
                  style: context.texts.bodySmall?.copyWith(
                    color: context.colors.onSurfaceVariant,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            Row(
              children: [
                _Fact(
                  icon: Icons.play_arrow_rounded,
                  label: text.chantMalaStart,
                  value: start == null ? text.chantNoValue : formatTimeOfDay(context, start),
                ),
                _Fact(
                  icon: Icons.stop_rounded,
                  label: text.chantMalaEnd,
                  value: end == null ? text.chantNoValue : formatTimeOfDay(context, end),
                ),
                _Fact(
                  icon: Icons.timer_outlined,
                  label: text.chantMalaDuration,
                  // 0 is "not known" (see ChantMalaLog.durationMs), not instant.
                  value: mala.durationMs > 0
                      ? formatClock(Duration(milliseconds: mala.durationMs))
                      : text.chantNoValue,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: AppSizes.iconSm, color: context.colors.onSurfaceVariant),
              const SizedBox(width: AppSpacing.xs),
              Flexible(child: Eyebrow(label)),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(value, style: AppTypography.numeral(context, size: 18)),
          ),
        ],
      ),
    );
  }
}
