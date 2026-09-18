import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../providers/languages_provider.dart';
import '../../providers/sadhana_provider.dart';
import '../../providers/session_provider.dart';
import '../../providers/theme_provider.dart';
import '../../services/auth_service.dart';
import '../../services/device_service.dart';
import '../../services/sadhana_service.dart';
import '../../widgets/settings/daily_goal_sheet.dart';
import '../../widgets/settings/identity_header.dart';
import '../../widgets/settings/mantra_picker_sheet.dart';
import '../../widgets/settings/settings_group.dart';

/// Everything the account can change about itself.
///
/// The two stores insist that signing out and deleting the account are both
/// reachable from inside the app, so they live here rather than behind a
/// support email.
class SettingsView extends ConsumerWidget {
  const SettingsView({super.key});

  Future<void> _signOut(BuildContext context) async {
    final text = AppLocalizations.of(context);
    final navigator = AppNavigator.instance;

    final confirmed = await navigator.confirm(
      title: text.actionSignOut,
      message: text.signOutConfirm,
      confirmLabel: text.actionSignOut,
    );
    if (!confirmed) return;

    // No navigation afterwards: clearing the session notifies the router, and
    // the redirect takes everyone to the sign-in screen.
    await navigator.loading.wrap(AuthService.instance.signOut);
  }

  Future<void> _deleteAccount(BuildContext context) async {
    final text = AppLocalizations.of(context);
    final navigator = AppNavigator.instance;

    final confirmed = await navigator.confirm(
      title: text.deleteAccountTitle,
      message: text.deleteAccountBody,
      confirmLabel: text.actionDeleteAccount,
      isDestructive: true,
    );
    if (!confirmed) return;

    try {
      await navigator.loading.wrap(AuthService.instance.deleteAccount);
    } on ApiFailure catch (failure) {
      navigator.showFailure(failure);
    }
  }

  Future<void> _pickTheme(BuildContext context, WidgetRef ref) async {
    final text = AppLocalizations.of(context);
    final current = ref.read(themeModeProvider);

    final chosen = await showModalBottomSheet<ThemeMode>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final entry in {
              ThemeMode.system: text.themeSystem,
              ThemeMode.light: text.themeLight,
              ThemeMode.dark: text.themeDark,
            }.entries)
              ListTile(
                title: Text(entry.value),
                trailing: entry.key == current
                    ? Icon(Icons.check_rounded, color: context.colors.primary)
                    : null,
                onTap: () => Navigator.of(context).pop(entry.key),
              ),
            const SizedBox(height: AppSpacing.lg),
          ],
        ),
      ),
    );

    if (chosen != null) await ref.read(themeModeProvider.notifier).set(chosen);
  }

  String _themeLabel(AppLocalizations text, ThemeMode mode) => switch (mode) {
    ThemeMode.light => text.themeLight,
    ThemeMode.dark => text.themeDark,
    ThemeMode.system => text.themeSystem,
  };

  Future<void> _pickDailyGoal(
    BuildContext context,
    WidgetRef ref,
    int current,
  ) async {
    final chosen = await showDailyGoalSheet(context, initial: current);
    if (chosen == null || chosen == current) return;

    final navigator = AppNavigator.instance;
    try {
      await navigator.loading.wrap(
        () => SadhanaService.instance.updateDailyGoal(chosen),
      );
      await ref.read(sadhanaTodayProvider.notifier).refresh();
    } on ApiFailure catch (failure) {
      navigator.showFailure(failure);
    }
  }

  Future<void> _pickPreferredMantra(
    BuildContext context,
    WidgetRef ref,
    String? current,
  ) async {
    final chosen = await showMantraPickerSheet(context, currentId: current);
    if (chosen == null) return;
    final mantraId = chosen == clearPreferredMantra ? null : chosen;
    if (mantraId == current) return;

    final navigator = AppNavigator.instance;
    try {
      await navigator.loading.wrap(
        () => SadhanaService.instance.setPreferredMantra(mantraId),
      );
      await ref.read(sadhanaTodayProvider.notifier).refresh();
    } on ApiFailure catch (failure) {
      navigator.showFailure(failure);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final user = ref.watch(currentUserProvider);
    final themeMode = ref.watch(themeModeProvider);
    final profile = ref.watch(sadhanaTodayProvider).value?.profile;

    // The language is shown by its own name, not its code — "hi" means nothing
    // to the person who chose हिन्दी.
    final languages = ref.watch(languagesProvider).value ?? const [];
    final appLanguage = languages
        .where((language) => language.code == user?.appLanguage)
        .map((language) => language.nativeName)
        .firstOrNull;

    return Scaffold(
      appBar: AppBar(
        title: Text(text.settingsTitle, style: context.texts.headlineSmall),
      ),
      body: ListView(
        padding: AppSpacing.page,
        children: [
          if (user != null) ...[
            IdentityHeader(user: user),
            const SizedBox(height: AppSpacing.xl),
          ],

          SettingsGroup(
            title: text.settingsSectionPractice,
            children: [
              SettingsRow(
                icon: Icons.language_rounded,
                label: text.settingsLanguage,
                value: appLanguage ?? user?.appLanguage,
                onTap: () =>
                    AppNavigator.instance.push(AppRoutes.languageSetup),
              ),
              SettingsRow(
                icon: Icons.track_changes_rounded,
                label: text.settingsDailyGoal,
                value: text.sadhanaRoundsShort(profile?.dailyRoundTarget ?? 16),
                onTap: () => _pickDailyGoal(
                  context,
                  ref,
                  profile?.dailyRoundTarget ?? 16,
                ),
              ),
              SettingsRow(
                icon: Icons.self_improvement_rounded,
                label: text.settingsPreferredMantra,
                value:
                    profile?.preferredMantraName ??
                    text.settingsPreferredMantraNone,
                onTap: () => _pickPreferredMantra(
                  context,
                  ref,
                  profile?.preferredMantraId,
                ),
              ),
              SettingsRow(
                icon: Icons.brightness_6_rounded,
                label: text.settingsTheme,
                value: _themeLabel(text, themeMode),
                onTap: () => _pickTheme(context, ref),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),

          SettingsGroup(
            title: text.settingsSectionAccount,
            children: [
              SettingsRow(
                icon: Icons.logout_rounded,
                label: text.actionSignOut,
                isDestructive: true,
                onTap: () => _signOut(context),
              ),
              SettingsRow(
                icon: Icons.delete_outline_rounded,
                label: text.actionDeleteAccount,
                isDestructive: true,
                onTap: () => _deleteAccount(context),
              ),
            ],
          ),

          const SizedBox(height: AppSpacing.xxl),
          Center(
            child: Text(
              '${text.settingsVersion(DeviceService.instance.appVersion)} · '
              '${text.settingsMadeWith}',
              style: context.texts.bodySmall,
            ),
          ),
        ],
      ),
    );
  }
}
