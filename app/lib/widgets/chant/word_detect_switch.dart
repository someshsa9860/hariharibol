import 'package:flutter/material.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../services/chant_speech_listener.dart';
import 'chant_toggle_row.dart';

/// Switches on word detection: the device's speech recogniser listens while
/// the user chants, and what it hears is kept beside each tap.
class WordDetectSwitch extends StatelessWidget {
  const WordDetectSwitch({super.key, required this.state, required this.onChanged});

  final ChantSpeechState state;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    final status = switch (state) {
      ChantSpeechState.off => text.chantDetectWordsOff,
      ChantSpeechState.listening => text.chantDetectWordsListening,
      ChantSpeechState.permissionDenied => text.chantDetectWordsPermission,
      ChantSpeechState.unavailable => text.chantDetectWordsUnavailable,
    };

    return ChantToggleRow(
      icon: Icons.record_voice_over_rounded,
      title: text.chantDetectWords,
      status: status,
      value: state == ChantSpeechState.listening,
      onChanged: onChanged,
    );
  }
}
