import 'package:flutter/material.dart';

import '../../core/format/chant_format.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/chant_log.dart';
import '../common/empty_state.dart';
import 'chant_mala_tile.dart';
import 'chant_stat_tile.dart';

/// A sitting laid out for reading: the totals, then every mala newest first.
/// Used for the sitting in progress and for one from the history, which are
/// the same data in the same shape.
class ChantMalaReport extends StatelessWidget {
  const ChantMalaReport({
    super.key,
    required this.malas,
    required this.totalTime,
    this.emptyMessage,
  });

  final List<ChantMalaLog> malas;

  /// How long the sitting ran; null when it was not recorded.
  final Duration? totalTime;

  /// Shown instead of the list when there are no malas.
  final String? emptyMessage;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    if (malas.isEmpty) {
      return Padding(
        padding: const EdgeInsets.only(top: AppSpacing.xxl),
        child: EmptyState(
          icon: Icons.insights_rounded,
          message: emptyMessage ?? text.chantNoMalasYet,
        ),
      );
    }

    final stats = ChantStats.of(malas);
    final dash = text.chantNoValue;
    String seconds(double? value) => value == null ? dash : text.sadhanaElapsedSeconds(formatSeconds(value));
    String clock(double? value) =>
        value == null ? dash : formatClock(Duration(milliseconds: (value * 1000).round()));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ChantStatRow(
          tiles: [
            ChantStatTile(
              icon: Icons.timer_outlined,
              label: text.chantStatTotalTime,
              value: totalTime == null ? dash : formatClock(totalTime!),
            ),
            ChantStatTile(
              icon: Icons.task_alt_rounded,
              label: text.chantStatMalasDone,
              value: '${stats.malasDone}',
            ),
            ChantStatTile(
              icon: Icons.format_list_numbered_rounded,
              label: text.chantStatTotalChants,
              value: '${stats.totalChants}',
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
              icon: Icons.bolt_rounded,
              label: text.chantStatFastestMala,
              value: clock(stats.fastestMalaSeconds),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        for (var i = malas.length - 1; i >= 0; i--) ...[
          ChantMalaTile(key: ValueKey(malas[i].index), mala: malas[i]),
          const SizedBox(height: AppSpacing.sm),
        ],
      ],
    );
  }
}
