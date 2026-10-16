import '../core/constants/api_paths.dart';
import '../core/constants/chat_config.dart';
import '../models/chat.dart';
import '../models/paged.dart';
import 'api_client.dart';

/// The devotional assistant's API. Everything but sending is an ordinary call;
/// sending and regenerating answer with a stream of events.
///
/// The app never talks to an AI provider and never sees a key — the server
/// does that and sends the text through. It also never sees token counts, only
/// the percentage the credit meter shows.
class ChatService {
  ChatService._();

  static final ChatService instance = ChatService._();

  final ApiClient _api = ApiClient.instance;

  Future<ChatStatus> status() async {
    final response = await _api.get(ApiPaths.chatStatus);
    return ChatStatus.fromJson(response.json);
  }

  Future<ChatConversationPage> conversations({int page = 1}) async {
    final response = await _api.get(
      ApiPaths.chatConversations,
      query: {'page': page, 'pageSize': ChatConfig.conversationPageSize},
    );
    return Paged.fromResponse(response.data, response.meta, ChatConversation.fromJson);
  }

  Future<ChatConversation> create({String? title}) async {
    final response = await _api.post(
      ApiPaths.chatConversations,
      body: {'title': ?title},
    );
    return ChatConversation.fromJson(response.json);
  }

  Future<ChatConversationDetail> conversation(String id) async {
    final response = await _api.get(ApiPaths.chatConversation(id));
    return ChatConversationDetail.fromJson(response.json);
  }

  Future<ChatConversation> rename(String id, String title) async {
    final response = await _api.patch(ApiPaths.chatConversation(id), body: {'title': title});
    return ChatConversation.fromJson(response.json);
  }

  Future<void> delete(String id) => _api.delete(ApiPaths.chatConversation(id));

  /// Sends a message and streams the reply. A refusal before the stream opens
  /// (credits, a full chat, a reply already in progress) is thrown as an
  /// `ApiFailure` before the first event.
  Stream<ChatStreamEvent> send(String id, String content, {ApiCancelToken? cancel}) {
    return _events(ApiPaths.chatMessages(id), body: {'content': content}, cancel: cancel);
  }

  /// Answers the last question again, replacing the answer after it.
  Stream<ChatStreamEvent> regenerate(String id, {ApiCancelToken? cancel}) {
    return _events(ApiPaths.chatRegenerate(id), cancel: cancel);
  }

  Stream<ChatStreamEvent> _events(String path, {Object? body, ApiCancelToken? cancel}) async* {
    final events = await _api.postEventStream(path, body: body ?? const <String, dynamic>{}, cancel: cancel);
    await for (final raw in events) {
      final event = ChatStreamEvent.parse(raw.event, raw.data);
      if (event != null) yield event;
    }
  }

  Future<ChatCompactResult> compact(String id) async {
    final response = await _api.post(ApiPaths.chatCompact(id));
    return ChatCompactResult.fromJson(response.json);
  }

  /// A new chat that carries this one's summary — for a chat that is full.
  Future<ChatContinueResult> continueChat(String id) async {
    final response = await _api.post(ApiPaths.chatContinue(id));
    return ChatContinueResult.fromJson(response.json);
  }
}
