import 'package:flutter/material.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';

/// On the Jap tab: a way to add a mantra the list does not have. It says in
/// words what it does, because a plus sign among mantras could be anything.
class AddMantraCard extends StatelessWidget {
  const AddMantraCard({super.key});

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => AppNavigator.instance.push(AppRoutes.addMantra),
        child: Padding(
          padding: AppSpacing.card,
          child: Row(
            children: [
              Container(
                width: AppSizes.avatarMd,
                height: AppSizes.avatarMd,
                decoration: BoxDecoration(color: context.colors.primaryContainer, shape: BoxShape.circle),
                child: Icon(Icons.add_rounded, color: context.colors.onPrimaryContainer),
              ),
              const SizedBox(width: AppSpacing.lg),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(text.ownMantraAddTitle, style: context.texts.titleMedium),
                    const SizedBox(height: AppSpacing.xs),
                    Text(text.ownMantraAddBody, style: context.texts.bodySmall),
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
