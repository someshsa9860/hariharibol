import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/constants/chat_config.dart';
import '../models/api_failure.dart';
import '../models/chat.dart';
import '../services/api_client.dart';
import '../services/chat_service.dart';
import 'chat_provider.dart';
import 'chat_state.dart';
import 'chat_turn.dart';

/// The reader's conversation with Sakha, as the chat screen shows it.
///
/// A reader has one conversation: opening the screen asks the server for it,
/// and the first message creates it if there is none. [clear] removes it,
/// and with it what Sakha remembers.
///
/// **Streaming without flicker.** Text arriving from the server is held in a
/// buffer and written to the state at most every [ChatConfig.flushInterval];
/// the first word is shown at once so the typing dots do not linger. The
/// answer's bubble keeps one key for its whole life (including the swap from
/// the phone's placeholder to the server's message), so only its text changes.
///
/// **Stop** closes the connection; the server keeps what arrived as a stopped
/// message and charges only for that. **Retry** after a dropped connection asks
/// the server to answer the last question again, keeping what had arrived on
/// screen until then.
class ChatController extends Notifier<ChatState> {
  /// Completes when the conversation has loaded (for tests).
  Future<void> ready = Future.value();

  int _local = 0;
  ChatTurn? _turn;
  ApiCancelToken? _upload;
  final StringBuffer _pending = StringBuffer();
  Timer? _flushTimer;
  Timer? _creditsTimer;

  ChatService get _service => ref.read(chatServiceProvider);

