import 'package:flutter/material.dart';

import '../../core/format/chant_format.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/chant_log.dart';
import '../common/eyebrow.dart';
import 'chant_tap_row.dart';

/// One mala in the analytics list: when it started, when it ended and how
/// long it took, with every chant inside it a tap away.
class ChantMalaTile extends StatefulWidget {
  const ChantMalaTile({super.key, required this.mala, this.initiallyOpen = false});

  final ChantMalaLog mala;
  final bool initiallyOpen;

  @override
  State<ChantMalaTile> createState() => _ChantMalaTileState();
}

class _ChantMalaTileState extends State<ChantMalaTile> {
  late bool _open = widget.initiallyOpen;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final mala = widget.mala;
    final start = mala.startedAt;
    final end = mala.endedAt;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => _open = !_open),
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
                      const SizedBox(width: AppSpacing.xs),
                      Icon(
                        _open ? Icons.expand_less_rounded : Icons.expand_more_rounded,
                        color: context.colors.onSurfaceVariant,
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
                        value: formatClock(Duration(milliseconds: mala.durationMs)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          AnimatedSize(
            duration: AppDurations.normal,
            curve: Curves.easeOutCubic,
            alignment: Alignment.topCenter,
            child: _open
                ? Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.lg,
                      0,
                      AppSpacing.lg,
                      AppSpacing.sm,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Divider(),
                        const SizedBox(height: AppSpacing.md),
                        Eyebrow(text.chantTapsHeader),
                        for (var i = 0; i < mala.taps.length; i++) ...[
                          if (i > 0) const Divider(),
                          ChantTapRow(tap: mala.taps[i]),
                        ],
                      ],
                    ),
                  )
                : const SizedBox(width: double.infinity),
          ),
        ],
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
