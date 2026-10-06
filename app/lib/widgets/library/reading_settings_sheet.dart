import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/language.dart';
import '../../providers/languages_provider.dart';
import '../../providers/reading_prefs_provider.dart';
import '../../providers/session_provider.dart';
import '../../services/user_service.dart';

/// Font size and reading language, applied live as they're picked — there is
/// nothing to submit, so the sheet needs no confirm button. [onLanguageChanged]
/// lets the reading screen refetch the open chapter once the language
/// actually changes, without this sheet needing to know the chapter provider
/// exists.
Future<void> showReadingSettingsSheet(
  BuildContext context, {
  required VoidCallback onLanguageChanged,
}) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    backgroundColor: context.colors.surface,
    builder: (context) =>
        _ReadingSettingsSheet(onLanguageChanged: onLanguageChanged),
  );
}

class _ReadingSettingsSheet extends ConsumerStatefulWidget {
  const _ReadingSettingsSheet({required this.onLanguageChanged});

  final VoidCallback onLanguageChanged;

  @override
  ConsumerState<_ReadingSettingsSheet> createState() =>
      _ReadingSettingsSheetState();
}

class _ReadingSettingsSheetState extends ConsumerState<_ReadingSettingsSheet> {
  bool _savingLanguage = false;

  Future<void> _pickLanguage(String code) async {
    final current = ref.read(currentUserProvider)?.readingLanguage;
    if (code == current || _savingLanguage) return;

    setState(() => _savingLanguage = true);
    try {
      await UserService.instance.updateLanguages(readingLanguage: code);
      widget.onLanguageChanged();
    } on ApiFailure catch (failure) {
      AppNavigator.instance.showFailure(failure);
    } finally {
      if (mounted) setState(() => _savingLanguage = false);
    }
  }

  String _fontSizeLabel(AppLocalizations text, ReadingFontSize size) =>
      switch (size) {
        ReadingFontSize.small => text.readingFontSizeSmall,
        ReadingFontSize.medium => text.readingFontSizeMedium,
        ReadingFontSize.large => text.readingFontSizeLarge,
        ReadingFontSize.extraLarge => text.readingFontSizeExtraLarge,
      };

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final fontSize = ref.watch(readingFontSizeProvider);
    final languages = ref.watch(languagesForSlotProvider(LanguageSlot.reading));
    final currentLanguage = ref.watch(currentUserProvider)?.readingLanguage;

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
                    onTap: () => _pickLanguage(language.code),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
