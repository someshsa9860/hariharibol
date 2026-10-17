import 'dart:convert';

import '../core/constants/chat_config.dart';
import 'json.dart';

/// What holds a chat back: today's allowance, or the plan's wallet.
enum ChatLimitedBy {
  daily,
  wallet;

  static ChatLimitedBy? parse(dynamic value) => switch (asString(value)) {
        'daily' => ChatLimitedBy.daily,
        'wallet' => ChatLimitedBy.wallet,
        _ => null,
      };
}

/// The reader's credit meter. A percentage and a level name — the API never
/// sends token counts and neither does this class carry any.
class ChatCredits {
  const ChatCredits({
    required this.enabled,
    required this.levelName,
    required this.percent,
    required this.exhausted,
    required this.limitedBy,
    required this.resetsAt,
    required this.renewsAt,
    required this.canUpgrade,
  });

  final bool enabled;
  final String? levelName;

  /// 100 → 0: how much is left.
  final int percent;
  final bool exhausted;
  final ChatLimitedBy? limitedBy;
  final DateTime? resetsAt;
  final DateTime? renewsAt;
  final bool canUpgrade;

  factory ChatCredits.fromJson(Json json) => ChatCredits(
        enabled: asBool(json['enabled']),
        levelName: asStringOrNull(json['levelName']),
        percent: asInt(json['percent']).clamp(0, 100),
        exhausted: asBool(json['exhausted']),
        limitedBy: ChatLimitedBy.parse(json['limitedBy']),
        resetsAt: asDate(json['resetsAt']),
        renewsAt: asDate(json['renewsAt']),
        canUpgrade: asBool(json['canUpgrade']),
      );
}

/// `GET /chat/status`: what to show before a chat — Sakha's own description,
/// the meter, and the input limits.
class ChatStatus {
  const ChatStatus({
    required this.description,
    required this.credits,
    required this.maxInputChars,
    required this.maxMessages,
  });

  final String description;
  final ChatCredits credits;
  final int maxInputChars;
  final int maxMessages;

  ChatStatus withCredits(ChatCredits next) => ChatStatus(
        description: description,
        credits: next,
        maxInputChars: maxInputChars,
        maxMessages: maxMessages,
      );

  factory ChatStatus.fromJson(Json json) {
    final limits = asJson(json['limits']) ?? const {};
    return ChatStatus(
      description: asString(json['description']),
      credits: ChatCredits.fromJson(asJson(json['credits']) ?? const {}),
      maxInputChars: asInt(limits['maxInputChars'], ChatConfig.fallbackMaxInputChars),
      maxMessages: asInt(limits['maxMessages']),
    );
  }
}

/// Why a conversation cannot take another message.
enum ChatLimitReached {
  messages,
  tokens;

  static ChatLimitReached? parse(dynamic value) => switch (asString(value)) {
        'MESSAGES' => ChatLimitReached.messages,
        'TOKENS' => ChatLimitReached.tokens,
        _ => null,
      };
}

class ChatConversation {
  const ChatConversation({
    required this.id,
    required this.title,
    required this.messageCount,
    required this.lastMessageAt,
    this.hasSummary = false,
    this.carriedFromId,
    this.createdAt,
    this.limitReached,
  });

  final String id;
  final String title;
  final int messageCount;
  final bool hasSummary;
  final String? carriedFromId;
  final DateTime? createdAt;
  final DateTime? lastMessageAt;
  final ChatLimitReached? limitReached;

  ChatConversation copyWith({
    String? title,
    ChatLimitReached? limitReached,
    bool clearLimit = false,
  }) =>
      ChatConversation(
        id: id,
        title: title ?? this.title,
        messageCount: messageCount,
        hasSummary: hasSummary,
        carriedFromId: carriedFromId,
        createdAt: createdAt,
        lastMessageAt: lastMessageAt,
        limitReached: clearLimit ? null : (limitReached ?? this.limitReached),
      );

