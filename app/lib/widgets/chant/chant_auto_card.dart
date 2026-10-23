import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../services/mantra_auto_chant_session.dart';
import 'auto_chant_switch.dart';
import 'chant_pace_row.dart';
import 'chant_toggle_row.dart';

/// Everything that sets how a mantra is counted, in one card under the ring: the
/// auto-count switch, whether it listens with the microphone or counts by time
/// (which saves the battery), and how long one chant takes.
///
/// While [resting] — a recording is counting — auto count and the microphone
/// switch cannot be turned; how long a chant takes still can.
class ChantAutoCard extends StatelessWidget {
  const ChantAutoCard({
    super.key,
    required this.status,
    required this.useMicrophone,
    required this.pace,
    required this.standard,
    required this.beadsPerRound,
    required this.onAutoChanged,
    required this.onMicrophoneChanged,
    required this.onPaceChange,
    this.resting = false,
  });

  final AutoChantStatus status;
  final bool useMicrophone;
  final Duration pace;
  final Duration standard;
  final int beadsPerRound;
  final ValueChanged<bool> onAutoChanged;
  final ValueChanged<bool> onMicrophoneChanged;
  final void Function({required bool longer}) onPaceChange;
  final bool resting;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
        child: Column(
          children: [
            AutoChantSwitch(status: status, onChanged: onAutoChanged, resting: resting),
            const Divider(height: 1),
            ChantToggleRow(
              icon: useMicrophone ? Icons.mic_rounded : Icons.mic_off_rounded,
              title: text.chantAutoMicTitle,
              status: useMicrophone ? text.chantAutoMicOn : text.chantAutoMicOff,
              value: useMicrophone,
              onChanged: onMicrophoneChanged,
              enabled: !resting,
            ),
            const Divider(height: 1),
            ChantPaceRow(
              pace: pace,
              standard: standard,
              beadsPerRound: beadsPerRound,
              onChange: onPaceChange,
            ),
          ],
        ),
      ),
    );
  }
}
