import 'package:flutter/material.dart';

import '../../core/constants/home_config.dart';
import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../models/prayer.dart';
import 'home_card_row.dart';

/// The prayers offered at this time of day (morning or evening). A tap opens the
/// prayer. Its heading is the category's own name, as on the prayers screen.
class TimeOfDayPrayersRow extends StatelessWidget {
  const TimeOfDayPrayersRow({super.key, required this.prayers});

  final List<Prayer> prayers;

  @override
  Widget build(BuildContext context) {
    return HomeCardRow(
      cardWidth: HomeConfig.prayerCardWidth,
      children: [
        for (final prayer in prayers)
          Card(
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: () => AppNavigator.instance.push(AppRoutes.prayerPath(prayer.id)),
              child: Padding(
                padding: AppSpacing.card,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      prayer.title,
                      style: context.texts.titleSmall,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (prayer.summary.trim().isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        prayer.summary,
                        style: context.texts.bodySmall,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}
