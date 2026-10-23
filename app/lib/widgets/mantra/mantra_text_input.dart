import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/own_mantra_config.dart';
import '../../core/navigation/app_navigator.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../providers/chat_provider.dart';
import '../chat/chat_dictation.dart';

/// The box a mantra is typed or said in, and the button that looks for it.
///
/// What is said is written into the box, never searched by itself: the reader
/// reads it, mends what the phone misheard, and presses Find.
class MantraTextInput extends ConsumerStatefulWidget {
  const MantraTextInput({
    super.key,
    required this.controller,
    required this.enabled,
    required this.onFind,
  });

  final TextEditingController controller;

  /// False while a search or a save is under way.
  final bool enabled;
  final VoidCallback onFind;

  @override
  ConsumerState<MantraTextInput> createState() => _MantraTextInputState();
}

class _MantraTextInputState extends ConsumerState<MantraTextInput> {
  late final ChatDictation _dictation = ChatDictation(
    input: ref.read(speechInputProvider),
    text: widget.controller,
    onNotice: _notice,
  );

  @override
  void dispose() {
    _dictation.dispose();
    super.dispose();
  }

  void _toggleVoice() {
    _dictation.toggle(
      languageCode: Localizations.localeOf(context).languageCode,
      maxChars: OwnMantraConfig.maxText,
    );
  }

  void _find() {
    _dictation.cancel();
    widget.onFind();
  }

  void _notice(DictationNotice notice) {
    if (!mounted) return;
    final text = AppLocalizations.of(context);
    AppNavigator.instance.showMessage(switch (notice) {
      DictationNotice.denied => text.ownMantraMicDenied,
      DictationNotice.unavailable => text.chatMicUnavailable,
      DictationNotice.heardNothing => text.chatMicNoSpeech,
      DictationNotice.failed => text.chatMicFailed,
    });
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ListenableBuilder(
          listenable: _dictation,
          builder: (context, _) => TextField(
            controller: widget.controller,
            enabled: widget.enabled,
            minLines: 2,
            maxLines: 5,
            maxLength: OwnMantraConfig.maxText,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              hintText: _dictation.listening ? text.chatListening : text.ownMantraInputHint,
              suffixIcon: IconButton(
                tooltip: _dictation.listening ? text.chatMicStop : text.ownMantraMic,
                icon: Icon(_dictation.listening ? Icons.stop_circle_outlined : Icons.mic_none_rounded),
                onPressed: widget.enabled ? _toggleVoice : null,
              ),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        ValueListenableBuilder<TextEditingValue>(
          valueListenable: widget.controller,
          builder: (context, value, _) => FilledButton.icon(
            onPressed: widget.enabled && value.text.trim().isNotEmpty ? _find : null,
            icon: const Icon(Icons.search_rounded),
            label: Text(text.ownMantraFind),
          ),
        ),
      ],
    );
  }
}
