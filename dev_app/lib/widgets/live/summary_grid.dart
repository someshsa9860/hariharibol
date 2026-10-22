import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/dev_summary.dart';

/// The home numbers: six tiles, two across. A tile turns to the warning colour when its number needs attention.
class SummaryGrid extends StatelessWidget {
  const SummaryGrid({super.key, required this.summary});

  final DevSummary summary;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final tiles = [
      _Tile(label: text.statOnline, value: summary.online?.toString() ?? '–', icon: Icons.podcasts_outlined),
      _Tile(label: text.statUsers, value: '${summary.users}', icon: Icons.groups_outlined),
      _Tile(label: text.statSignupsToday, value: '${summary.signupsToday}', icon: Icons.person_add_alt_1_outlined),
      _Tile(
        label: text.statErrorsHour,
        value: '${summary.errorsLastHour}',
        icon: Icons.bug_report_outlined,
        severity: summary.errorsLastHour > 0 ? 'warning' : null,
      ),
      _Tile(
        label: text.statCriticalHour,
        value: '${summary.criticalLastHour}',
        icon: Icons.local_fire_department_outlined,
        severity: summary.criticalLastHour > 0 ? 'critical' : null,
      ),
      _Tile(
        label: text.statUnreadChats,
        value: '${summary.unreadChats}',
        icon: Icons.chat_bubble_outline,
        severity: summary.unreadChats > 0 ? 'info' : null,
      ),
    ];
    return LayoutBuilder(builder: (context, constraints) {
      final columns = constraints.maxWidth > 600 ? 3 : 2;
      final width = (constraints.maxWidth - AppSpacing.sm * (columns - 1)) / columns;
      return Wrap(
        spacing: AppSpacing.sm,
        runSpacing: AppSpacing.sm,
        children: [for (final tile in tiles) SizedBox(width: width, child: tile)],
      );
    });
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.label, required this.value, required this.icon, this.severity});

  final String label;
  final String value;
  final IconData icon;
  final String? severity;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = severity == null ? theme.colorScheme.onSurfaceVariant : AppTheme.severityColor(context, severity!);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            Icon(icon, color: color),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(value, style: theme.textTheme.titleLarge?.copyWith(color: severity == null ? null : color)),
                  Text(label, style: theme.textTheme.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
