import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/app_config.dart';
import '../../core/format/failure_text.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/dev_summary.dart';
import '../../providers/prefs_provider.dart';
import '../../providers/session_provider.dart';
import '../../services/auth_service.dart';
import '../../services/device_service.dart';
import '../../widgets/common/error_panel.dart';
import '../../widgets/live/connection_dot.dart';
import '../../widgets/live/event_style.dart';

/// Account, how pushes behave, and sign-out.
class SettingsView extends ConsumerWidget {
  const SettingsView({super.key});

  Future<void> _save(BuildContext context, WidgetRef ref, DevPrefs next) async {
    final text = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(prefsProvider.notifier).save(next);
    } on ApiFailure catch (failure) {
      messenger.showSnackBar(SnackBar(content: Text(failure.describe(text))));
    }
  }

  Future<void> _signOut(BuildContext context) async {
    final text = AppLocalizations.of(context);
    final sure = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(text.settingsSignOut),
        content: Text(text.settingsSignOutBody),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: Text(text.actionCancel)),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(text.settingsSignOut)),
        ],
      ),
    );
    if (sure == true) await AuthService.instance.signOut();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final user = ref.watch(currentUserProvider);
    final prefs = ref.watch(prefsProvider);

    return Scaffold(
      appBar: AppBar(title: Text(text.tabSettings), actions: const [ConnectionDot()]),
      body: ListView(
        children: [
          if (user != null)
            ListTile(
              leading: CircleAvatar(child: Text(user.displayName.substring(0, 1).toUpperCase())),
              title: Text(user.displayName),
              subtitle: Text(user.email),
            ),
          const Divider(height: 1),
          prefs.when(
            loading: () => const Padding(padding: EdgeInsets.all(AppSpacing.xl), child: Center(child: CircularProgressIndicator())),
            error: (error, _) => SizedBox(height: 200, child: ErrorPanel(error: error, onRetry: () => ref.invalidate(prefsProvider))),
            data: (value) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SwitchListTile(
                  title: Text(text.settingsPush),
                  subtitle: Text(text.settingsPushHelp),
                  value: value.pushEnabled,
                  onChanged: (on) => _save(context, ref, value.copyWith(pushEnabled: on)),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(AppSpacing.gutter, AppSpacing.lg, AppSpacing.gutter, AppSpacing.xs),
                  child: Text(text.settingsMuted, style: theme.textTheme.titleSmall),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.gutter),
                  child: Text(text.settingsMutedHelp, style: theme.textTheme.bodySmall),
                ),
                for (final type in EventStyle.mutable)
                  CheckboxListTile(
                    secondary: Icon(EventStyle.icon(type)),
                    title: Text(EventStyle.label(text, type)),
                    value: value.mutedTypes.contains(type),
                    onChanged: value.pushEnabled
                        ? (muted) => _save(
                              context,
                              ref,
                              value.copyWith(
                                mutedTypes: muted == true
                                    ? [...value.mutedTypes, type]
                                    : value.mutedTypes.where((t) => t != type).toList(),
                              ),
                            )
                        : null,
                  ),
              ],
            ),
          ),
          const Divider(height: 1),
          ListTile(title: Text(text.settingsServer), subtitle: Text(AppConfig.apiBaseUrl)),
          ListTile(title: Text(text.settingsVersion), subtitle: Text(DeviceService.instance.appVersion)),
          ListTile(
            leading: Icon(Icons.logout, color: theme.colorScheme.error),
            title: Text(text.settingsSignOut, style: TextStyle(color: theme.colorScheme.error)),
            onTap: () => _signOut(context),
          ),
        ],
      ),
    );
  }
}
