import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/chat_config.dart';
import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/chat_action_route.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/chat.dart';
import '../../providers/chat_controller.dart';
import '../../providers/chat_provider.dart';
import '../../providers/chat_state.dart';
import '../../services/chat_image_picker.dart';
import '../../widgets/chat/chat_action_card.dart';
import '../../widgets/chat/chat_attach_sheet.dart';
import '../../widgets/chat/chat_composer.dart';
import '../../widgets/chat/chat_credit_meter.dart';
import '../../widgets/chat/chat_credits_card.dart';
import '../../widgets/chat/chat_dictation.dart';
import '../../widgets/chat/chat_message_list.dart';
import '../../widgets/chat/chat_notices.dart';
import '../../widgets/chat/chat_suggestions.dart';
import '../../widgets/chat/chat_welcome.dart';
import '../../widgets/chat/sakha_avatar.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';

/// Ask Sakha: the reader's one conversation. The messages, the box to type,
/// speak or add a picture in, the credit meter beside the title and a button to
/// clear the chat. Opening it asks the server for the conversation; the first
/// message creates it if there is none.
class ChatView extends ConsumerStatefulWidget {
  const ChatView({super.key, this.initialPrompt, this.draft});

  /// A question to ask as soon as the chat has loaded — what "Ask Sakha" on a verse opens it with. Sent once; if the
  /// reader cannot send just now (no credits, a full chat) it waits in the box instead.
  final String? initialPrompt;

  /// Text to put in the box and not send — what "Ask Sakha" on text selected in another app opens it with. The reader
  /// adds a question if they want one, and sends it themselves.
  final String? draft;

  @override
  ConsumerState<ChatView> createState() => _ChatViewState();
}

class _ChatViewState extends ConsumerState<ChatView> {
  final TextEditingController _composer = TextEditingController();
  final ScrollController _scroll = ScrollController();
  late final ChatDictation _dictation = ChatDictation(
    input: ref.read(speechInputProvider),
    text: _composer,
    onNotice: _dictationNotice,
  );

