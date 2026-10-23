import 'package:flutter/material.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../services/mantra_auto_chant_session.dart';
import '../../services/mantra_repetition_counter.dart';
import 'chant_toggle_row.dart';

/// The auto-count toggle: a switch plus one line of status underneath it —
/// listening, just counted, or why it isn't running. Lives on the counter
/// itself; the choice is remembered, so the counter opens already listening.
/// Counting by time alone ([AutoChantSource.timer]) says so instead of
/// "listening", since nothing is listened to.
///
/// While [resting] the switch is off and cannot be turned: a recording is
/// counting, and auto count would hear it from the speaker and count it twice.
class AutoChantSwitch extends StatelessWidget {
  const AutoChantSwitch({
    super.key,
    required this.status,
    required this.onChanged,
    this.resting = false,
  });

  final AutoChantStatus status;
  final ValueChanged<bool> onChanged;
  final bool resting;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return ChantToggleRow(
      icon: Icons.graphic_eq_rounded,
      title: text.sadhanaAutoCount,
      status: resting ? text.chantAutoCountResting : _statusText(text, status),
      value: !resting && status.enabled,
      onChanged: onChanged,
      enabled: !resting,
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
    if (status.source == AutoChantSource.timer) return text.sadhanaAutoCountTimed;
    return switch (status.phase) {
      AutoChantPhase.idle => text.sadhanaAutoCountIdle,
      AutoChantPhase.listening => text.sadhanaAutoCountListening,
      AutoChantPhase.cooldown => text.sadhanaAutoCountCounted,
    };
  }
}