  factory ChatConversation.fromJson(Json json) => ChatConversation(
        id: asString(json['id']),
        title: asString(json['title']),
        messageCount: asInt(json['messageCount']),
        hasSummary: asBool(json['hasSummary']),
        carriedFromId: asStringOrNull(json['carriedFromId']),
        createdAt: asDate(json['createdAt']),
        lastMessageAt: asDate(json['lastMessageAt']),
        limitReached: ChatLimitReached.parse(json['limitReached']),
      );
}

enum ChatRole { user, assistant }

/// How a message ended. `partial` is also what a reply still being written is.
enum ChatMessageStatus {
  complete,
  partial,
  stopped,
  error;

  static ChatMessageStatus parse(dynamic value) => switch (asString(value)) {
        'PARTIAL' => ChatMessageStatus.partial,
        'STOPPED' => ChatMessageStatus.stopped,
        'ERROR' => ChatMessageStatus.error,
        _ => ChatMessageStatus.complete,
      };
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.clientKey,
    required this.role,
    required this.content,
    this.seq = 0,
    this.status = ChatMessageStatus.complete,
    this.createdAt,
    this.summarized = false,
    this.imageUrl,
    this.localImagePath,
  });

  /// A message the phone made before the server has numbered it: the sent
  /// question, and the empty answer that fills as it streams.
  factory ChatMessage.local({
    required String key,
    required ChatRole role,
    String content = '',
    String? localImagePath,
  }) =>
      ChatMessage(
        id: key,
        clientKey: key,
        role: role,
        content: content,
        status: role == ChatRole.assistant ? ChatMessageStatus.partial : ChatMessageStatus.complete,
        localImagePath: localImagePath,
      );

  final String id;

  /// What the list keys its widgets by. It never changes, even when the server
  /// replaces a local message with the real one, so the bubble is not rebuilt
  /// from nothing in the middle of a reply.
  final String clientKey;
  final int seq;
  final ChatRole role;
  final String content;
  final ChatMessageStatus status;
  final DateTime? createdAt;
  final bool summarized;

  /// The picture sent with a question, as a link the server signed. It runs out,
  /// so a screen that is kept open for hours may have to ask again.
  final String? imageUrl;

  /// The same picture as the file on this phone, for the message just sent: it
  /// is shown at once instead of waiting for the link to load. A conversation
  /// read back from the server has none.
  final String? localImagePath;

  bool get isUser => role == ChatRole.user;
  bool get isAssistant => role == ChatRole.assistant;
  bool get hasImage => imageUrl != null || localImagePath != null;

  ChatMessage copyWith({String? id, String? content, ChatMessageStatus? status}) => ChatMessage(
        id: id ?? this.id,
        clientKey: clientKey,
        seq: seq,
        role: role,
        content: content ?? this.content,
        status: status ?? this.status,
        createdAt: createdAt,
        summarized: summarized,
        imageUrl: imageUrl,
        localImagePath: localImagePath,
      );

  /// The server's version of this message, kept under this one's [clientKey].
  ChatMessage replacedBy(ChatMessage server) => ChatMessage(
        id: server.id,
        clientKey: clientKey,
        seq: server.seq,
        role: server.role,
        content: server.content,
        status: server.status,
        createdAt: server.createdAt,
        summarized: server.summarized,
        imageUrl: server.imageUrl,
        localImagePath: localImagePath,
      );

  factory ChatMessage.fromJson(Json json) {
    final id = asString(json['id']);
    return ChatMessage(
      id: id,
      clientKey: id,
      seq: asInt(json['seq']),
      role: asString(json['role']) == 'user' ? ChatRole.user : ChatRole.assistant,
      content: asString(json['content']),
      status: ChatMessageStatus.parse(json['status']),
      createdAt: asDate(json['createdAt']),
      summarized: asBool(json['summarized']),
      imageUrl: asStringOrNull(json['imageUrl']),
    );
  }
}

/// `GET /chat/conversations/:id`.
class ChatConversationDetail {
  const ChatConversationDetail({required this.conversation, required this.messages});

  final ChatConversation conversation;
  final List<ChatMessage> messages;

