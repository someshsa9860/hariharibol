import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';

/// What a screen shows when a load fails.
///
/// It takes the [ApiFailure] rather than a string so the message, the icon and
/// whether a retry is even offered all come from the same decision — there is
/// no point offering "try again" for a 403.
class AppErrorView extends StatelessWidget {
  const AppErrorView({super.key, required this.failure, this.onRetry});

  final ApiFailure failure;
  final Future<void> Function()? onRetry;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final canRetry = onRetry != null && failure.kind != FailureKind.forbidden;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              failure.isNetwork ? Icons.wifi_off_rounded : Icons.error_outline_rounded,
              size: AppSizes.avatarMd,
              color: context.colors.onSurfaceVariant,
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              failure.message.isEmpty ? text.errorGeneric : failure.message,
              textAlign: TextAlign.center,
              style: context.texts.bodyMedium,
            ),
            if (canRetry) ...[
              const SizedBox(height: AppSpacing.xl),
              OutlinedButton(
                onPressed: onRetry,
                child: Text(text.actionRetry),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
