import 'package:flutter/material.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../services/mantra_auto_chant_session.dart';
import '../../services/mantra_repetition_counter.dart';
import 'chant_toggle_row.dart';

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

    return ChantToggleRow(
      icon: Icons.graphic_eq_rounded,
      title: text.sadhanaAutoCount,
      status: _statusText(text, status),
      value: status.enabled,
      onChanged: onChanged,
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
