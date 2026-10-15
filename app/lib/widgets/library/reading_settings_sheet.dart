import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/language.dart';
import '../../models/verse_part.dart';
import '../../providers/languages_provider.dart';
import '../../providers/reading_prefs_provider.dart';
import '../../providers/language_settings_provider.dart';

/// Font size, which parts of a verse to hide, and reading language — applied
/// live as they're picked, so there is nothing to submit and no confirm button.
/// Picking a language also closes the sheet: the reading screen is already
/// following the language setting, so the chapter reloads in it as the sheet
/// goes.
Future<void> showReadingSettingsSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    backgroundColor: context.colors.surface,
    builder: (context) => const _ReadingSettingsSheet(),
  );
}

class _ReadingSettingsSheet extends ConsumerWidget {
  const _ReadingSettingsSheet();

  void _pickLanguage(BuildContext context, WidgetRef ref, String code) {
    // The setting changes at once and is saved behind it; the sheet need not
    // wait for the write, and the same language again just closes it.
    if (code != ref.read(languageSettingsProvider).reading) {
      unawaited(ref.read(languageSettingsProvider.notifier).setReading(code));
    }
    Navigator.of(context).pop();
  }

  String _fontSizeLabel(AppLocalizations text, ReadingFontSize size) =>
      switch (size) {
        ReadingFontSize.small => text.readingFontSizeSmall,
        ReadingFontSize.medium => text.readingFontSizeMedium,
        ReadingFontSize.large => text.readingFontSizeLarge,
        ReadingFontSize.extraLarge => text.readingFontSizeExtraLarge,
      };

  String _partLabel(AppLocalizations text, VersePart part) => switch (part) {
        VersePart.sanskrit => text.readingHideSanskrit,
        VersePart.transliteration => text.readingHideTransliteration,
        VersePart.wordMeanings => text.verseWordMeanings,
        VersePart.purport => text.mantraPurport,
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final fontSize = ref.watch(readingFontSizeProvider);
    final hidden = ref.watch(hiddenVersePartsProvider);
    final languages = ref.watch(languagesForSlotProvider(LanguageSlot.reading));
    final currentLanguage = ref.watch(languageSettingsProvider.select((s) => s.reading));

    return SafeArea(
      top: false,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.85,
        ),
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
                      onSelected: (_) =>
                          ref.read(readingFontSizeProvider.notifier).set(size),
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.xl),
              Text(
                text.readingHideLabel,
                style: AppTypography.section(context).copyWith(fontSize: 16),
              ),
              const SizedBox(height: AppSpacing.xs),
              for (final part in VersePart.values)
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                  title: Text(_partLabel(text, part)),
                  value: hidden.contains(part),
                  onChanged: (value) => ref
                      .read(hiddenVersePartsProvider.notifier)
                      .set(part, hidden: value ?? false),
                ),
              if (languages.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.xl),
                Text(
                  text.readingLanguageLabel,
                  style: AppTypography.section(context).copyWith(fontSize: 16),
                ),
                const SizedBox(height: AppSpacing.sm),
                for (final language in languages)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(language.nativeName),
                    subtitle: Text(language.englishName),
                    trailing: language.code == currentLanguage
                        ? Icon(
                            Icons.check_rounded,
                            color: context.colors.primary,
                          )
                        : null,
                    onTap: () => _pickLanguage(context, ref, language.code),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
