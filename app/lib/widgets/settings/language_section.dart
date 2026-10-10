import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/language.dart';
import '../../providers/language_settings_provider.dart';
import '../../providers/languages_provider.dart';
import 'settings_group.dart';

/// Three rows — app, reading, speaking — each opening its own picker. Choosing
/// in one never moves the others.
class LanguageSection extends ConsumerWidget {
  const LanguageSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final settings = ref.watch(languageSettingsProvider);
    final all = ref.watch(languagesProvider).value ?? const <Language>[];

    String nameOf(String code) =>
        all.where((l) => l.code == code).map((l) => l.nativeName).firstOrNull ?? code;

    return SettingsGroup(
      title: text.settingsSectionLanguages,
      children: [
        SettingsRow(
          icon: Icons.translate_rounded,
          label: text.settingsLanguageApp,
          value: nameOf(settings.app),
          onTap: () => _pick(context, ref, LanguageSlot.app, text.settingsLanguagePickerApp, settings.app),
        ),
        SettingsRow(
          icon: Icons.menu_book_rounded,
          label: text.settingsLanguageReading,
          value: nameOf(settings.reading),
          onTap: () =>
              _pick(context, ref, LanguageSlot.reading, text.settingsLanguagePickerReading, settings.reading),
        ),
        SettingsRow(
          icon: Icons.record_voice_over_rounded,
          label: text.settingsLanguageSpeaking,
          value: nameOf(settings.speaking),
          onTap: () =>
              _pick(context, ref, LanguageSlot.speaking, text.settingsLanguagePickerSpeaking, settings.speaking),
        ),
      ],
    );
  }

  Future<void> _pick(BuildContext context, WidgetRef ref, LanguageSlot slot, String title, String current) async {
    final chosen = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      backgroundColor: context.colors.surface,
      builder: (_) => _LanguagePickerSheet(slot: slot, title: title, current: current),
    );
    if (chosen == null) return;
    final notifier = ref.read(languageSettingsProvider.notifier);
    switch (slot) {
      case LanguageSlot.app:
        await notifier.setApp(chosen);
      case LanguageSlot.reading:
        await notifier.setReading(chosen);
      case LanguageSlot.speaking:
        await notifier.setSpeaking(chosen);
      case LanguageSlot.mantra:
        break;
    }
  }
}

class _LanguagePickerSheet extends ConsumerWidget {
  const _LanguagePickerSheet({required this.slot, required this.title, required this.current});

  final LanguageSlot slot;
  final String title;
  final String current;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final languages = ref.watch(languagesForSlotProvider(slot));

    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(AppSpacing.xl, 0, AppSpacing.xl, AppSpacing.sm),
              child: Text(title, style: context.texts.titleMedium),
            ),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: [
                  for (final language in languages)
                    ListTile(
                      title: Text(language.nativeName),
                      subtitle: language.nativeName == language.englishName ? null : Text(language.englishName),
                      trailing: language.code == current ? const Icon(Icons.check_rounded) : null,
                      onTap: () => Navigator.of(context).pop(language.code),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Text(text.settingsLanguageSanskritNote, style: context.texts.bodySmall),
            ),
          ],
        ),
      ),
    );
  }
}
