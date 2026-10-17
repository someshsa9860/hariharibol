import 'package:flutter/material.dart';

import '../../core/constants/chat_config.dart';
import '../../core/theme/app_spacing.dart';
import '../../providers/chat_state.dart';
import 'chat_jump_button.dart';
import 'chat_message_bubble.dart';

/// The messages, newest at the bottom. The list is reversed, so a message that
/// grows while it is written grows upward from a fixed bottom edge and the
/// reader's place is never moved under them.
///
/// Only messages that arrive while this is on screen come in with a motion;
/// the ones already there when it opened are simply there. The [controller] is
/// the screen's, so it can take the list back to the newest message after a send.
class ChatMessageList extends StatefulWidget {
  const ChatMessageList({
    super.key,
    required this.state,
    required this.controller,
    required this.onRegenerate,
  });

  final ChatState state;
  final ScrollController controller;
  final VoidCallback onRegenerate;

  @override
  State<ChatMessageList> createState() => _ChatMessageListState();
}

class _ChatMessageListState extends State<ChatMessageList> {
  /// What was already in the chat when this opened.
  late final Set<String> _seen = {for (final message in widget.state.messages) message.clientKey};

  bool _away = false;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onScroll);
  }

  @override
  void didUpdateWidget(ChatMessageList old) {
    super.didUpdateWidget(old);
    if (old.controller != widget.controller) {
      old.controller.removeListener(_onScroll);
      widget.controller.addListener(_onScroll);
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onScroll);
    super.dispose();
  }

  void _onScroll() {
    final away = widget.controller.hasClients && widget.controller.offset > ChatConfig.jumpToLatestAt;
    if (away != _away) setState(() => _away = away);
  }

  void _jumpToLatest() {
    final controller = widget.controller;
    if (!controller.hasClients) return;
    if (MediaQuery.disableAnimationsOf(context)) {
      controller.jumpTo(0);
    } else {
      controller.animateTo(0, duration: AppDurations.slow, curve: Curves.easeOutCubic);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    final messages = state.messages;
    final lastIndex = messages.length - 1;

    return Stack(
      children: [
        ListView.separated(
          controller: widget.controller,
          reverse: true,
          padding: AppSpacing.page.copyWith(top: AppSpacing.lg, bottom: AppSpacing.lg),
          itemCount: messages.length,
          separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.xl),
          itemBuilder: (context, index) {
            final at = lastIndex - index;
            final message = messages[at];
            final isLast = at == lastIndex;

            return ChatMessageBubble(
              key: ValueKey(message.clientKey),
              message: message,
              // The question and its answer: only the newest two can be new.
              animateIn: !_seen.contains(message.clientKey) && lastIndex - at < 2,
              streaming: isLast && message.isAssistant && state.phase != ChatPhase.idle,
              compacting: state.compacting,
              onRegenerate: isLast && message.isAssistant && !state.busy ? widget.onRegenerate : null,
            );
          },
        ),
        Positioned(
          bottom: AppSpacing.md,
          left: 0,
          right: 0,
          child: Center(child: ChatJumpButton(visible: _away, onPressed: _jumpToLatest)),
        ),
      ],
    );
  }
}
