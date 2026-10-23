import 'package:flutter/material.dart';

import '../../core/format/failure_text.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../services/auth_service.dart';

/// Google sign-in. A successful one changes the session and the router moves on by itself; an account without
/// developer access is told so here.
class SignInView extends StatefulWidget {
  const SignInView({super.key});

  @override
  State<SignInView> createState() => _SignInViewState();
}

class _SignInViewState extends State<SignInView> {
  bool _busy = false;
  String? _error;

  Future<void> _signIn() async {
    final text = AppLocalizations.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AuthService.instance.signInWithGoogle();
    } on SignInCancelled {
      // Closed the sheet: nothing to say.
    } on ApiFailure catch (failure) {
      _error = failure.describe(text);
    } catch (_) {
      _error = text.errorGeneric;
    }
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Icon(Icons.monitor_heart_outlined, size: 56, color: theme.colorScheme.primary),
                  const SizedBox(height: AppSpacing.lg),
                  Text(text.signInTitle, textAlign: TextAlign.center, style: theme.textTheme.headlineSmall),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    text.signInBody,
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  FilledButton.icon(
                    onPressed: _busy ? null : _signIn,
                    icon: _busy
                        ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.login),
                    label: Text(_busy ? text.signInBusy : text.signInGoogle),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: AppSpacing.lg),
                    Text(_error!, textAlign: TextAlign.center, style: TextStyle(color: theme.colorScheme.error)),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
