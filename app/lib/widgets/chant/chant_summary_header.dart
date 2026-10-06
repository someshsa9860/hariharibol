import 'package:flutter/material.dart';

import '../../core/format/chant_format.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/chant_log.dart';
import '../common/eyebrow.dart';
import 'chant_stat_tile.dart';

/// The top of the counter: how long the sitting has run, how long this mala
/// has, and six figures about where the count stands.
///
/// Everything is handed in rather than read from the recorder, so the screen
/// decides how often it redraws — the clocks tick each half second while the
/// figures only change on a tap.
class ChantSummaryHeader extends StatelessWidget {
  const ChantSummaryHeader({
    super.key,
    required this.sittingTime,
    required this.malaTime,
    required this.currentMala,
    required this.beadsInMala,
    required this.beadsPerRound,
    required this.stats,
  });

  final Duration sittingTime;
  final Duration malaTime;
  final int currentMala;
  final int beadsInMala;
  final int beadsPerRound;
  final ChantStats stats;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final dash = text.chantNoValue;
    String seconds(double? value) => value == null ? dash : text.sadhanaElapsedSeconds(formatSeconds(value));
    String clock(double? value) =>
        value == null ? dash : formatClock(Duration(milliseconds: (value * 1000).round()));

    return Column(
      children: [
        _Clocks(sittingTime: sittingTime, malaTime: malaTime, currentMala: currentMala),
        const SizedBox(height: AppSpacing.sm),
        ChantStatRow(
          tiles: [
            ChantStatTile(
              icon: Icons.donut_large_rounded,
              label: text.chantStatCurrentMala,
              value: '$currentMala',
            ),
            ChantStatTile(
              icon: Icons.touch_app_rounded,
              label: text.chantStatCount,
              value: '$beadsInMala/$beadsPerRound',
            ),
            ChantStatTile(
              icon: Icons.task_alt_rounded,
              label: text.chantStatMalasDone,
              value: '${stats.malasDone}',
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        ChantStatRow(
          tiles: [
            ChantStatTile(
              icon: Icons.timelapse_rounded,
              label: text.chantStatAvgMala,
              value: clock(stats.avgMalaSeconds),
            ),
            ChantStatTile(
              icon: Icons.speed_rounded,
              label: text.chantStatAvgChant,
              value: seconds(stats.avgChantSeconds),
            ),
            ChantStatTile(
              icon: Icons.format_list_numbered_rounded,
              label: text.chantStatTotalChants,
              value: '${stats.totalChants}',
            ),
          ],
        ),
      ],
    );
  }
}

/// The two running clocks on a panel of the app's own wash — the one place on
/// the screen that is a surface rather than a card, because it is the thing
/// the eye should land on first.
class _Clocks extends StatelessWidget {
  const _Clocks({
    required this.sittingTime,
    required this.malaTime,
    required this.currentMala,
  });

  final Duration sittingTime;
  final Duration malaTime;
  final int currentMala;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final isLight = context.theme.brightness == Brightness.light;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isLight
                ? const [AppColors.panelFrom, AppColors.panelTo]
                : const [AppColors.panelFromDark, AppColors.panelToDark],
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.lg,
          ),
          child: Row(
            children: [
              Expanded(
                child: _Clock(
                  icon: Icons.timer_outlined,
                  label: text.chantSittingTime,
                  value: formatClock(sittingTime),
                ),
              ),
              SizedBox(
                height: AppSizes.avatarMd,
                child: VerticalDivider(color: context.colors.outlineVariant),
              ),
              Expanded(
                child: _Clock(
                  icon: Icons.hourglass_bottom_rounded,
                  label: text.chantMalaTime(currentMala),
                  value: formatClock(malaTime),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Clock extends StatelessWidget {
  const _Clock({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: AppSizes.iconSm, color: context.colors.onSurfaceVariant),
            const SizedBox(width: AppSpacing.xs),
            Flexible(child: Eyebrow(label)),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(value, style: AppTypography.numeral(context, size: 34)),
      ],
    );
  }
}
