import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/etiquette.dart';
import '../common/eyebrow.dart';
import '../settings/sources_section.dart';

/// Where an item comes from: who it is by, the passage it rests on and the
/// site it was drawn from. The app has no link launcher, so the address is
/// text a reader can select and copy, as on the Sources page. Draws nothing
/// when the item cites nothing.
class EtiquetteSourceCard extends StatelessWidget {
  const EtiquetteSourceCard({super.key, required this.item});

  final Etiquette item;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final author = item.author?.trim() ?? '';
    final reference = item.reference?.trim() ?? '';
    final name = item.sourceName?.trim() ?? '';
    final url = item.sourceUrl?.trim() ?? '';
    final hasSource = name.isNotEmpty || url.isNotEmpty;
    if (author.isEmpty && reference.isEmpty && !hasSource) return const SizedBox.shrink();

    return Card(
      child: Padding(
        padding: AppSpacing.card,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (author.isNotEmpty) ...[
              Eyebrow(text.etiquetteAuthorLabel),
              const SizedBox(height: AppSpacing.xs),
              Text(author, style: context.texts.bodyMedium),
            ],
            if (author.isNotEmpty && (reference.isNotEmpty || hasSource)) const SizedBox(height: AppSpacing.lg),
            if (reference.isNotEmpty) ...[
              Eyebrow(text.etiquetteReferenceLabel),
              const SizedBox(height: AppSpacing.xs),
              Text(reference, style: context.texts.bodyMedium),
            ],
            if (reference.isNotEmpty && hasSource) const SizedBox(height: AppSpacing.lg),
            if (hasSource) ...[
              Eyebrow(text.etiquetteSourceLabel),
              const SizedBox(height: AppSpacing.xs),
              if (url.isEmpty)
                Text(name, style: context.texts.bodyMedium)
              else
                SourceEntry(label: name.isEmpty ? url : name, address: url),
            ],
          ],
        ),
      ),
    );
  }
}
