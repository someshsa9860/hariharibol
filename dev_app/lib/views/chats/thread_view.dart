import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../providers/chat_provider.dart';
import '../../widgets/chat/composer.dart';
import '../../widgets/chat/message_bubble.dart';
import '../../widgets/common/error_panel.dart';
import '../../widgets/common/person_avatar.dart';

/// One conversation with a reader. New messages arrive live; opening it marks the reader's messages read.
class ThreadView extends ConsumerStatefulWidget {
  const ThreadView({super.key, required this.conversationId});

  final String conversationId;

  @override
  ConsumerState<ThreadView> createState() => _ThreadViewState();
}

class _ThreadViewState extends ConsumerState<ThreadView> {
  final ScrollController _scroll = ScrollController();
  late final OpenThread _open;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      // The list is reversed, so "the end" is the oldest message.
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 300) {
        ref.read(threadProvider(widget.conversationId).notifier).loadOlder().ignore();
      }
    });
    _open = ref.read(openThreadProvider.notifier);
    Future.microtask(() => _open.set(widget.conversationId));
  }

  @override
  void dispose() {
    // After the frame, so the provider is not changed while the tree is being torn down.
    Future.microtask(() => _open.set(null));
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final thread = ref.watch(threadProvider(widget.conversationId));
    final notifier = ref.read(threadProvider(widget.conversationId).notifier);

    return Scaffold(
      appBar: AppBar(
        title: thread.maybeWhen(
          data: (state) => Row(
            children: [
              PersonAvatar(person: state.conversation.person, radius: 16),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(state.conversation.person.displayName, maxLines: 1, overflow: TextOverflow.ellipsis),
                    Text(
                      state.conversation.person.email,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
          orElse: () => Text(text.tabChats),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: thread.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => ErrorPanel(error: error, onRetry: () => ref.invalidate(threadProvider(widget.conversationId))),
              data: (state) {
                final messages = state.messages.reversed.toList();
                return ListView.builder(
                  controller: _scroll,
                  reverse: true,
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
                  itemCount: messages.length + (state.loadingOlder ? 1 : 0),
                  itemBuilder: (context, index) {
                    if (index >= messages.length) {
                      return const Padding(padding: EdgeInsets.all(AppSpacing.md), child: Center(child: CircularProgressIndicator()));
                    }
                    final message = messages[index];
                    return MessageBubble(
                      body: message.body,
                      createdAt: message.createdAt,
                      mine: message.fromDeveloper,
                      pending: message.pending,
                      failed: message.failed,
                      onRetry: () => notifier.retry(message.id),
                    );
                  },
                );
              },
            ),
          ),
          Composer(onSend: notifier.send),
        ],
      ),
    );
  }
}
