import '../models/api_failure.dart';
import '../models/chat.dart';
import '../models/json.dart';

/// Where a turn is: nothing in flight, a question sent and no word back yet, or
/// words arriving.
enum ChatPhase { idle, waiting, streaming }

/// What went wrong with the last turn, as a screen state rather than a message:
/// the view decides the words (and the icon), so every one is translated and
/// none of them is ever the server's, a provider's or an exception's text.
enum ChatIssue {
  /// There is no connection to reach the server with.
  offline,

  /// The request went out and nothing came back in time.
  timedOut,

  /// The connection was cut while the reply was being written: the stream
  /// ended with neither a `done` nor an `error`, or broke after the server had
  /// begun. What had arrived is kept.
  connectionLost,

  /// Sakha is busy: the provider is overloaded or a rate limit was reached.
  /// Asking again in a moment usually works.
  overloaded,

  /// Sakha cannot answer for now and waiting is the only remedy — the server
  /// could not reach its provider, or a spending ceiling was reached.
  unavailable,

  /// The server started the reply and could not finish it.
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

  /// Anything else — a fault of ours, an unexpected answer. The reader is told
  /// only that something went wrong; [ChatProblem.failure] says what, for the
  /// kind of line to show, never for its words.
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

  /// Set for [ChatIssue.failed], so the screen can pick the app's own line for
  /// it (`ownWords`). Its `message`, if any, is never shown.
  final ApiFailure? failure;

  /// Retry (regenerate) can pick up where this left off.
  final bool canRetry;

  // Only for the two credit issues.
  final ChatLimitedBy? limitedBy;
  final DateTime? resetsAt;
  final bool canUpgrade;

  /// This one chat has used its share; a new chat carries on.
  final bool startNewChat;

  /// From a call that failed: a refusal the server sent as an ordinary JSON
  /// error, or the phone's own failure to get an answer. The server's code says
  /// the most, so it is read first; the kind of failure is the fallback.
  ///
  /// [replyStarted]: the server had already begun this reply, so a network
  /// failure is a connection that was cut rather than one that never was.
  factory ChatProblem.fromFailure(ApiFailure failure, {bool canRetry = false, bool replyStarted = false}) {
    final byCode = _byCode(failure.code, asJson(failure.details), canRetry);
    if (byCode != null) return byCode;

    // A certificate the phone rejected has the kind `network` and is not a
    // matter of being offline.
    if (failure.code == ClientFailureCode.insecureConnection) {
      return ChatProblem(ChatIssue.failed, failure: failure);
    }
    return switch (failure.kind) {
      FailureKind.network =>
        ChatProblem(replyStarted ? ChatIssue.connectionLost : ChatIssue.offline, canRetry: canRetry),
      FailureKind.timeout => ChatProblem(ChatIssue.timedOut, canRetry: canRetry),
      FailureKind.rateLimited => ChatProblem(ChatIssue.overloaded, canRetry: canRetry),
      FailureKind.conflict => const ChatProblem(ChatIssue.busy),
      // The server answered with an error of its own (5xx), or not at all: from
      // here that is "Sakha cannot be reached", not something the reader caused.
      FailureKind.server => ChatProblem(ChatIssue.unavailable, canRetry: canRetry),
      _ => ChatProblem(ChatIssue.failed, failure: failure, canRetry: canRetry),
    };
  }

  /// From an `error` event in the stream. Its `message` is the server's English
  /// and is not used; the `code` decides, and `retryable` whether Retry is offered.
  factory ChatProblem.fromEvent(ChatStreamError event, {bool canRetry = false}) {
    final retry = canRetry && event.retryable;
    return _byCode(event.code, event.details, retry) ??
        ChatProblem(
          ChatIssue.failed,
          failure: ApiFailure(kind: FailureKind.server, code: event.code),
          canRetry: retry,
        );
  }

  /// The codes the server uses for what it knows went wrong; null for any other.
  static ChatProblem? _byCode(String? code, Json? details, bool canRetry) {
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
      case 'AI_BUSY':
        return ChatProblem(ChatIssue.overloaded, canRetry: canRetry);
      case 'AI_UNAVAILABLE' || 'AI_MISCONFIGURED' || 'AI_BUDGET_EXHAUSTED':
        return ChatProblem(ChatIssue.unavailable, canRetry: canRetry);
      case 'AI_FAILED' || 'AI_BAD_OUTPUT':
        return ChatProblem(ChatIssue.replyFailed, canRetry: canRetry);
    }
    return null;
  }
}

/// Why a picture could not be added to the message.
enum ChatImageProblem {
  /// It did not reach the server (no signal, a stall, a fault on the way).
  /// Trying again can work.
  couldNotUpload,

  /// The server looked at it and cannot use it: not a picture it can read, or
  /// too large. Another picture is the only remedy.
  notUsable,

  /// The plan or the settings have pictures switched off.
  notAvailable;

  /// What a failed upload is called. Only the status says what to do about it:
  /// a picture the server cannot use stays unusable, one that never arrived can
  /// be sent again — which is also all that can be said of a fault of our own.
  static ChatImageProblem of(Object error) => switch (error is ApiFailure ? error.statusCode : null) {
        400 || 413 || 415 || 422 => ChatImageProblem.notUsable,
        402 || 403 => ChatImageProblem.notAvailable,
        _ => ChatImageProblem.couldNotUpload,
      };
}

/// The picture waiting in the message box: chosen on the phone, then handed to
/// the server, which answers with the [key] that goes with the question.
class ChatDraftImage {
  const ChatDraftImage({required this.path, this.key, this.problem});

  /// The file on this phone — what the thumbnail shows.
  final String path;

  /// Set once the server has it.
  final String? key;
  final ChatImageProblem? problem;

  bool get uploading => key == null && problem == null;
  bool get ready => key != null;
  bool get canRetry => problem == ChatImageProblem.couldNotUpload;

  ChatDraftImage uploadingAgain() => ChatDraftImage(path: path);
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
    this.draftImage,
    this.offer,
  });

  /// Null until the first message is sent: the conversation is made on the
  /// server then, so opening the chat and walking away leaves nothing behind.
  final ChatConversation? conversation;
  final List<ChatMessage> messages;
  final bool loaded;
  final ApiFailure? loadFailure;
  final ChatPhase phase;

  /// "Tidying our conversation…": the server is folding old messages into the
  /// summary before it answers.
  final bool compacting;

  /// A new chat is being started or the chat is being cleared (not a reply).
  final bool working;
  final ChatProblem? problem;

  /// Text of a question the server refused, handed back to the composer once.
  final String? restoredDraft;

  /// The picture chosen for the next question, if any.
  final ChatDraftImage? draftImage;

  /// What Sakha offered to open after the last reply, until the reader opens it, turns it down or says something else.
  final ChatAction? offer;

  bool get busy => phase != ChatPhase.idle || working;
  bool get isFull => conversation?.limitReached != null;
  bool get canSend => loaded && !busy && !isFull;

  /// There is something on screen that clearing would remove.
  bool get hasHistory => messages.isNotEmpty || conversation != null;

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
    ChatDraftImage? draftImage,
    bool clearImage = false,
    ChatAction? offer,
    bool clearOffer = false,
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
        draftImage: clearImage ? null : (draftImage ?? this.draftImage),
        offer: clearOffer ? null : (offer ?? this.offer),
      );
}
