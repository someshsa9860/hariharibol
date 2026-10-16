import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/constants/chat_config.dart';
import '../models/api_failure.dart';
import '../models/chat.dart';
import '../services/api_client.dart';
import '../services/chat_service.dart';
import 'chat_provider.dart';
import 'chat_state.dart';

/// One turn of the conversation in flight: the question and the answer being
/// written, and what is known about how far it got.
class _Turn {
  _Turn({required this.userKey, required this.answerKey, required this.draft, required this.regenerate});

  /// Local keys of the optimistic bubbles. `userKey` is null for a regeneration.
  final String? userKey;
  final String answerKey;

  /// The question's text, handed back to the composer if the server refuses it.
  final String? draft;
  final bool regenerate;

  final ApiCancelToken cancel = ApiCancelToken();
  final Completer<void> done = Completer<void>();
  StreamSubscription<ChatStreamEvent>? sub;

  /// The server saved the question (a `meta` arrived).
  bool gotMeta = false;

  /// `done` or `error` arrived: the stream ended on purpose.
  bool terminal = false;
  bool stopped = false;

  /// The question is on the server, so asking the reply again is safe.
  bool get questionSaved => regenerate || gotMeta;
}

/// One conversation on screen.
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
  ChatController(this._id);

  final String _id;

  /// Completes when the conversation has loaded (for tests).
  Future<void> ready = Future.value();

  int _local = 0;
  _Turn? _turn;
  final StringBuffer _pending = StringBuffer();
  Timer? _flushTimer;
  Timer? _creditsTimer;

  ChatService get _service => ref.read(chatServiceProvider);

  @override
  ChatState build() {
    ref.onDispose(() {
      _flushTimer?.cancel();
      _creditsTimer?.cancel();
      final turn = _turn;
      if (turn != null) {
        // Leaving the screen is stopping: the server keeps what arrived.
        turn.stopped = true;
        turn.sub?.cancel();
        turn.cancel.cancel();
      }
    });

    if (_id == ChatConfig.newChatId) return const ChatState(loaded: true);
    ready = Future.microtask(_load);
    return const ChatState();
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  Future<void> _load() async {
    ApiFailure? failure;
    ChatConversationDetail? detail;
    try {
      detail = await _service.conversation(_id);
    } on ApiFailure catch (error) {
      failure = error;
    } catch (_) {
      failure = const ApiFailure(kind: FailureKind.unknown);
    }
    if (!ref.mounted) return;
    state = detail == null
        ? ChatState(loadFailure: failure)
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

  // ── Sending ──────────────────────────────────────────────────────────────

  Future<void> send(String text) async {
    final content = text.trim();
    if (content.isEmpty || !state.canSend) return;

    final turn = _Turn(
      userKey: _key('user'),
      answerKey: _key('assistant'),
      draft: content,
      regenerate: false,
    );
    state = state.copyWith(
      messages: [
        ...state.messages,
        ChatMessage.local(key: turn.userKey!, role: ChatRole.user, content: content),
        ChatMessage.local(key: turn.answerKey, role: ChatRole.assistant),
      ],
      phase: ChatPhase.waiting,
      clearProblem: true,
      clearDraft: true,
    );
    _turn = turn;

    final existing = state.conversation;
    final ChatConversation conversation;
    if (existing != null) {
      conversation = existing;
    } else {
      // A new chat exists on the server only once something is said in it.
      try {
        conversation = await _service.create();
      } on ApiFailure catch (failure) {
        if (ref.mounted) _fail(turn, ChatProblem.fromFailure(failure));
        return;
      }
      if (!ref.mounted) return;
      state = state.copyWith(conversation: conversation);
    }
    if (turn.stopped) return;

    final id = conversation.id;
    await _run(turn, () => _service.send(id, content, cancel: turn.cancel));
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

    final turn = _Turn(userKey: null, answerKey: _key('assistant'), draft: null, regenerate: true);
    state = state.copyWith(
      messages: [...kept, ChatMessage.local(key: turn.answerKey, role: ChatRole.assistant)],
      phase: ChatPhase.waiting,
      clearProblem: true,
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

  Future<void> _run(_Turn turn, Stream<ChatStreamEvent> Function() open) {
    turn.sub = open().listen(
      (event) => _onEvent(turn, event),
      onError: (Object error) => _onError(turn, error),
      onDone: () => _onDone(turn),
      cancelOnError: true,
    );
    return turn.done.future;
  }

  void _onEvent(_Turn turn, ChatStreamEvent event) {
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

  void _onError(_Turn turn, Object error) {
    if (!ref.mounted || turn.stopped || turn.done.isCompleted) return;
    final failure = error is ApiFailure ? error : const ApiFailure(kind: FailureKind.network);
    _fail(turn, ChatProblem.fromFailure(failure, canRetry: turn.questionSaved));
  }

  /// The stream closed. If no `done` or `error` came first, the connection was
  /// cut — by a tunnel, a proxy, the phone's radio.
  void _onDone(_Turn turn) {
    if (!ref.mounted || turn.stopped || turn.terminal || turn.done.isCompleted) return;
    _fail(turn, ChatProblem(ChatIssue.connectionLost, canRetry: turn.questionSaved));
  }

  /// Settles a turn that did not finish. What arrived stays; an empty answer
  /// goes; a question the server never saved goes back to the composer.
  void _fail(_Turn turn, ChatProblem problem) {
    _flushNow();

    var messages = _settleAnswer(turn, ChatMessageStatus.partial);
    String? draft;
    if (!turn.questionSaved && turn.userKey != null) {
      messages = [for (final message in messages) if (message.clientKey != turn.userKey) message];
      draft = turn.draft;
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
    );
    _finish(turn);

    final creditsIssue = problem.issue == ChatIssue.creditsExhausted || problem.issue == ChatIssue.notAvailable;
    if (creditsIssue) _refreshCreditsSoon(immediately: true);
  }

  /// The messages with this turn's answer settled: removed if nothing arrived,
  /// otherwise kept and marked [status].
  List<ChatMessage> _settleAnswer(_Turn turn, ChatMessageStatus status) {
    return [
      for (final message in state.messages)
        if (message.clientKey != turn.answerKey)
          message
        else if (message.content.isNotEmpty)
          message.copyWith(status: status),
    ];
  }

  void _finish(_Turn turn) {
    if (identical(_turn, turn)) _turn = null;
    if (!turn.done.isCompleted) turn.done.complete();
    if (ref.mounted) ref.invalidate(chatListProvider);
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

  // ── The rest of the menu ─────────────────────────────────────────────────

  /// Folds older messages into the summary now. True when something was folded.
  /// Throws the `ApiFailure` for the screen to show.
  Future<bool> compact() async {
    final conversation = state.conversation;
    if (conversation == null || state.busy) return false;

    state = state.copyWith(working: true, compacting: true);
    try {
      final result = await _service.compact(conversation.id);
      if (!ref.mounted) return result.compacted;
      ref.read(chatStatusProvider.notifier).applyCredits(result.credits);
      state = state.copyWith(conversation: result.conversation, working: false, compacting: false);
      return result.compacted;
    } catch (_) {
      if (ref.mounted) state = state.copyWith(working: false, compacting: false);
      rethrow;
    }
  }

  /// Starts a new chat that carries this one's summary, for a chat that is
  /// full. Returns it for the screen to open.
  Future<ChatContinueResult?> startNewChat() async {
    final conversation = state.conversation;
    if (conversation == null || state.busy) return null;

    state = state.copyWith(working: true, compacting: true);
    try {
      final result = await _service.continueChat(conversation.id);
      if (!ref.mounted) return result;
      state = state.copyWith(working: false, compacting: false);
      _refreshCreditsSoon(immediately: true);
      ref.invalidate(chatListProvider);
      return result;
    } catch (_) {
      if (ref.mounted) state = state.copyWith(working: false, compacting: false);
      rethrow;
    }
  }

  Future<void> rename(String title) async {
    final conversation = state.conversation;
    if (conversation == null) return;
    final renamed = await _service.rename(conversation.id, title);
    if (!ref.mounted) return;
    state = state.copyWith(conversation: conversation.copyWith(title: renamed.title));
    ref.invalidate(chatListProvider);
  }

  Future<void> delete() async {
    final conversation = state.conversation;
    if (conversation == null) return;
    await _service.delete(conversation.id);
    if (ref.mounted) ref.invalidate(chatListProvider);
  }

  String _key(String kind) => 'local-$kind-${_local++}';
}

/// The conversation with this id, or [ChatConfig.newChatId] for one not made yet.
final chatControllerProvider =
    NotifierProvider.autoDispose.family<ChatController, ChatState, String>(ChatController.new);
