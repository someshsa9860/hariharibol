import 'dart:io';

import '../core/constants/api_paths.dart';
import '../models/chat.dart';
import 'api_client.dart';

/// Ask Sakha's API. Everything but sending is an ordinary call;
/// sending and regenerating answer with a stream of events.
///
/// The app never talks to an AI provider and never sees a key — the server
/// does that and sends the text through. It also never sees token counts, only
/// the percentage the credit meter shows.
///
/// A reader has one conversation. The server keeps the older ones a "start a
/// new chat" leaves behind (their summary is what the new one is built on), and
/// [clear] is what removes them all.
class ChatService {
  ChatService._();

  static final ChatService instance = ChatService._();

  final ApiClient _api = ApiClient.instance;

  Future<ChatStatus> status() async {
    final response = await _api.get(ApiPaths.chatStatus);
    return ChatStatus.fromJson(response.json);
  }

  /// The conversation to open, or null when nothing has been said yet.
  Future<ChatConversationDetail?> current() async {
    final response = await _api.get(ApiPaths.chatCurrent);
    if (response.data == null) return null;
    return ChatConversationDetail.fromJson(response.json);
  }

  Future<ChatConversation> create({String? title}) async {
    final response = await _api.post(
      ApiPaths.chatConversations,
      body: {'title': ?title},
    );
    return ChatConversation.fromJson(response.json);
  }

  /// Removes everything said so far, and with it what Sakha remembers of it.
  Future<void> clear() => _api.delete(ApiPaths.chatConversations);

  /// Hands a picture to the server to be read and kept with the next question.
  /// The file is the one the picker already scaled down.
  Future<ChatUploadedImage> uploadImage(String path, {ApiCancelToken? cancel}) async {
    final bytes = await File(path).readAsBytes();
    final response = await _api.postBytes(
      ApiPaths.chatImages,
      bytes,
      contentType: _contentTypeOf(path),
      cancel: cancel,
    );
    return ChatUploadedImage.fromJson(response.json);
  }

  /// Sends a message and streams the reply. A refusal before the stream opens
  /// (credits, a full chat, a reply already in progress) is thrown as an
  /// `ApiFailure` before the first event.
  ///
  /// [content] may be empty when a picture goes with it.
  Stream<ChatStreamEvent> send(
    String id,
    String content, {
    String? imageKey,
    ApiCancelToken? cancel,
  }) {
    return _events(
      ApiPaths.chatMessages(id),
      body: {if (content.isNotEmpty) 'content': content, 'imageKey': ?imageKey},
      cancel: cancel,
    );
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

  /// A new chat that carries this one's summary — for a chat that is full.
  Future<ChatContinueResult> continueChat(String id) async {
    final response = await _api.post(ApiPaths.chatContinue(id));
    return ChatContinueResult.fromJson(response.json);
  }

  /// The picker hands over JPEG almost always; the server checks what the bytes
  /// really are, so this is only the label the request wears.
  static String _contentTypeOf(String path) {
    final lower = path.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }
}
