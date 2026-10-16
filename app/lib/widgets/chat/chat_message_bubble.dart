import 'package:flutter/material.dart';

import '../../core/constants/chat_config.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/chat.dart';
import 'chat_markdown.dart';
import 'chat_message_actions.dart';
import 'typing_indicator.dart';

/// One message. The reader's own sit on the right in a tinted bubble; the
/// assistant's run the full width as plain text on the page, like a page of a
/// book rather than a speech balloon — an answer can hold a table or a shloka,
/// and those want the width.
class ChatMessageBubble extends StatelessWidget {
  const ChatMessageBubble({
    super.key,
    required this.message,
    this.streaming = false,
    this.compacting = false,
    this.onRegenerate,
  });

  final ChatMessage message;

  /// The answer is still being written (or about to start).
  final bool streaming;

  /// "Tidying our conversation…" while waiting for the first word.
  final bool compacting;

  /// Set on the last answer only.
  final VoidCallback? onRegenerate;

  @override
  Widget build(BuildContext context) {
    return message.isUser ? _UserBubble(content: message.content) : _AssistantMessage(
      message: message,
      streaming: streaming,
      compacting: compacting,
      onRegenerate: onRegenerate,
    );
  }
}

class _UserBubble extends StatelessWidget {
  const _UserBubble({required this.content});

  final String content;

  @override
  Widget build(BuildContext context) {
    final maxWidth = MediaQuery.sizeOf(context).width * ChatConfig.bubbleMaxShare;

    return Align(
      alignment: AlignmentDirectional.centerEnd,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: context.colors.primaryContainer,
            borderRadius: AppRadius.lgAll,
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
            child: SelectableText(
              content,
              style: context.texts.bodyLarge?.copyWith(color: context.colors.onPrimaryContainer),
            ),
          ),
        ),
      ),
    );
  }
}

class _AssistantMessage extends StatelessWidget {
  const _AssistantMessage({
    required this.message,
    required this.streaming,
    required this.compacting,
    required this.onRegenerate,
  });

  final ChatMessage message;
  final bool streaming;
  final bool compacting;
  final VoidCallback? onRegenerate;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final waiting = streaming && message.content.isEmpty;
    final ended = !streaming && message.content.isNotEmpty;

    // Its own layer: the text under it repaints every fifty milliseconds while
    // the answer arrives, and nothing else on the screen should repaint with it.
    return RepaintBoundary(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (waiting)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
              child: Row(
                children: [
                  const TypingIndicator(),
                  if (compacting) ...[
                    const SizedBox(width: AppSpacing.md),
                    Flexible(child: Text(text.chatTidying, style: context.texts.bodySmall)),
                  ],
                ],
              ),
            )
          else
            ChatMarkdown(data: message.content, streaming: streaming),
          if (ended && _endNote(text) != null)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.xs),
              child: Text(_endNote(text)!, style: context.texts.bodySmall),
            ),
          if (ended) ChatMessageActions(content: message.content, onRegenerate: onRegenerate),
        ],
      ),
    );
  }

  /// A reply that did not run to its end says so, in words — not only in a mark.
  String? _endNote(AppLocalizations text) => switch (message.status) {
        ChatMessageStatus.stopped => text.chatStopped,
        ChatMessageStatus.partial || ChatMessageStatus.error => text.chatInterrupted,
        ChatMessageStatus.complete => null,
      };
}
