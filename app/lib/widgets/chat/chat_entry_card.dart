import 'package:flutter/material.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../common/sakha_icon.dart';

/// A second way into Ask Sakha, from Home, for someone who has not yet noticed
/// the raised button in the bar: it says in words what the button only shows.
class ChatEntryCard extends StatelessWidget {
  const ChatEntryCard({super.key});

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => AppNavigator.instance.push(AppRoutes.chat),
        child: Padding(
          padding: AppSpacing.card,
          child: Row(
            children: [
              const SakhaIcon(size: AppSizes.iconLg),
              const SizedBox(width: AppSpacing.lg),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(text.chatHomeTitle, style: context.texts.titleMedium),
                    const SizedBox(height: AppSpacing.xs),
                    Text(text.chatHomeBody, style: context.texts.bodySmall),
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
