import 'package:flutter/material.dart';

import '../../core/constants/chat_config.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';

/// The box a question is typed in, with one button that is Send until a reply
/// is being written and Stop while it is.
class ChatComposer extends StatelessWidget {
  const ChatComposer({
    super.key,
    required this.controller,
    required this.maxChars,
    required this.busy,
    required this.enabled,
    required this.onSend,
    required this.onStop,
  });

  final TextEditingController controller;
  final int maxChars;

  /// A reply is being written: the button stops it, and a new question waits.
  final bool busy;

  /// False when nothing can be sent (no credits): the box stays but is dim.
  final bool enabled;
  final ValueChanged<String> onSend;
  final VoidCallback onStop;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.sm, AppSpacing.lg, AppSpacing.md),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                enabled: enabled,
                minLines: 1,
                maxLines: ChatConfig.composerMaxLines,
                maxLength: maxChars,
                keyboardType: TextInputType.multiline,
                textInputAction: TextInputAction.newline,
                textCapitalization: TextCapitalization.sentences,
                decoration: InputDecoration(hintText: text.chatComposerHint),
                buildCounter: (context, {required currentLength, required isFocused, required maxLength}) {
                  final limit = maxLength ?? maxChars;
                  if (currentLength < limit * ChatConfig.counterShowsAt) return null;
                  return Text(
                    text.chatCharacterCount(currentLength, limit),
                    style: context.texts.bodySmall,
                  );
                },
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Padding(
              // Lines up with the box, not with the counter beneath it.
              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
              child: ValueListenableBuilder<TextEditingValue>(
                valueListenable: controller,
                builder: (context, value, _) {
                  final canSend = enabled && !busy && value.text.trim().isNotEmpty;
                  return IconButton.filled(
                    tooltip: busy ? text.chatStop : text.chatSend,
                    onPressed: busy
                        ? onStop
                        : canSend
                            ? () => onSend(value.text)
                            : null,
                    icon: Icon(busy ? Icons.stop_rounded : Icons.arrow_upward_rounded),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
