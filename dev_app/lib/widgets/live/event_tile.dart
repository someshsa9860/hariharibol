import 'package:flutter/material.dart';

import '../../core/format/time_format.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/dev_event.dart';
import 'event_style.dart';

/// One event in the feed.
class EventTile extends StatelessWidget {
  const EventTile({super.key, required this.event, required this.onTap});

  final DevEvent event;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final color = AppTheme.severityColor(context, event.severity);
    final locale = Localizations.localeOf(context).toString();

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.gutter, vertical: AppSpacing.md),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: color.withValues(alpha: 0.15),
              child: Icon(EventStyle.icon(event.type), size: 20, color: color),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          event.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.titleSmall,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Text(whenText(text, locale, event.createdAt), style: theme.textTheme.bodySmall),
                    ],
                  ),
                  if (event.body != null)
                    Padding(
                      padding: const EdgeInsets.only(top: AppSpacing.xs),
                      child: Text(
                        event.body!,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                      ),
                    ),
                  Padding(
                    padding: const EdgeInsets.only(top: AppSpacing.xs),
                    child: Text(
                      EventStyle.label(text, event.type),
                      style: theme.textTheme.labelSmall?.copyWith(color: color),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
