import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/sadhana.dart';
import '../common/animations.dart';
import '../common/eyebrow.dart';
import 'progress_ring.dart';

/// Today's practice at a glance: rounds against the target, and the run of days
/// behind them.
///
/// The count is set as a number on the left and drawn as a ring on the right —
/// the number is what is read, the ring is what is seen from across the room.
/// A met target puts a check in the ring and the title's line, so it is never
/// said by colour alone.
///
/// When the day has not been opened the API sends null rather than zeroes, and
/// this shows an invitation and an empty ring instead of 0 of 0 — the
/// difference between "not started" and "failing" matters on a screen someone
/// sees first thing in the morning.
///
/// The card as a whole opens the Jap tab; [onChant] is the shortcut past it,
/// straight into the counter. It names the person's own [mantraName] when they
/// have set one, so the button says what will be chanted, and reads "Chant
/// now" when they have not. Null [onChant] leaves the shortcut out.
class SadhanaCard extends StatelessWidget {
  const SadhanaCard({
    super.key,
    required this.summary,
    this.onTap,
    this.onChant,
    this.mantraName,
  });

  final SadhanaSummary summary;
  final VoidCallback? onTap;
  final VoidCallback? onChant;
  final String? mantraName;

  static const double _ringSize = 88;
  static const double _ringStroke = 8;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final today = summary.today;

    return TapScale(
      onTap: onTap,
      child: Card(
        child: Padding(
          padding: AppSpacing.card,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Eyebrow(text.homeTodaysSadhana, color: context.colors.primary),
                  ),
                  if (summary.streak > 0) _StreakPill(label: text.sadhanaStreak(summary.streak)),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              Row(
                children: [
                  Expanded(
                    child: today == null
                        ? _Invitation(label: text.homeStartYourDay)
                        : _Progress(day: today),
                  ),
                  const SizedBox(width: AppSpacing.lg),
                  ProgressRing(
                    value: today?.roundProgress ?? 0,
                    size: _ringSize,
                    strokeWidth: _ringStroke,
                    color: today?.roundTargetMet == true ? context.semanticColors.success : null,
                    child: Icon(
                      today?.roundTargetMet == true
                          ? Icons.check_rounded
                          : Icons.wb_sunny_outlined,
                      size: AppSizes.iconLg,
                      color: context.colors.primary,
                    ),
                  ),
                ],
              ),
              if (onChant != null) ...[
                const SizedBox(height: AppSpacing.lg),
                _ChantButton(mantraName: mantraName, onPressed: onChant!),
              ],
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
                Text('${day.roundsCompleted}', style: AppTypography.numeral(context, size: 44)),
                const SizedBox(width: AppSpacing.xs),
                Flexible(
                  child: Text(
                    '/ ${day.roundTarget}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.texts.titleMedium?.copyWith(
                      color: context.colors.onSurfaceVariant,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(text.sadhanaRoundsCaption, style: context.texts.bodySmall),
        if (day.tasksTotal > 0) ...[
          const SizedBox(height: AppSpacing.xxs),
          Text(
            text.sadhanaTasksProgress(day.tasksDone, day.tasksTotal),
            style: context.texts.bodySmall,
          ),
        ],
      ],
    );
  }
}

/// The run of days, as a small pill in the card's corner.
class _StreakPill extends StatelessWidget {
  const _StreakPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: context.colors.primaryContainer,
        shape: const StadiumBorder(),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.xs,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.local_fire_department_rounded,
              size: AppSizes.iconSm,
              color: context.colors.onPrimaryContainer,
            ),
            const SizedBox(width: AppSpacing.xs),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: context.texts.labelMedium?.copyWith(
                color: context.colors.onPrimaryContainer,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChantButton extends StatelessWidget {
  const _ChantButton({required this.mantraName, required this.onPressed});

  final String? mantraName;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final name = mantraName;

    return Semantics(
      label: name == null ? text.sadhanaChantNow : text.homeChantMantra(name),
      excludeSemantics: true,
      button: true,
      child: SizedBox(
        width: double.infinity,
        child: FilledButton.icon(
          onPressed: onPressed,
          style: FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(AppSizes.buttonHeightSm),
          ),
          icon: const Icon(Icons.radio_button_unchecked_rounded, size: AppSizes.iconSm),
          label: Text(
            name ?? text.sadhanaChantNow,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ),
    );
  }
}
