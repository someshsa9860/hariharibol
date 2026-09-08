import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../providers/session_provider.dart';
import '../../services/auth_service.dart';
import '../../widgets/common/app_image.dart';

/// The account: who is signed in, whether they are premium, and the two things
/// both app stores insist are reachable from inside the app — signing out and
/// deleting the account.
class ProfileTab extends ConsumerWidget {
  const ProfileTab({super.key});

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

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final user = ref.watch(currentUserProvider);

    return Scaffold(
      appBar: AppBar(title: Text(text.tabProfile)),
      body: ListView(
        padding: AppSpacing.page,
        children: [
          Row(
            children: [
              AppImage(
                url: user?.avatarUrl,
                cacheKey: user == null ? null : 'avatar-${user.id}',
                width: AppSizes.avatarLg,
                height: AppSizes.avatarLg,
                borderRadius: AppRadius.lgAll,
              ),
              const SizedBox(width: AppSpacing.lg),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(user?.displayName ?? '', style: context.texts.titleLarge),
                    const SizedBox(height: AppSpacing.xxs),
                    Text(
                      user == null ? '' : text.profileSignedInAs(user.email),
                      style: context.texts.bodySmall,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Chip(
            label: Text(user?.isPremium ?? false ? text.profilePremium : text.profileFree),
            avatar: Icon(
              user?.isPremium ?? false ? Icons.star_rounded : Icons.star_outline_rounded,
              size: AppSizes.iconSm,
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.logout_rounded),
            title: Text(text.actionSignOut),
            onTap: () => _signOut(context),
          ),
          ListTile(
            leading: Icon(Icons.delete_outline_rounded, color: context.colors.error),
            title: Text(
              text.actionDeleteAccount,
              style: TextStyle(color: context.colors.error),
            ),
            onTap: () => _deleteAccount(context),
          ),
        ],
      ),
    );
  }
}
