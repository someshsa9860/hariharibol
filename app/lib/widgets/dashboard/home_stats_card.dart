import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../providers/profile_provider.dart';
import '../common/icon_badge.dart';

/// Lifetime totals — rounds chanted, days practiced, verses saved and read —
/// as one banded card rather than four boxed tiles.
///
/// A separate request from the rest of the feed, since these are running
/// totals rather than anything today's date changes. Null until they arrive;
/// zeroes are shown rather than a spinner so the card does not jump into place
/// once the count is known.
class HomeStatsCard extends ConsumerWidget {
  const HomeStatsCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final summary = ref.watch(userSummaryProvider).value;

    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _StatColumn(
                icon: Icons.radio_button_unchecked_rounded,
                value: '${summary?.totalRounds ?? 0}',
                label: text.profileStatTotalRounds,
              ),
              const _StatDivider(),
              _StatColumn(
                icon: Icons.local_fire_department_outlined,
                value: '${summary?.chantingDays ?? 0}',
                label: text.profileStatChantingDays,
              ),
              const _StatDivider(),
              _StatColumn(
                icon: Icons.favorite_outline_rounded,
                value: '${summary?.favorites ?? 0}',
                label: text.profileStatVersesSaved,
              ),
              const _StatDivider(),
              _StatColumn(
                icon: Icons.auto_stories_outlined,
                value: '${summary?.slokasRead ?? 0}',
                label: text.profileStatSlokasRead,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatDivider extends StatelessWidget {
  const _StatDivider();

  @override
  Widget build(BuildContext context) {
    return VerticalDivider(
      width: 1,
      thickness: 1,
      color: context.colors.outlineVariant,
    );
  }
}

class _StatColumn extends StatelessWidget {
  const _StatColumn({
    required this.icon,
    required this.value,
    required this.label,
  });

  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Semantics(
        label: '$label: $value',
        child: ExcludeSemantics(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.start,
              children: [
                IconBadge(icon: icon),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  value,
                  style: AppTypography.numeral(context, size: 24),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: AppSpacing.xs),
                // Two lines, not one: a long label in another language was
                // being cut to "Verses sav…" on a phone's width.
                Text(
                  label,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: context.texts.bodySmall,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
