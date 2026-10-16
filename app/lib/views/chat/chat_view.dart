import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/chat_config.dart';
import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/chat.dart';
import '../../providers/chat_controller.dart';
import '../../providers/chat_provider.dart';
import '../../providers/chat_state.dart';
import '../../widgets/chat/chat_composer.dart';
import '../../widgets/chat/chat_credit_meter.dart';
import '../../widgets/chat/chat_credits_card.dart';
import '../../widgets/chat/chat_intro.dart';
import '../../widgets/chat/chat_message_bubble.dart';
import '../../widgets/chat/chat_notices.dart';
import '../../widgets/chat/rename_chat_dialog.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';

enum _MenuAction { compact, rename, delete }

/// One conversation: the messages, the box to type in, the credit meter, and
/// the menu. A chat opened at `/chat/new` has no conversation yet; it is made
/// on the server when the first message is sent.
class ChatView extends ConsumerStatefulWidget {
  const ChatView({super.key, required this.conversationId});

  final String conversationId;

  @override
  ConsumerState<ChatView> createState() => _ChatViewState();
}

class _ChatViewState extends ConsumerState<ChatView> {
  final TextEditingController _composer = TextEditingController();
  final ScrollController _scroll = ScrollController();

  @override
  void dispose() {
    _composer.dispose();
    _scroll.dispose();
    super.dispose();
  }

  ChatController get _chat => ref.read(chatControllerProvider(widget.conversationId).notifier);

  void _send(String value) {
    _composer.clear();
    _chat.send(value);
    // The list is upside down, so the newest message is at offset zero.
    if (_scroll.hasClients) _scroll.jumpTo(0);
  }

  /// A question the server refused comes back into the box.
  void _takeDraft(ChatState? previous, ChatState next) {
    final draft = next.restoredDraft;
    if (draft == null || draft == previous?.restoredDraft) return;
    if (_composer.text.isEmpty) {
      _composer.value = TextEditingValue(
        text: draft,
        selection: TextSelection.collapsed(offset: draft.length),
      );
    }
    _chat.draftRestored();
  }

  Future<void> _upgrade() async {
    await AppNavigator.instance.push(AppRoutes.plans);
    if (mounted) ref.read(chatStatusProvider.notifier).refresh();
  }

  Future<void> _startNewChat() async {
    final text = AppLocalizations.of(context);
    try {
      final result = await _chat.startNewChat();
      if (result == null || !mounted) return;
      if (!result.carriedEverything) AppNavigator.instance.showMessage(text.chatContinuePartial);
      await AppNavigator.instance.replace<void>(AppRoutes.chatPath(result.conversation.id));
    } on ApiFailure catch (failure) {
      AppNavigator.instance.showFailure(failure);
    }
  }

  Future<void> _onMenu(_MenuAction action, ChatConversation conversation) async {
    final text = AppLocalizations.of(context);
    final navigator = AppNavigator.instance;

    try {
      switch (action) {
        case _MenuAction.compact:
          final compacted = await _chat.compact();
          navigator.showMessage(compacted ? text.chatCompactDone : text.chatCompactNothing);
        case _MenuAction.rename:
          final name = await askChatName(context, current: conversation.title);
          if (name != null && name != conversation.title) await _chat.rename(name);
        case _MenuAction.delete:
          final confirmed = await navigator.confirm(
            title: text.chatDeleteTitle,
            message: text.chatDeleteBody,
            confirmLabel: text.actionDelete,
            isDestructive: true,
          );
          if (!confirmed) return;
          await _chat.delete();
          navigator.pop();
      }
    } on ApiFailure catch (failure) {
      navigator.showFailure(failure);
    }
  }

