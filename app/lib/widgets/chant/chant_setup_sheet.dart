import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../services/chant_speech_listener.dart';
import '../../services/mantra_auto_chant_session.dart';
import 'auto_chant_model_row.dart';
import 'auto_chant_switch.dart';
import 'word_detect_switch.dart';

/// The one place the listening helpers are set up: auto-count and word
/// detection together, in a sheet over the counter so the ring stays where the
/// thumb expects it. Rebuilt by its caller whenever either status changes, so
/// a permission prompt or a failure shows up here as it happens.
class ChantSetupSheet extends StatelessWidget {
  const ChantSetupSheet({
    super.key,
    required this.autoChantStatus,
    required this.speechState,
    required this.onAutoChant,
    required this.onWords,
  });

  /// Null when this mantra cannot be heard by auto-count.
  final AutoChantStatus? autoChantStatus;
  final ChantSpeechState speechState;
  final ValueChanged<bool>? onAutoChant;
  final ValueChanged<bool> onWords;

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
                child: Column(
                  children: [
                    if (autoChantStatus != null && onAutoChant != null) ...[
                      AutoChantSwitch(status: autoChantStatus!, onChanged: onAutoChant!),
                      const AutoChantModelRow(),
                      const Divider(),
                    ],
                    WordDetectSwitch(state: speechState, onChanged: onWords),
                  ],
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              text.chantDetectWordsNote,
              style: context.texts.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
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
