import 'package:flutter/material.dart';

import '../../core/constants/own_mantra_config.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/own_mantra.dart';

/// How each chosen mantra went: added, added with other readers, already there,
/// or not added. An added one can be opened; one the reader made privately can
/// be given a picture.
class OwnMantraResults extends StatelessWidget {
  const OwnMantraResults({
    super.key,
    required this.results,
    required this.names,
    required this.onOpen,
    required this.onChangePicture,
  });

  final List<OwnMantraResult> results;

  /// What each suggestion was called, by index — the name for a result that has
  /// no mantra to take it from.
  final Map<int, String> names;
  final void Function(String slug) onOpen;
  final void Function(OwnMantraResult result) onChangePicture;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final result in results) ...[
          _ResultCard(
            result: result,
            name: result.mantra?.name ?? names[result.index] ?? '',
            onOpen: onOpen,
            onChangePicture: () => onChangePicture(result),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
      ],
    );
  }
}

class _ResultCard extends StatelessWidget {
  const _ResultCard({
    required this.result,
    required this.name,
    required this.onOpen,
    required this.onChangePicture,
  });

  final OwnMantraResult result;
  final String name;
  final void Function(String slug) onOpen;
  final VoidCallback onChangePicture;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final slug = result.mantra?.slug;
    final (icon, label) = switch (result.status) {
      OwnMantraConfig.resultCreated => (Icons.check_circle_outline_rounded, text.ownMantraResultCreated),
      OwnMantraConfig.resultShared => (Icons.groups_outlined, text.ownMantraResultShared),
      OwnMantraConfig.resultAlready => (Icons.check_circle_outline_rounded, text.ownMantraStatusYours),
      _ => (Icons.error_outline_rounded, text.ownMantraResultFailed),
    };

    return Card(
      child: Padding(
        padding: AppSpacing.card,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(name, style: context.texts.titleMedium),
            const SizedBox(height: AppSpacing.xs),
            Row(
              children: [
                Icon(icon, size: AppSizes.iconSm, color: context.colors.onSurfaceVariant),
                const SizedBox(width: AppSpacing.xs),
                Flexible(
                  child: Text(
                    label,
                    style: context.texts.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
                  ),
                ),
              ],
            ),
            if (slug != null && result.added) ...[
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.sm,
                children: [
                  TextButton.icon(
                    onPressed: () => onOpen(slug),
                    icon: const Icon(Icons.open_in_new_rounded),
                    label: Text(text.ownMantraOpen),
                  ),
                  if (result.canChangePicture)
                    TextButton.icon(
                      onPressed: onChangePicture,
                      icon: const Icon(Icons.image_outlined),
                      label: Text(text.ownMantraChangePicture),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
