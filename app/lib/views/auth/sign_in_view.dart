import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../services/auth_service.dart';
import '../../widgets/auth/social_sign_in_button.dart';

/// The only door into the app.
///
/// There is no sign-up screen: the backend cannot tell a first sign-in from a
/// returning one until the provider token is verified, and Apple gives no way
/// to ask beforehand. One screen, one call, both cases.
class SignInView extends ConsumerStatefulWidget {
  const SignInView({super.key});

  @override
  ConsumerState<SignInView> createState() => _SignInViewState();
}

class _SignInViewState extends ConsumerState<SignInView> {
  bool _busy = false;

  Future<void> _signIn(Future<void> Function() attempt) async {
    if (_busy) return;
    setState(() => _busy = true);

    try {
      await AppNavigator.instance.loading.wrap(attempt);
      // No navigation here. The session notifies, the router redirects — which
      // is also what happens when a token dies mid-session, so there is one
      // path in and out rather than two.
    } on SignInCancelled {
      // Closing the sheet is an answer, not an error.
    } on ApiFailure catch (failure) {
      AppNavigator.instance.showFailure(failure);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final auth = AuthService.instance;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.xl,
              vertical: AppSpacing.xxl,
            ),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: AppSizes.readingMaxWidth),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    text.appName,
                    textAlign: TextAlign.center,
                    style: context.texts.displaySmall?.copyWith(color: context.colors.primary),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    text.signInTitle,
                    textAlign: TextAlign.center,
                    style: context.texts.headlineSmall,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    text.signInSubtitle,
                    textAlign: TextAlign.center,
                    style: context.texts.bodyMedium?.copyWith(
                      color: context.colors.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xxxl),

                  SocialSignInButton(
                    label: text.signInWithGoogle,
                    icon: const Icon(Icons.g_mobiledata_rounded, size: AppSizes.iconLg),
                    filled: true,
                    onPressed: _busy ? null : () => _signIn(auth.signInWithGoogle),
                  ),

                  if (auth.isAppleAvailable) ...[
                    const SizedBox(height: AppSpacing.md),
                    SocialSignInButton(
                      label: text.signInWithApple,
                      icon: const Icon(Icons.apple, size: AppSizes.iconMd),
                      onPressed: _busy ? null : () => _signIn(auth.signInWithApple),
                    ),
                  ],

                  const SizedBox(height: AppSpacing.xl),
                  Text(
                    text.signInLegal,
                    textAlign: TextAlign.center,
                    style: context.texts.bodySmall,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
