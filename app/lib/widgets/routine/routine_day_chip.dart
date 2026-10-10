import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/constants/routine_config.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/routine_task.dart';
import '../../providers/routine_provider.dart';
import '../common/vaishnava_tilak_icon.dart';

/// One day in the date strip: its weekday initial in the weekday's colour, the
/// date number inside a ring that fills as the day's routine is checked off,
/// and underneath a small tilak if it is Ekadashi (or a tick once the day is
/// done).
///
/// The initial's colour is decoration — see [AppColors.weekdayLight]. What a
/// screen reader hears is the full date, whether it is Ekadashi, and how much
/// is done.
class RoutineDayChip extends ConsumerWidget {
  const RoutineDayChip({
    super.key,
    required this.day,
    required this.isSelected,
    required this.isToday,
    required this.isEkadashi,
    required this.onTap,
  });

  final DateTime day;
  final bool isSelected;
  final bool isToday;
  final bool isEkadashi;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).toString();
    final colors = context.colors;
    final progress = ref.watch(routineProgressProvider(routineDayKey(day)));
    final isComplete = progress.total > 0 && progress.done == progress.total;
    final fraction = progress.total == 0 ? 0.0 : progress.done / progress.total;

    final label = text.routineDayLabel(
      DateFormat.MMMMEEEEd(locale).format(day),
      isEkadashi ? 'yes' : 'no',
      progress.done,
      progress.total,
    );

    final discColour = isSelected
        ? colors.primary
        : isComplete
        ? colors.primaryContainer
        : Colors.transparent;
    final numberColour = isSelected
        ? colors.onPrimary
        : isComplete
        ? colors.onPrimaryContainer
        : isToday
        ? colors.primary
        : colors.onSurface;

    return Semantics(
      button: true,
      selected: isSelected,
      label: label,
      child: ExcludeSemantics(
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadius.mdAll,
          child: SizedBox(
            width: RoutineConfig.dayExtent,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  DateFormat('EEEEE', locale).format(day),
                  style: context.texts.labelMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: AppColors.forWeekday(
                      day.weekday,
                      isLight: context.theme.brightness == Brightness.light,
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                SizedBox.square(
                  dimension: RoutineConfig.dayRing,
                  child: CustomPaint(
                    painter: _RingPainter(
                      fraction: fraction,
                      track: progress.total == 0
                          ? Colors.transparent
                          : colors.outlineVariant,
                      arc: colors.primary,
                    ),
                    child: Center(
                      child: AnimatedContainer(
                        duration: AppDurations.fast,
                        width: RoutineConfig.dayDisc,
                        height: RoutineConfig.dayDisc,
                        decoration: BoxDecoration(
                          color: discColour,
                          shape: BoxShape.circle,
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          '${day.day}',
                          style: context.texts.titleSmall?.copyWith(
                            color: numberColour,
                            fontWeight: isToday || isSelected
                                ? FontWeight.w800
                                : FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                SizedBox(
                  height: AppSizes.iconSm - AppSpacing.xs,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (isEkadashi)
                        VaishnavaTilakIcon(
                          size: AppSizes.iconSm - AppSpacing.xs,
                          color: colors.primary,
                        ),
                      if (isEkadashi && isComplete)
                        const SizedBox(width: AppSpacing.xxs),
                      if (isComplete)
                        Icon(
                          Icons.check_rounded,
                          size: AppSizes.iconSm - AppSpacing.xs,
                          color: colors.primary,
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The ring round a date: a hairline track and an arc over it, from the top,
/// as far round as the day is done.
class _RingPainter extends CustomPainter {
  const _RingPainter({
    required this.fraction,
    required this.track,
    required this.arc,
  });

  final double fraction;
  final Color track;
  final Color arc;

  @override
  void paint(Canvas canvas, Size size) {
    final inset = RoutineConfig.ringStroke / 2;
    final rect = Offset.zero & size;
    final ring = rect.deflate(inset);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = RoutineConfig.ringStroke
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(ring, 0, math.pi * 2, false, paint..color = track);
    if (fraction > 0) {
      canvas.drawArc(
        ring,
        -math.pi / 2,
        math.pi * 2 * fraction,
        false,
        paint..color = arc,
      );
    }
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.fraction != fraction || old.track != track || old.arc != arc;
}
