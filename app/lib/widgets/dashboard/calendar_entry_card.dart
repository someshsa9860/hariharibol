import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/calendar.dart';
import '../../providers/calendar_provider.dart';
import '../calendar/calendar_glyph.dart';

/// The way into the Hindu calendar, from Home: the next Ekadashi, Chaturthi or
/// festival, with its date. Until the calendar loads (or if it cannot) the card
/// is still there as a plain door.
class CalendarEntryCard extends ConsumerWidget {
  const CalendarEntryCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final next = ref.watch(upcomingFestivalsProvider).asData?.value;
    final CalendarFestival? festival = next != null && next.isNotEmpty ? next.first : null;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => AppNavigator.instance.push(AppRoutes.calendar),
        child: Padding(
          padding: AppSpacing.card,
          child: Row(
            children: [
              festival == null
                  ? Icon(Icons.calendar_month_rounded, size: AppSizes.iconLg, color: context.colors.primary)
                  : CalendarGlyph(kind: festival.kind, size: AppSizes.iconLg),
              const SizedBox(width: AppSpacing.lg),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(text.calendarTitle, style: context.texts.titleMedium),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      festival == null
                          ? text.calendarUpcoming
                          : '${festival.name} · ${MaterialLocalizations.of(context).formatMediumDate(festival.day)}',
                      style: context.texts.bodySmall,
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: context.colors.onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }
}
