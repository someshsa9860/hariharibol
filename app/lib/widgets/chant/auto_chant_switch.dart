import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../services/mantra_auto_chant_session.dart';
import '../../services/mantra_repetition_counter.dart';

/// The auto-count toggle: a switch plus one line of status underneath it —
/// listening, just counted, or why it isn't running. Only ever shown for a
/// mantra [MantraAutoChantSession.isSupported] is true for; a screen that
/// cannot hear a mantra does not offer to.
class AutoChantSwitch extends StatelessWidget {
  const AutoChantSwitch({super.key, required this.status, required this.onChanged});

  final AutoChantStatus status;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(text.sadhanaAutoCount, style: context.texts.bodyMedium),
            const SizedBox(width: AppSpacing.sm),
            Switch(value: status.enabled, onChanged: onChanged),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          _statusText(text, status),
          style: context.texts.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
        ),
      ],
    );
  }

  String _statusText(AppLocalizations text, AutoChantStatus status) {
    switch (status.error) {
      case AutoChantError.permissionDenied:
        return text.sadhanaAutoCountPermissionDenied;
      case AutoChantError.unavailable:
        return text.sadhanaAutoCountUnavailable;
      case null:
        break;
    }
    if (!status.enabled) return text.sadhanaAutoCountOff;
    return switch (status.phase) {
      AutoChantPhase.idle => text.sadhanaAutoCountIdle,
      AutoChantPhase.listening => text.sadhanaAutoCountListening,
      AutoChantPhase.cooldown => text.sadhanaAutoCountCounted,
    };
  }
}
