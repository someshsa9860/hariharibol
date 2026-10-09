import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/format/chant_format.dart';
import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/chant_log.dart';
import '../../providers/chant_history_provider.dart';
import '../common/app_error_view.dart';
import '../common/app_loader.dart';
import '../common/empty_state.dart';

/// Past sittings, newest first, from the server. A sitting that has its tap
/// record opens into it; one from before timing was recorded shows only its
/// totals and does not pretend to open.
class ChantHistoryList extends ConsumerWidget {
  const ChantHistoryList({super.key, required this.beadsPerRound});

  final int beadsPerRound;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final history = ref.watch(chantHistoryProvider);

    return history.when(
      loading: () => const AppLoader(),
      error: (error, _) => AppErrorView(
        failure: error is ApiFailure
            ? error
            : ApiFailure(kind: FailureKind.unknown, message: text.errorGeneric),
        onRetry: () async => ref.invalidate(chantHistoryProvider),
      ),
      data: (page) {
        if (page.items.isEmpty) {
          return Center(
            child: EmptyState(icon: Icons.history_rounded, message: text.chantHistoryEmpty),
          );
        }
        return ListView.separated(
          padding: AppSpacing.page,
          itemCount: page.items.length + (page.hasMore ? 1 : 0),
          separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
          itemBuilder: (context, index) {
            if (index >= page.items.length) {
              // Reaching the end of what is loaded is what asks for more.
              WidgetsBinding.instance.addPostFrameCallback(
                (_) => ref.read(chantHistoryProvider.notifier).loadMore(),
              );
              return const AppLoader();
            }
            return _SessionCard(session: page.items[index], beadsPerRound: beadsPerRound);
          },
        );
      },
    );
  }
}

class _SessionCard extends StatelessWidget {
  const _SessionCard({required this.session, required this.beadsPerRound});

  final ChantSessionSummary session;
  final int beadsPerRound;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final muted = context.texts.bodySmall?.copyWith(color: context.colors.onSurfaceVariant);
    final seconds = session.durationSeconds;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: session.hasDetail
            ? () => AppNavigator.instance.push(AppRoutes.chantSessionPath(session.id))
            : null,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(formatDateTime(context, session.startedAt), style: context.texts.titleMedium),
                    if (session.mantraName != null) ...[
                      const SizedBox(height: AppSpacing.xxs),
                      Text(session.mantraName!, style: muted),
                    ],
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      text.chantHistorySummary(
                        session.rounds,
                        session.beadsTotal(beadsPerRound),
                      ),
                      style: context.texts.bodyMedium,
                    ),
                    if (!session.hasDetail) ...[
                      const SizedBox(height: AppSpacing.xxs),
                      Text(text.chantHistoryNoDetail, style: muted),
                    ],
                  ],
                ),
              ),
              if (seconds != null) ...[
                const SizedBox(width: AppSpacing.md),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Icon(Icons.timer_outlined, size: AppSizes.iconSm, color: context.colors.onSurfaceVariant),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      formatClock(Duration(seconds: seconds)),
                      style: AppTypography.numeral(context, size: 20),
                    ),
                  ],
                ),
              ],
              if (session.hasDetail) ...[
                const SizedBox(width: AppSpacing.xs),
                Icon(Icons.chevron_right_rounded, color: context.colors.onSurfaceVariant),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