  factory ChatConversationDetail.fromJson(Json json) => ChatConversationDetail(
        conversation: ChatConversation.fromJson(json),
        messages: asList(json['messages'], ChatMessage.fromJson),
      );
}

/// `POST /chat/images`: a picture the server has taken in, waiting to be sent
/// with a question.
class ChatUploadedImage {
  const ChatUploadedImage({required this.key, required this.url});

  /// What to send with the question.
  final String key;

  /// A signed link to the picture as the server stored it.
  final String url;

  factory ChatUploadedImage.fromJson(Json json) =>
      ChatUploadedImage(key: asString(json['key']), url: asString(json['url']));
}

/// `POST …/continue`: the new chat that carries the summary.
class ChatContinueResult {
  const ChatContinueResult({required this.conversation, required this.carriedEverything});

  final ChatConversation conversation;

  /// False when credits did not stretch to summarising the latest turns.
  final bool carriedEverything;

  factory ChatContinueResult.fromJson(Json json) => ChatContinueResult(
        conversation: ChatConversation.fromJson(asJson(json['conversation']) ?? const {}),
        carriedEverything: asBool(json['carriedEverything'], true),
      );
}

// ── The reply stream ──────────────────────────────────────────────────────

/// One event of a streamed reply, parsed. `meta` · `status` · `delta`… ·
/// `done`, or `error` at any point.
sealed class ChatStreamEvent {
  const ChatStreamEvent();

  /// Null for an event this app does not know, or whose data is not JSON — both
  /// are skipped, so a newer server can add events without breaking an older app.
  static ChatStreamEvent? parse(String event, String data) {
    final Json json;
    try {
      json = asJson(jsonDecode(data)) ?? const {};
    } catch (_) {
      return null;
    }

    switch (event) {
      case 'meta':
        final user = asJson(json['userMessage']);
        return ChatMeta(
          conversation: ChatConversation.fromJson(asJson(json['conversation']) ?? const {}),
          userMessage: user == null ? null : ChatMessage.fromJson(user),
          assistantMessageId: asString(json['assistantMessageId']),
        );
      case 'status':
        return asString(json['phase']) == 'compacting' ? const ChatCompacting() : null;
      case 'delta':
        final text = asString(json['text']);
        return text.isEmpty ? null : ChatDelta(text);
      case 'done':
        final message = asJson(json['message']);
        return ChatDone(
          message: message == null ? null : ChatMessage.fromJson(message),
          conversation: ChatConversation.fromJson(asJson(json['conversation']) ?? const {}),
          credits: ChatCredits.fromJson(asJson(json['credits']) ?? const {}),
        );
      case 'error':
        return ChatStreamError(
          code: asString(json['code']),
          message: asString(json['message']),
          retryable: asBool(json['retryable']),
          partial: asBool(json['partial']),
          messageId: asStringOrNull(json['messageId']),
          details: asJson(json['details']),
        );
    }
    return null;
  }
}

class ChatMeta extends ChatStreamEvent {
  const ChatMeta({
    required this.conversation,
    required this.userMessage,
    required this.assistantMessageId,
  });

  final ChatConversation conversation;

  /// Null when the reply is a regeneration: no new question was saved.
  final ChatMessage? userMessage;
  final String assistantMessageId;
}

/// Older messages are being folded into the summary before the reply starts.
class ChatCompacting extends ChatStreamEvent {
  const ChatCompacting();
}

class ChatDelta extends ChatStreamEvent {
  const ChatDelta(this.text);

  final String text;
}

class ChatDone extends ChatStreamEvent {
  const ChatDone({required this.message, required this.conversation, required this.credits});

  final ChatMessage? message;
  final ChatConversation conversation;
  final ChatCredits credits;
}

class ChatStreamError extends ChatStreamEvent {
  const ChatStreamError({
    required this.code,
    required this.message,
    required this.retryable,
    required this.partial,
    required this.messageId,
    required this.details,
  });

  final String code;
  final String message;
  final bool retryable;

  /// Some of the reply had already arrived (and was kept).
  final bool partial;
  final String? messageId;
  final Json? details;
}