  /// Why the reader cannot send right now, if they cannot.
  ({ChatCreditsKind kind, bool canUpgrade, DateTime? resetsAt})? _creditsNotice(
    ChatProblem? problem,
    ChatCredits? credits,
  ) {
    if (problem != null && problem.issue == ChatIssue.notAvailable) {
      return (kind: ChatCreditsKind.notAvailable, canUpgrade: problem.canUpgrade, resetsAt: null);
    }
    if (problem != null && problem.issue == ChatIssue.creditsExhausted) {
      final kind = problem.startNewChat
          ? ChatCreditsKind.chatShare
          : problem.limitedBy == ChatLimitedBy.daily
              ? ChatCreditsKind.daily
              : ChatCreditsKind.wallet;
      return (kind: kind, canUpgrade: problem.canUpgrade, resetsAt: problem.resetsAt);
    }
    if (credits != null && !credits.enabled) {
      return (kind: ChatCreditsKind.notAvailable, canUpgrade: credits.canUpgrade, resetsAt: null);
    }
    if (credits != null && credits.exhausted) {
      final kind = credits.limitedBy == ChatLimitedBy.daily ? ChatCreditsKind.daily : ChatCreditsKind.wallet;
      return (kind: kind, canUpgrade: credits.canUpgrade, resetsAt: credits.resetsAt);
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final id = widget.conversationId;
    final state = ref.watch(chatControllerProvider(id));
    final status = ref.watch(chatStatusProvider).value;
    ref.listen(chatControllerProvider(id), _takeDraft);

    final conversation = state.conversation;
    final credits = status?.credits;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          conversation?.title ?? text.chatNewChat,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          if (conversation != null && state.loaded)
            PopupMenuButton<_MenuAction>(
              tooltip: text.chatMoreActions,
              enabled: !state.busy,
              onSelected: (action) => _onMenu(action, conversation),
              itemBuilder: (_) => [
                PopupMenuItem(value: _MenuAction.compact, child: Text(text.chatMenuCompact)),
                PopupMenuItem(value: _MenuAction.rename, child: Text(text.chatMenuRename)),
                PopupMenuItem(value: _MenuAction.delete, child: Text(text.actionDelete)),
              ],
            ),
        ],
        bottom: credits == null
            ? null
            : PreferredSize(
                preferredSize: const Size.fromHeight(ChatCreditMeter.extent),
                child: ChatCreditMeter(credits: credits),
              ),
      ),
      body: _body(context, state, status),
    );
  }

  Widget _body(BuildContext context, ChatState state, ChatStatus? status) {
    final failure = state.loadFailure;
    if (failure != null) {
      return AppErrorView(failure: failure, onRetry: _chat.reload);
    }
    if (!state.loaded) return const AppLoader();

    final text = AppLocalizations.of(context);
    final problem = state.problem;
    final notice = _creditsNotice(problem, status?.credits);
    final showsProblem = problem != null &&
        problem.issue != ChatIssue.creditsExhausted &&
        problem.issue != ChatIssue.notAvailable &&
        problem.issue != ChatIssue.conversationFull;

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: AppSizes.readingMaxWidth),
        child: Column(
          children: [
            Expanded(
              child: state.messages.isEmpty
                  ? ChatIntro(description: status?.description ?? '')
                  : _Messages(
                      state: state,
                      controller: _scroll,
                      onRegenerate: _chat.regenerate,
                    ),
            ),
            if (state.working)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.xs),
                child: Text(text.chatTidying, style: context.texts.bodySmall),
              ),
            if (showsProblem) ChatProblemNotice(problem: problem, onRetry: _chat.retry),
            if (state.isFull)
              ChatFullBanner(onStartNewChat: _startNewChat, busy: state.busy)
            else ...[
              if (notice != null)
                ChatCreditsCard(
                  kind: notice.kind,
                  canUpgrade: notice.canUpgrade,
                  resetsAt: notice.resetsAt,
                  onUpgrade: _upgrade,
                  onStartNewChat: notice.kind == ChatCreditsKind.chatShare && state.conversation != null
                      ? _startNewChat
                      : null,
                ),
              ChatComposer(
                controller: _composer,
                maxChars: status?.maxInputChars ?? ChatConfig.fallbackMaxInputChars,
                busy: state.phase != ChatPhase.idle,
                enabled: notice == null && state.loaded && !state.working,
                onSend: _send,
                onStop: _chat.stop,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// The messages, newest at the bottom. The list is reversed, so a message that
/// grows while it is written grows upward from a fixed bottom edge and the
/// reader's place is never moved under them.
class _Messages extends StatelessWidget {
  const _Messages({required this.state, required this.controller, required this.onRegenerate});

  final ChatState state;
  final ScrollController controller;
  final VoidCallback onRegenerate;

  @override
  Widget build(BuildContext context) {
    final messages = state.messages;
    final lastIndex = messages.length - 1;

    return ListView.separated(
      controller: controller,
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
          streaming: isLast && message.isAssistant && state.phase != ChatPhase.idle,
          compacting: state.compacting,
          onRegenerate: isLast && message.isAssistant && !state.busy ? onRegenerate : null,
        );
      },
    );
  }
}
