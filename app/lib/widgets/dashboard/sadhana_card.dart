import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/sadhana.dart';
import '../common/eyebrow.dart';
import '../common/motif.dart';

/// Today's practice at a glance: rounds against the target, and the run of days
/// behind them.
///
/// When the day has not been opened the API sends null rather than zeroes, and
/// this shows an invitation instead of a progress bar sitting at 0 of 0 — the
/// difference between "not started" and "failing" matters on a screen someone
/// sees first thing in the morning.
class SadhanaCard extends StatelessWidget {
  const SadhanaCard({super.key, required this.summary, this.onTap});

  final SadhanaSummary summary;
  final VoidCallback? onTap;

  static const double _panelWidth = 92;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final today = summary.today;
    final isLight = context.theme.brightness == Brightness.light;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Eyebrow(text.homeTodaysSadhana),
                      const SizedBox(height: AppSpacing.md),
                      if (today == null)
                        _Invitation(label: text.homeStartYourDay)
                      else
                        _Progress(day: today),
                      if (summary.streak > 0) ...[
                        const SizedBox(height: AppSpacing.md),
                        _Streak(label: text.sadhanaStreak(summary.streak)),
                      ],
                    ],
                  ),
                ),
              ),
              SizedBox(
                width: _panelWidth,
                child: MotifPanel(
                  motif: Motif.sun,
                  from: isLight ? AppColors.panelFrom : AppColors.panelFromDark,
                  to: isLight ? AppColors.panelTo : AppColors.panelToDark,
                  lineColor: context.colors.primary,
                  lineOpacity: isLight ? 0.40 : 0.55,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The day has not been opened yet.
class _Invitation extends StatelessWidget {
  const _Invitation({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Flexible(child: Text(label, style: context.texts.titleMedium)),
        const SizedBox(width: AppSpacing.sm),
        Icon(
          Icons.arrow_forward_rounded,
          size: AppSizes.iconSm,
          color: context.colors.primary,
        ),
      ],
    );
  }
}

class _Progress extends StatelessWidget {
  const _Progress({required this.day});

  final SadhanaDay day;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final met = day.roundTargetMet;
    final colour = met ? context.semanticColors.success : context.colors.primary;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // The count is the thing being looked at, so it is set as a number
        // rather than as a sentence. The sentence is still there for a screen
        // reader, which should hear "4 of 16 rounds", not "4 slash 16".
        Semantics(
          label: text.sadhanaRoundsProgress(day.roundsCompleted, day.roundTarget),
          child: ExcludeSemantics(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text('${day.roundsCompleted}', style: AppTypography.numeral(context, size: 36)),
                const SizedBox(width: AppSpacing.xs),
                Text(
                  '/ ${day.roundTarget}',
                  style: context.texts.titleMedium?.copyWith(
                    color: context.colors.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        ClipRRect(
          borderRadius: AppRadius.smAll,
          child: LinearProgressIndicator(
            value: day.roundProgress,
            minHeight: AppSpacing.xs,
            color: colour,
          ),
        ),
        if (day.tasksTotal > 0) ...[
          const SizedBox(height: AppSpacing.md),
          Text(
            text.sadhanaTasksProgress(day.tasksDone, day.tasksTotal),
            style: context.texts.bodySmall,
          ),
        ],
      ],
    );
  }
}

class _Streak extends StatelessWidget {
  const _Streak({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          Icons.local_fire_department_rounded,
          size: AppSizes.iconSm,
          color: context.colors.primary,
        ),
        const SizedBox(width: AppSpacing.xs),
        Flexible(
          child: Text(
            label,
            style: context.texts.bodySmall,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}
