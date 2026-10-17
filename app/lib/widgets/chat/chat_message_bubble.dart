import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../core/constants/chat_config.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/chat.dart';
import '../common/animations.dart';
import 'chat_image_viewer.dart';
import 'chat_markdown.dart';
import 'chat_message_actions.dart';
import 'sakha_avatar.dart';
import 'typing_indicator.dart';

/// One message. The reader's sit on the right in a tinted bubble whose corner
/// points at them; Sakha's sit on the left beside a small lotus, on the lighter
/// plane the app uses for cards. A message that arrives after the screen opened
/// rises into place ([animateIn]); one that was already there, or that scrolls
/// back into view, does not move.
class ChatMessageBubble extends StatelessWidget {
  const ChatMessageBubble({
    super.key,
    required this.message,
    this.animateIn = false,
    this.streaming = false,
    this.compacting = false,
    this.onRegenerate,
  });

  final ChatMessage message;
  final bool animateIn;

  /// The answer is still being written (or about to start).
  final bool streaming;

  /// "Tidying our conversation…" while waiting for the first word.
  final bool compacting;

  /// Set on the last answer only.
  final VoidCallback? onRegenerate;

  @override
  Widget build(BuildContext context) {
    final body = message.isUser
        ? _UserBubble(message: message)
        : _AssistantMessage(message: message, streaming: streaming, compacting: compacting, onRegenerate: onRegenerate);

    if (!animateIn) return body;
    return FadeSlideIn(rise: ChatConfig.messageRise, duration: ChatConfig.messageEntrance, child: body);
  }
}

class _UserBubble extends StatelessWidget {
  const _UserBubble({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final maxWidth = MediaQuery.sizeOf(context).width * ChatConfig.bubbleMaxShare;
    final colors = context.colors;
    const round = Radius.circular(AppRadius.lg);

    return Align(
      alignment: AlignmentDirectional.centerEnd,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: colors.primaryContainer,
            borderRadius: const BorderRadiusDirectional.only(
              topStart: round,
              topEnd: round,
              bottomStart: round,
              bottomEnd: Radius.circular(ChatConfig.bubbleTailRadius),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (message.hasImage) _SentImage(message: message),
              if (message.content.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
                  child: SelectableText(
                    message.content,
                    style: context.texts.bodyLarge?.copyWith(color: colors.onPrimaryContainer),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The picture inside the reader's own bubble; a tap opens it large.
class _SentImage extends StatelessWidget {
  const _SentImage({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final path = message.localImagePath;
    final url = message.imageUrl;
    final broken = ColoredBox(
      color: context.colors.surfaceContainerHighest,
      child: Center(child: Icon(Icons.image_outlined, color: context.colors.onSurfaceVariant)),
    );

    final Widget picture = path != null
        ? Image.file(
            File(path),
            fit: BoxFit.cover,
            cacheWidth: (ChatConfig.sentImageSize * MediaQuery.devicePixelRatioOf(context)).round(),
            errorBuilder: (_, _, _) => broken,
          )
        : CachedNetworkImage(
            imageUrl: url ?? '',
            fit: BoxFit.cover,
            placeholder: (_, _) => broken,
            errorWidget: (_, _, _) => broken,
          );

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xs),
      child: Semantics(
        button: true,
        image: true,
        label: text.chatImageSemantics,
        child: GestureDetector(
          onTap: () => showChatImage(context, path: path, url: path == null ? url : null),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.lg - AppSpacing.xs),
            child: SizedBox.square(dimension: ChatConfig.sentImageSize, child: picture),
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
    final colors = context.colors;
    final waiting = streaming && message.content.isEmpty;
    final ended = !streaming && message.content.isNotEmpty;
    final note = ended ? _endNote(text) : null;
    final maxWidth = MediaQuery.sizeOf(context).width * ChatConfig.bubbleMaxShare;
    const round = Radius.circular(AppRadius.lg);

    // Its own layer: the text under it repaints every fifty milliseconds while
    // the answer arrives, and nothing else on the screen should repaint with it.
    return RepaintBoundary(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SakhaAvatar(size: ChatConfig.bubbleAvatar),
          const SizedBox(width: AppSpacing.sm),
          Flexible(
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: maxWidth),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  DecoratedBox(
                    decoration: BoxDecoration(
                      color: colors.surfaceContainerLowest,
                      border: Border.all(color: colors.outlineVariant),
                      borderRadius: const BorderRadiusDirectional.only(
                        topStart: Radius.circular(ChatConfig.bubbleTailRadius),
                        topEnd: round,
                        bottomStart: round,
                        bottomEnd: round,
                      ),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
                      child: waiting
                          ? Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const TypingIndicator(),
                                if (compacting) ...[
                                  const SizedBox(width: AppSpacing.md),
                                  Flexible(child: Text(text.chatTidying, style: context.texts.bodySmall)),
                                ],
                              ],
                            )
                          : ChatMarkdown(data: message.content, streaming: streaming),
                    ),
                  ),
                  if (note != null)
                    Padding(
                      padding: const EdgeInsets.only(top: AppSpacing.xs, left: AppSpacing.xs),
                      child: Text(note, style: context.texts.bodySmall),
                    ),
                  if (ended) ChatMessageActions(content: message.content, onRegenerate: onRegenerate),
                ],
              ),
            ),
          ),
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
