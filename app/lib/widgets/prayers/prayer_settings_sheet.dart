import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../providers/prayer_prefs_provider.dart';
import '../../providers/reading_prefs_provider.dart';

/// How a prayer is read: the text size (the one the books use), whether the
/// original is shown above another script, and whether meanings open with the
/// prayer. Applied live as they are changed, so there is nothing to submit.
/// The script itself is chosen on the prayer, in the bar above its verses.
Future<void> showPrayerSettingsSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    showDragHandle: true,
    isScrollControlled: true,
    backgroundColor: context.colors.surface,
    builder: (context) => const _PrayerSettingsSheet(),
  );
}

class _PrayerSettingsSheet extends ConsumerWidget {
  const _PrayerSettingsSheet();

  String _fontSizeLabel(AppLocalizations text, ReadingFontSize size) => switch (size) {
        ReadingFontSize.small => text.readingFontSizeSmall,
        ReadingFontSize.medium => text.readingFontSizeMedium,
        ReadingFontSize.large => text.readingFontSizeLarge,
        ReadingFontSize.extraLarge => text.readingFontSizeExtraLarge,
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final fontSize = ref.watch(readingFontSizeProvider);
    final showOriginal = ref.watch(prayerShowOriginalProvider);
    final meaningsOpen = ref.watch(prayerMeaningsOpenProvider);

    return SafeArea(
      top: false,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.85),
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.lg,
            0,
            AppSpacing.lg,
            MediaQuery.viewInsetsOf(context).bottom + AppSpacing.xl,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(text.readingSettingsTitle, style: context.texts.titleLarge),
              const SizedBox(height: AppSpacing.xl),
              Text(
                text.readingFontSizeLabel,
                style: AppTypography.section(context).copyWith(fontSize: 16),
              ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  for (final size in ReadingFontSize.values)
                    ChoiceChip(
                      label: Text(_fontSizeLabel(text, size)),
                      selected: fontSize == size,
                      onSelected: (_) => ref.read(readingFontSizeProvider.notifier).set(size),
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(text.prayersShowOriginal),
                value: showOriginal,
                onChanged: (value) => ref.read(prayerShowOriginalProvider.notifier).set(value),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(text.prayersMeaningsOpen),
                value: meaningsOpen,
                onChanged: (value) => ref.read(prayerMeaningsOpenProvider.notifier).set(value),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
