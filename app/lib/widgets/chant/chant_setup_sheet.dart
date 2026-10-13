import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../services/mantra_auto_chant_session.dart';
import 'auto_chant_switch.dart';

/// Where auto-count is switched on, in a sheet over the counter so the ring
/// stays where the thumb expects it. Rebuilt by its caller whenever the status
/// changes, so a permission prompt or a failure shows up here as it happens.
class ChantSetupSheet extends StatelessWidget {
  const ChantSetupSheet({
    super.key,
    required this.autoChantStatus,
    required this.onAutoChant,
  });

  final AutoChantStatus autoChantStatus;
  final ValueChanged<bool> onAutoChant;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(text.chantSetupTitle, style: context.texts.titleLarge),
            const SizedBox(height: AppSpacing.xs),
            Text(
              text.chantSetupSubtitle,
              style: context.texts.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
            ),
            const SizedBox(height: AppSpacing.md),
            Card(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                child: AutoChantSwitch(status: autoChantStatus, onChanged: onAutoChant),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(text.chantSetupDone),
            ),
          ],
        ),
      ),
    );
  }
}
