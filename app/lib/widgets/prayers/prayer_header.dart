import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/prayer.dart';
import '../common/eyebrow.dart';
import '../library/collapsible_section.dart';
import 'prayer_category_label.dart';

/// The top of a prayer: its category, title and summary, and "About this
/// prayer" under a chevron when there is something to say. The text under the
/// chevron is left closed — the verses are what the reader came for.
class PrayerHeader extends StatefulWidget {
  const PrayerHeader({super.key, required this.prayer});

  final Prayer prayer;

  @override
  State<PrayerHeader> createState() => _PrayerHeaderState();
}

class _PrayerHeaderState extends State<PrayerHeader> {
  bool _aboutOpen = false;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final prayer = widget.prayer;
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Eyebrow(prayerCategoryLabel(text, prayer.category)),
          const SizedBox(height: AppSpacing.sm),
          Text(prayer.title, style: context.texts.headlineSmall),
          if (prayer.summary.trim().isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Text(prayer.summary, style: context.texts.bodyLarge),
          ],
          if (prayer.hasAbout) ...[
            const SizedBox(height: AppSpacing.md),
            CollapsibleSection(
              label: text.prayersAbout,
              expanded: _aboutOpen,
              onToggle: () => setState(() => _aboutOpen = !_aboutOpen),
              child: Text(prayer.about.trim(), style: context.texts.bodyMedium),
            ),
          ],
        ],
      ),
    );
  }
}
