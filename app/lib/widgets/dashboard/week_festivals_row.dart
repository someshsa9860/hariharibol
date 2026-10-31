import 'package:flutter/material.dart';

import '../../core/constants/home_config.dart';
import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../models/calendar.dart';
import '../calendar/calendar_glyph.dart';
import 'home_card_row.dart';

/// "This week": the festivals from today through the coming days. A tap opens
/// the calendar.
class WeekFestivalsRow extends StatelessWidget {
  const WeekFestivalsRow({super.key, required this.festivals});

  final List<CalendarFestival> festivals;

  @override
  Widget build(BuildContext context) {
    final localizations = MaterialLocalizations.of(context);
    return HomeCardRow(
      cardWidth: HomeConfig.festivalCardWidth,
      children: [
        for (final festival in festivals)
          Card(
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: () => AppNavigator.instance.push(AppRoutes.calendar),
              child: Padding(
                padding: AppSpacing.card,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CalendarGlyph(kind: festival.kind, size: AppSizes.iconLg),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      festival.name,
                      style: context.texts.titleSmall,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      localizations.formatMediumDate(festival.day),
                      style: context.texts.bodySmall,
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}