  @override
  ChatState build() {
    ref.onDispose(() {
      _flushTimer?.cancel();
      _creditsTimer?.cancel();
      _upload?.cancel();
      final turn = _turn;
      if (turn != null) {
        // Leaving the screen is stopping: the server keeps what arrived.
        turn.stopped = true;
        turn.sub?.cancel();
        turn.cancel.cancel();
      }
    });

    ready = Future.microtask(_load);
    return const ChatState();
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  Future<void> _load() async {
    ApiFailure? failure;
    ChatConversationDetail? detail;
    try {
      detail = await _service.current();
    } on ApiFailure catch (error) {
      failure = error;
    } catch (_) {
      failure = const ApiFailure(kind: FailureKind.unknown);
    }
    if (!ref.mounted) return;
    if (failure != null) {
      state = ChatState(loadFailure: failure);
      return;
    }
    // Nothing yet: the first message makes the conversation.
    state = detail == null
        ? const ChatState(loaded: true)
        : ChatState(conversation: detail.conversation, messages: detail.messages, loaded: true);
  }

  Future<void> reload() {
    state = const ChatState();
    return ready = _load();
  }

  /// The composer has taken the text back.
  void draftRestored() {
    if (state.restoredDraft != null) state = state.copyWith(clearDraft: true);
  }

  /// The reader turned down, or has opened, what Sakha offered.
  void dismissOffer() {
    if (state.offer != null) state = state.copyWith(clearOffer: true);
  }

  /// The reader has read the notice above the box and sent it away.
  void dismissProblem() {
    if (state.problem != null) state = state.copyWith(clearProblem: true);
  }

  // ── Sending ──────────────────────────────────────────────────────────────

  /// Sends [text], with the picture waiting in the box if there is one. A
  /// picture alone is enough; one still going up, or one that failed, is not.
  Future<void> send(String text) async {
    final content = text.trim();
    final image = state.draftImage;
    if (!state.canSend || (image != null && !image.ready)) return;
    if (content.isEmpty && image == null) return;

    final turn = ChatTurn(
      userKey: _key('user'),
      answerKey: _key('assistant'),
      draft: content,
      image: image,
      regenerate: false,
    );
    state = state.copyWith(
      messages: [
        ...state.messages,
        ChatMessage.local(
          key: turn.userKey!,
          role: ChatRole.user,
          content: content,
          localImagePath: image?.path,
        ),
        ChatMessage.local(key: turn.answerKey, role: ChatRole.assistant),
      ],
      phase: ChatPhase.waiting,
      clearProblem: true,
      clearDraft: true,
      clearImage: true,
      clearOffer: true,
    );
    _turn = turn;

    final existing = state.conversation;
    final ChatConversation conversation;
    if (existing != null) {
      conversation = existing;
    } else {
      // A new chat exists on the server only once something is said in it.
      try {
        conversation = await _asking(_service.create);
      } on ApiFailure catch (failure) {
        if (ref.mounted) _fail(turn, ChatProblem.fromFailure(failure));
        return;
      }
      if (!ref.mounted) return;
      state = state.copyWith(conversation: conversation);
    }
    if (turn.stopped) return;

    final id = conversation.id;
    await _run(turn, () => _service.send(id, content, imageKey: image?.key, cancel: turn.cancel));
  }

  /// Answers the last question again, replacing the answer after it. Also what
  /// Retry does after a dropped connection.
  Future<void> regenerate() async {
    final conversation = state.conversation;
    if (!state.loaded || state.busy || conversation == null) return;

    final kept = [...state.messages];
    while (kept.isNotEmpty && kept.last.isAssistant) {
      kept.removeLast();
    }
    if (kept.isEmpty || !kept.last.isUser) return;

    final turn = ChatTurn(userKey: null, answerKey: _key('assistant'), draft: null, regenerate: true);
    state = state.copyWith(
      messages: [...kept, ChatMessage.local(key: turn.answerKey, role: ChatRole.assistant)],
      phase: ChatPhase.waiting,
      clearProblem: true,
      clearOffer: true,
    );
    _turn = turn;
    await _run(turn, () => _service.regenerate(conversation.id, cancel: turn.cancel));
  }

  Future<void> retry() => regenerate();

  /// Stops the reply being written. What arrived stays on screen, marked as stopped.
  Future<void> stop() async {
    final turn = _turn;
    if (turn == null || turn.stopped) return;
    turn.stopped = true;
    unawaited(turn.sub?.cancel());
    turn.cancel.cancel();
    _flushNow();

    state = state.copyWith(
      messages: _settleAnswer(turn, ChatMessageStatus.stopped),
      phase: ChatPhase.idle,
      compacting: false,
    );
    _finish(turn);
    _refreshCreditsSoon();
  }

  Future<void> _run(ChatTurn turn, Stream<ChatStreamEvent> Function() open) {
    turn.sub = open().listen(
      (event) => _onEvent(turn, event),
      onError: (Object error) => _onError(turn, error),
      onDone: () => _onDone(turn),
      cancelOnError: true,
    );
    return turn.done.future;
  }

  void _onEvent(ChatTurn turn, ChatStreamEvent event) {
    if (!ref.mounted || turn.stopped) return;

    switch (event) {
      case ChatMeta():
        turn.gotMeta = true;
        final server = event.userMessage;
        state = state.copyWith(
          conversation: event.conversation,
          messages: [
            for (final message in state.messages)
              if (message.clientKey == turn.userKey && server != null)
                message.replacedBy(server)
              else if (message.clientKey == turn.answerKey)
                message.copyWith(id: event.assistantMessageId)
              else
                message,
          ],
        );
      case ChatCompacting():
        state = state.copyWith(compacting: true);
      case ChatActionOffer():
        state = state.copyWith(offer: event.action);
      case ChatDelta():
        _pending.write(event.text);
        if (state.phase == ChatPhase.waiting) {
          _flushNow();
        } else {
          _flushTimer ??= Timer(ChatConfig.flushInterval, _flush);
        }
      case ChatDone():
        turn.terminal = true;
        _flushNow();
        final server = event.message;
        state = state.copyWith(
          conversation: event.conversation,
          messages: [
            for (final message in state.messages)
              if (message.clientKey == turn.answerKey)
                server == null
                    ? message.copyWith(status: ChatMessageStatus.complete)
                    : message.replacedBy(server)
              else
                message,
          ],
          phase: ChatPhase.idle,
          compacting: false,
        );
        ref.read(chatStatusProvider.notifier).applyCredits(event.credits);
        _finish(turn);
      case ChatStreamError():
        turn.terminal = true;
        _fail(turn, ChatProblem.fromEvent(event, canRetry: turn.questionSaved));
    }
  }

  void _onError(ChatTurn turn, Object error) {
    if (!ref.mounted || turn.stopped || turn.done.isCompleted) return;
    _fail(
      turn,
      ChatProblem.fromFailure(_asFailure(error), canRetry: turn.questionSaved, replyStarted: turn.gotMeta),
    );
  }

  /// The stream closed. If no `done` or `error` came first, the connection was
  /// cut — by a tunnel, a proxy, the phone's radio.
  void _onDone(ChatTurn turn) {
    if (!ref.mounted || turn.stopped || turn.terminal || turn.done.isCompleted) return;
    _fail(turn, ChatProblem(ChatIssue.connectionLost, canRetry: turn.questionSaved));
  }

  /// Settles a turn that did not finish. What arrived stays; an empty answer
  /// goes; a question the server never saved goes back to the composer.
  void _fail(ChatTurn turn, ChatProblem problem) {
    _flushNow();

    var messages = _settleAnswer(turn, ChatMessageStatus.partial);
    String? draft;
    ChatDraftImage? image;
    if (!turn.questionSaved && turn.userKey != null) {
      messages = [for (final message in messages) if (message.clientKey != turn.userKey) message];
      draft = turn.draft;
      image = turn.image;
    }

    var conversation = state.conversation;
    if (problem.issue == ChatIssue.conversationFull && conversation != null && conversation.limitReached == null) {
      conversation = conversation.copyWith(limitReached: ChatLimitReached.messages);
    }

    state = state.copyWith(
      conversation: conversation,
      messages: messages,
      phase: ChatPhase.idle,
      compacting: false,
      problem: problem,
      restoredDraft: draft,
      draftImage: image,
    );
    _finish(turn);

    final creditsIssue = problem.issue == ChatIssue.creditsExhausted || problem.issue == ChatIssue.notAvailable;
    if (creditsIssue) _refreshCreditsSoon(immediately: true);
  }

  /// The messages with this turn's answer settled: removed if nothing arrived,
  /// otherwise kept and marked [status].
  List<ChatMessage> _settleAnswer(ChatTurn turn, ChatMessageStatus status) {
    return [
      for (final message in state.messages)
        if (message.clientKey != turn.answerKey)
          message
        else if (message.content.isNotEmpty)
          message.copyWith(status: status),
    ];
  }

  void _finish(ChatTurn turn) {
    if (identical(_turn, turn)) _turn = null;
    if (!turn.done.isCompleted) turn.done.complete();
  }

  // ── Throttled text ───────────────────────────────────────────────────────

  void _flushNow() {
    _flushTimer?.cancel();
    _flush();
  }

  void _flush() {
    _flushTimer = null;
    final turn = _turn;
    if (_pending.isEmpty) return;
    final text = _pending.toString();
    _pending.clear();
    if (turn == null || !ref.mounted) return;

    state = state.copyWith(
      phase: ChatPhase.streaming,
      compacting: false,
      messages: [
        for (final message in state.messages)
          if (message.clientKey == turn.answerKey) message.copyWith(content: message.content + text) else message,
      ],
    );
  }

  // ── Credits ──────────────────────────────────────────────────────────────

  /// A stopped reply is charged just after the connection closes; ask again
  /// once the server has had time to settle.
  void _refreshCreditsSoon({bool immediately = false}) {
    _creditsTimer?.cancel();
    final refresh = ref.read(chatStatusProvider.notifier).refresh;
    if (immediately) {
      unawaited(refresh());
      return;
    }
    _creditsTimer = Timer(ChatConfig.creditsRefreshDelay, () {
      if (ref.mounted) unawaited(refresh());
    });
  }

  // ── Pictures ─────────────────────────────────────────────────────────────

  /// A picture has been chosen. It goes up at once, so that Send is ready by
  /// the time the reader has finished typing. Choosing another replaces it.
  Future<void> attachImage(String path) async {
    if (state.busy) return;
    _upload?.cancel();
    final token = _upload = ApiCancelToken();
    state = state.copyWith(draftImage: ChatDraftImage(path: path));
    await _uploadDraft(path, token);
  }

  /// Tries the picture again after it failed to reach the server.
  Future<void> retryImage() async {
    final draft = state.draftImage;
    if (draft == null || !draft.canRetry) return;
    _upload?.cancel();
    final token = _upload = ApiCancelToken();
    state = state.copyWith(draftImage: draft.uploadingAgain());
    await _uploadDraft(draft.path, token);
  }

  void removeImage() {
    _upload?.cancel();
    _upload = null;
    if (state.draftImage != null) state = state.copyWith(clearImage: true);
  }

  Future<void> _uploadDraft(String path, ApiCancelToken token) async {
    final ChatDraftImage next;
    try {
      final uploaded = await _service.uploadImage(path, cancel: token);
      next = ChatDraftImage(path: path, key: uploaded.key);
    } catch (error) {
      if (token.isCancelled || !ref.mounted) return;
      state = state.copyWith(draftImage: ChatDraftImage(path: path, problem: ChatImageProblem.of(error)));
      return;
    }
    // Replaced or taken out while it was on its way: this answer is stale.
    if (token.isCancelled || !ref.mounted) return;
    state = state.copyWith(draftImage: next);
  }

  // ── Starting over ────────────────────────────────────────────────────────

  /// For a chat that is full: starts a new one that carries this one's summary
  /// and shows it empty — Sakha remembers, the screen does not repeat it.
  Future<ChatContinueResult?> startNewChat() async {
    final conversation = state.conversation;
    if (conversation == null || state.busy) return null;

    state = state.copyWith(working: true, compacting: true);
    try {
      final result = await _asking(() => _service.continueChat(conversation.id));
      if (!ref.mounted) return result;
      state = ChatState(conversation: result.conversation, loaded: true);
      _refreshCreditsSoon(immediately: true);
      return result;
    } catch (_) {
      if (ref.mounted) state = state.copyWith(working: false, compacting: false);
      rethrow;
    }
  }

  /// Removes the whole conversation, and with it everything Sakha remembers of
  /// it. Credits already spent are not returned. Throws the `ApiFailure` for the
  /// screen to word.
  Future<void> clear() async {
    if (!state.loaded || state.busy) return;

    state = state.copyWith(working: true);
    try {
      await _asking(_service.clear);
    } catch (_) {
      if (ref.mounted) state = state.copyWith(working: false);
      rethrow;
    }
    if (!ref.mounted) return;
    _upload?.cancel();
    _upload = null;
    state = const ChatState(loaded: true);
  }

  String _key(String kind) => 'local-$kind-${_local++}';

  // ── Failures ─────────────────────────────────────────────────────────────

  /// What a failed call is called. The api client turns everything it can into
  /// an [ApiFailure]; anything else is a fault in our own code, so it is
  /// `unknown` — calling it "the network" is how a parser bug once looked like a
  /// bad signal.
  ApiFailure _asFailure(Object error) {
    if (error is ApiFailure) return error;
    debugPrint('Chat call failed unexpectedly: $error');
    return const ApiFailure(kind: FailureKind.unknown);
  }

  /// Runs a call whose failure the screen shows, so the only thing it ever has
  /// to catch is an [ApiFailure].
  Future<T> _asking<T>(Future<T> Function() call) async {
    try {
      return await call();
    } catch (error) {
      throw _asFailure(error);
    }
  }
}

final chatControllerProvider = NotifierProvider.autoDispose<ChatController, ChatState>(ChatController.new);
