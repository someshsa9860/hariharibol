import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';

/// Shown over the counter while auto-count's recogniser loads.
class ChantAutoLoadingDialog extends StatelessWidget {
  const ChantAutoLoadingDialog({super.key});

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: AlertDialog(
        content: Row(
          children: [
            const SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 3)),
            const SizedBox(width: AppSpacing.lg),
            Expanded(child: Text(AppLocalizations.of(context).chantAutoCountLoading)),
          ],
        ),
      ),
    );
  }
}
