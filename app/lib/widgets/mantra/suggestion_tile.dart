import 'package:flutter/material.dart';

import '../../core/constants/own_mantra_config.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/own_mantra.dart';

/// One mantra the search found. A new one, or one other readers already hold,
/// can be ticked; one the reader already has, or the catalogue holds, says so
/// and opens instead.
class SuggestionTile extends StatelessWidget {
  const SuggestionTile({
    super.key,
    required this.suggestion,
    required this.chosen,
    required this.canChoose,
    required this.onToggle,
    required this.onOpen,
  });

  final MantraSuggestion suggestion;
  final bool chosen;

  /// False once the most that can be chosen are: only a chosen one can still be
  /// unticked.
  final bool canChoose;
  final VoidCallback onToggle;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final details = _Details(suggestion: suggestion);

    return Card(
      clipBehavior: Clip.antiAlias,
      child: suggestion.canPick
          ? CheckboxListTile(
              value: chosen,
              onChanged: chosen || canChoose ? (_) => onToggle() : null,
              controlAffinity: ListTileControlAffinity.leading,
              title: Text(suggestion.name, style: context.texts.titleMedium),
              subtitle: details,
            )
          : ListTile(
              onTap: suggestion.canOpen ? onOpen : null,
              title: Text(suggestion.name, style: context.texts.titleMedium),
              subtitle: details,
              trailing: suggestion.canOpen
                  ? Tooltip(
                      message: text.ownMantraOpen,
                      child: Icon(Icons.chevron_right_rounded, color: context.colors.onSurfaceVariant),
                    )
                  : null,
            ),
    );
  }
}

class _Details extends StatelessWidget {
  const _Details({required this.suggestion});

  final MantraSuggestion suggestion;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final muted = context.texts.bodySmall?.copyWith(color: context.colors.onSurfaceVariant);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: AppSpacing.xs),
        if (suggestion.sanskrit.isNotEmpty) Text(suggestion.sanskrit, style: context.texts.bodyMedium),
        if (suggestion.transliteration.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xxs),
          Text(suggestion.transliteration, style: muted),
        ],
        if (suggestion.addressedTo.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            suggestion.isSaint
                ? text.ownMantraForSaint(suggestion.addressedTo)
                : text.ownMantraForDeity(suggestion.addressedTo),
            style: muted,
          ),
        ],
        if (_status(text) case (final icon, final label)) ...[
          const SizedBox(height: AppSpacing.xs),
          Row(
            children: [
              Icon(icon, size: AppSizes.iconSm, color: context.colors.onSurfaceVariant),
              const SizedBox(width: AppSpacing.xs),
              Flexible(child: Text(label, style: muted)),
            ],
          ),
        ],
      ],
    );
  }

  /// A word and an icon for a mantra that is not simply new; null for one that is.
  (IconData, String)? _status(AppLocalizations text) => switch (suggestion.status) {
        OwnMantraConfig.statusShared => (Icons.groups_outlined, text.ownMantraStatusShared),
        OwnMantraConfig.statusYours => (Icons.check_circle_outline_rounded, text.ownMantraStatusYours),
        OwnMantraConfig.statusCatalog => (Icons.menu_book_outlined, text.ownMantraStatusCatalog),
        _ => null,
      };
}
