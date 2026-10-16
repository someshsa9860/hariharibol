import '../models/api_failure.dart';
import '../models/chat.dart';
import '../models/json.dart';

/// Where a turn is: nothing in flight, a question sent and no word back yet, or
/// words arriving.
enum ChatPhase { idle, waiting, streaming }

/// What went wrong with the last turn, as a screen state rather than a message:
/// the view decides the words (and the icon), so every one is translated.
enum ChatIssue {
  /// The connection dropped. What had arrived is kept; Retry asks again.
  connectionLost,

  /// The server could not finish the reply.
  replyFailed,

  /// 402 `CREDITS_EXHAUSTED`: today's allowance, the wallet, or this chat's share.
  creditsExhausted,

  /// 402 `CHAT_NOT_AVAILABLE`: the plan has no chat.
  notAvailable,

  /// 409 `CONVERSATION_LIMIT`: start a new chat and carry on.
  conversationFull,

  /// 409: another reply is still being written.
  busy,

  /// 400 `MESSAGE_TOO_LONG`.
  tooLong,

  /// Anything else; [ChatProblem.failure] says what.
  failed,
}

class ChatProblem {
  const ChatProblem(
    this.issue, {
    this.failure,
    this.canRetry = false,
    this.limitedBy,
    this.resetsAt,
    this.canUpgrade = false,
    this.startNewChat = false,
  });

  final ChatIssue issue;

  /// Set for [ChatIssue.failed], so the screen can say it with `describe`.
  final ApiFailure? failure;

  /// Retry (regenerate) can pick up where this left off.
  final bool canRetry;

  // Only for the two credit issues.
  final ChatLimitedBy? limitedBy;
  final DateTime? resetsAt;
  final bool canUpgrade;

  /// This one chat has used its share; a new chat carries on.
  final bool startNewChat;

  /// From a refusal the server sent as an ordinary JSON error.
  factory ChatProblem.fromFailure(ApiFailure failure, {bool canRetry = false}) {
    if (failure.isNetwork) return ChatProblem(ChatIssue.connectionLost, canRetry: canRetry);
    return _fromCode(
      code: failure.code,
      details: asJson(failure.details),
      conflict: failure.kind == FailureKind.conflict,
      failure: failure,
      canRetry: canRetry,
    );
  }

  /// From an `error` event in the stream.
  factory ChatProblem.fromEvent(ChatStreamError event, {bool canRetry = false}) {
    final known = _fromCode(
      code: event.code,
      details: event.details,
      conflict: false,
      failure: null,
      canRetry: canRetry,
    );
    if (known.issue != ChatIssue.failed) return known;
    return ChatProblem(
      event.retryable ? ChatIssue.replyFailed : ChatIssue.failed,
      failure: ApiFailure(kind: FailureKind.server, code: event.code, message: event.message),
      canRetry: canRetry && event.retryable,
    );
  }

  static ChatProblem _fromCode({
    required String? code,
    required Json? details,
    required bool conflict,
    required ApiFailure? failure,
    required bool canRetry,
  }) {
    switch (code) {
      case 'CREDITS_EXHAUSTED':
        return ChatProblem(
          ChatIssue.creditsExhausted,
          limitedBy: ChatLimitedBy.parse(details?['limitedBy']),
          resetsAt: asDate(details?['resetsAt']),
          canUpgrade: asBool(details?['canUpgrade']),
          startNewChat: asBool(details?['startNewChat']),
        );
      case 'CHAT_NOT_AVAILABLE':
        return ChatProblem(ChatIssue.notAvailable, canUpgrade: asBool(details?['canUpgrade'], true));
      case 'CONVERSATION_LIMIT':
        return const ChatProblem(ChatIssue.conversationFull);
      case 'MESSAGE_TOO_LONG':
        return const ChatProblem(ChatIssue.tooLong);
    }
    if (conflict) return const ChatProblem(ChatIssue.busy);
    return ChatProblem(ChatIssue.failed, failure: failure, canRetry: canRetry);
  }
}

class ChatState {
  const ChatState({
    this.conversation,
    this.messages = const [],
    this.loaded = false,
    this.loadFailure,
    this.phase = ChatPhase.idle,
    this.compacting = false,
    this.working = false,
    this.problem,
    this.restoredDraft,
  });

  /// Null for a new chat until its first message is sent.
  final ChatConversation? conversation;
  final List<ChatMessage> messages;
  final bool loaded;
  final ApiFailure? loadFailure;
  final ChatPhase phase;

  /// "Tidying our conversation…": the server is folding old messages into the
  /// summary, before a reply or because the reader asked.
  final bool compacting;

  /// A compact or a continue is running (not a reply).
  final bool working;
  final ChatProblem? problem;

  /// Text of a question the server refused, handed back to the composer once.
  final String? restoredDraft;

  bool get busy => phase != ChatPhase.idle || working;
  bool get isFull => conversation?.limitReached != null;
  bool get canSend => loaded && !busy && !isFull;

  /// The answer under the reader's eyes is still arriving with nothing in it.
  bool get awaitingFirstWord =>
      phase != ChatPhase.idle && messages.isNotEmpty && messages.last.isAssistant && messages.last.content.isEmpty;

  ChatState copyWith({
    ChatConversation? conversation,
    List<ChatMessage>? messages,
    ChatPhase? phase,
    bool? compacting,
    bool? working,
    ChatProblem? problem,
    bool clearProblem = false,
    String? restoredDraft,
    bool clearDraft = false,
  }) =>
      ChatState(
        conversation: conversation ?? this.conversation,
        messages: messages ?? this.messages,
        loaded: loaded,
        loadFailure: loadFailure,
        phase: phase ?? this.phase,
        compacting: compacting ?? this.compacting,
        working: working ?? this.working,
        problem: clearProblem ? null : (problem ?? this.problem),
        restoredDraft: clearDraft ? null : (restoredDraft ?? this.restoredDraft),
      );
}
