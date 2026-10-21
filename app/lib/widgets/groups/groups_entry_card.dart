import 'package:flutter/material.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';

/// The way into chanting groups, from Home.
class GroupsEntryCard extends StatelessWidget {
  const GroupsEntryCard({super.key});

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => AppNavigator.instance.push(AppRoutes.groups),
        child: Padding(
          padding: AppSpacing.card,
          child: Row(
            children: [
              Icon(Icons.groups_rounded, size: AppSizes.iconLg, color: context.colors.primary),
              const SizedBox(width: AppSpacing.lg),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(text.groupsTitle, style: context.texts.titleMedium),
                    const SizedBox(height: AppSpacing.xs),
                    Text(text.groupsEntrySubtitle, style: context.texts.bodySmall),
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