  @override
  void initState() {
    super.initState();
    final draft = widget.draft?.trim() ?? '';
    if (draft.isNotEmpty) {
      _composer.value = TextEditingValue(text: draft, selection: TextSelection.collapsed(offset: draft.length));
    }
    final prompt = widget.initialPrompt?.trim();
    if (prompt == null || prompt.isEmpty) return;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      await _chat.ready;
      if (!mounted) return;
      if (ref.read(chatControllerProvider).canSend) {
        _send(prompt);
      } else {
        _composer.text = prompt;
      }
    });
  }

  @override
  void dispose() {
    _dictation.dispose();
    _composer.dispose();
    _scroll.dispose();
    super.dispose();
  }

  ChatController get _chat => ref.read(chatControllerProvider.notifier);

  /// The reader said yes to what Sakha offered. A tab is switched to; anything else opens over the chat, so back
  /// returns to it.
  void _openOffer(ChatAction action) {
    final route = chatActionRoute(action);
    _chat.dismissOffer();
    if (route.isTab) {
      AppNavigator.instance.go(route.path);
    } else {
      AppNavigator.instance.push(route.path);
    }
  }

  void _send(String value) {
    _dictation.cancel();
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

  // ── Pictures and voice ────────────────────────────────────────────────────

  Future<void> _attach() async {
    final source = await chooseChatPicture(context);
    if (source == null || !mounted) return;
    try {
      final path = await ref.read(chatImagePickerProvider).pick(source);
      if (path != null && mounted) await _chat.attachImage(path);
    } on PictureAccessDenied {
      if (mounted) AppNavigator.instance.showMessage(AppLocalizations.of(context).chatPictureDenied);
    }
  }

  void _toggleVoice(int maxChars) {
    _dictation.toggle(
      languageCode: Localizations.localeOf(context).languageCode,
      maxChars: maxChars,
    );
  }

  void _dictationNotice(DictationNotice notice) {
    if (!mounted) return;
    final text = AppLocalizations.of(context);
    AppNavigator.instance.showMessage(switch (notice) {
      DictationNotice.denied => text.chatMicDenied,
      DictationNotice.unavailable => text.chatMicUnavailable,
      DictationNotice.heardNothing => text.chatMicNoSpeech,
      DictationNotice.failed => text.chatMicFailed,
    });
  }

  // ── Clearing, upgrading, carrying on ──────────────────────────────────────

  Future<void> _clear() async {
    final text = AppLocalizations.of(context);
    final navigator = AppNavigator.instance;
    final confirmed = await navigator.confirm(
      title: text.chatClearTitle,
      message: text.chatClearBody,
      confirmLabel: text.chatClearConfirm,
      isDestructive: true,
    );
    if (!confirmed || !mounted) return;

    try {
      await _dictation.cancel();
      await _chat.clear();
      _composer.clear();
      navigator.showMessage(text.chatCleared);
    } on ApiFailure catch (failure) {
      navigator.showFailure(failure);
    }
  }

  Future<void> _upgrade() async {
    await AppNavigator.instance.push(AppRoutes.plans);
    if (mounted) ref.read(chatStatusProvider.notifier).refresh();
  }

  /// A full chat carries on in a new one: Sakha keeps the summary, the screen
  /// starts empty.
  Future<void> _startNewChat() async {
    final text = AppLocalizations.of(context);
    try {
      final result = await _chat.startNewChat();
      if (result == null || !mounted) return;
      if (!result.carriedEverything) AppNavigator.instance.showMessage(text.chatContinuePartial);
    } on ApiFailure catch (failure) {
      AppNavigator.instance.showFailure(failure);
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

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final state = ref.watch(chatControllerProvider);
    final status = ref.watch(chatStatusProvider).value;
    ref.listen(chatControllerProvider, _takeDraft);

    final credits = status?.credits;

    return Scaffold(
      appBar: AppBar(
        // The meter shares the title's line instead of hanging below it.
        titleSpacing: 0,
        title: Row(
          children: [
            const SakhaAvatar(size: AppSizes.avatarSm),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Text(text.chatTitle, maxLines: 1, overflow: TextOverflow.ellipsis),
            ),
            if (credits != null) ...[
              const SizedBox(width: AppSpacing.sm),
              ChatCreditMeter(credits: credits),
            ],
            const SizedBox(width: AppSpacing.xs),
          ],
        ),
        actions: [
          if (state.loaded && state.hasHistory)
            IconButton(
              tooltip: text.chatClearTooltip,
              onPressed: state.busy ? null : _clear,
              icon: const Icon(Icons.delete_sweep_outlined),
            ),
        ],
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
    final still = MediaQuery.disableAnimationsOf(context);
    final problem = state.problem;
    final notice = _creditsNotice(problem, status?.credits);
    final showsProblem = problem != null &&
        problem.issue != ChatIssue.creditsExhausted &&
        problem.issue != ChatIssue.notAvailable &&
        problem.issue != ChatIssue.conversationFull;
    final maxChars = status?.maxInputChars ?? ChatConfig.fallbackMaxInputChars;
    final canAsk = notice == null && state.canSend;

    final last = state.messages.isEmpty ? null : state.messages.last;
    final offersFollowUps = canAsk &&
        last != null &&
        last.isAssistant &&
        last.status == ChatMessageStatus.complete &&
        last.content.isNotEmpty;

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: AppSizes.readingMaxWidth),
        child: Column(
          children: [
            Expanded(
              child: Stack(
                children: [
                  ChatMessageList(
                    state: state,
                    controller: _scroll,
                    onRegenerate: _chat.regenerate,
                  ),
                  Positioned.fill(
                    child: AnimatedSwitcher(
                      duration: still ? Duration.zero : AppDurations.normal,
                      child: state.messages.isEmpty
                          ? ChatWelcome(
                              key: const ValueKey('welcome'),
                              description: status?.description ?? '',
                              onPick: canAsk ? _send : null,
                            )
                          : const SizedBox.shrink(key: ValueKey('conversation')),
                    ),
                  ),
                ],
              ),
            ),
            if (state.working && state.compacting)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.xs),
                child: Text(text.chatTidying, style: context.texts.bodySmall),
              ),
            AnimatedSwitcher(
              duration: still ? Duration.zero : AppDurations.normal,
              transitionBuilder: (child, animation) => SizeTransition(
                sizeFactor: animation,
                alignment: Alignment.topCenter,
                child: FadeTransition(opacity: animation, child: child),
              ),
              child: showsProblem
                  ? ChatProblemNotice(
                      key: ObjectKey(problem),
                      problem: problem,
                      onRetry: _chat.retry,
                      onDismiss: _chat.dismissProblem,
                    )
                  : const SizedBox.shrink(key: ValueKey('no-problem')),
            ),
            if (state.isFull)
              ChatFullBanner(onStartNewChat: _startNewChat, busy: state.busy)
            else ...[
              if (state.offer case final offer?)
                ChatActionCard(
                  key: ObjectKey(offer),
                  action: offer,
                  onOpen: () => _openOffer(offer),
                  onDismiss: _chat.dismissOffer,
                ),
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
              AnimatedSize(
                duration: still ? Duration.zero : AppDurations.normal,
                alignment: Alignment.bottomCenter,
                child: offersFollowUps
                    ? Padding(
                        padding: const EdgeInsets.only(top: AppSpacing.xs),
                        child: ChatFollowUps(onPick: _send),
                      )
                    : const SizedBox(width: double.infinity),
              ),
              ListenableBuilder(
                listenable: _dictation,
                builder: (context, _) => ChatComposer(
                  controller: _composer,
                  maxChars: maxChars,
                  busy: state.phase != ChatPhase.idle,
                  enabled: notice == null && !state.working,
                  listening: _dictation.listening,
                  draftImage: state.draftImage,
                  onSend: _send,
                  onStop: _chat.stop,
                  onAttach: _attach,
                  onMic: () => _toggleVoice(maxChars),
                  onRemoveImage: _chat.removeImage,
                  onRetryImage: _chat.retryImage,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
