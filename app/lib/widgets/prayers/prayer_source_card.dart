import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/prayer.dart';
import '../common/eyebrow.dart';
import '../settings/sources_section.dart';

/// Where a prayer comes from: who composed it, the passage it rests on and the
/// site it was drawn from. The app has no link launcher, so the address is
/// text a reader can select and copy, as on the Sources page. Draws nothing
/// when the prayer cites nothing.
class PrayerSourceCard extends StatelessWidget {
  const PrayerSourceCard({super.key, required this.prayer});

  final Prayer prayer;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final author = prayer.author?.trim() ?? '';
    final reference = prayer.reference?.trim() ?? '';
    final name = prayer.sourceName?.trim() ?? '';
    final url = prayer.sourceUrl?.trim() ?? '';
    final hasSource = name.isNotEmpty || url.isNotEmpty;
    if (author.isEmpty && reference.isEmpty && !hasSource) return const SizedBox.shrink();

    return Card(
      child: Padding(
        padding: AppSpacing.card,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (author.isNotEmpty) ...[
              Eyebrow(text.prayersComposedBy),
              const SizedBox(height: AppSpacing.xs),
              Text(author, style: context.texts.bodyMedium),
            ],
            if (author.isNotEmpty && (reference.isNotEmpty || hasSource)) const SizedBox(height: AppSpacing.lg),
            if (reference.isNotEmpty) ...[
              Eyebrow(text.prayersReference),
              const SizedBox(height: AppSpacing.xs),
              Text(reference, style: context.texts.bodyMedium),
            ],
            if (reference.isNotEmpty && hasSource) const SizedBox(height: AppSpacing.lg),
            if (hasSource) ...[
              Eyebrow(text.prayersSource),
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
