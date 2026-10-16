import 'dart:async';

import 'package:hariharibol/models/api_failure.dart';
import 'package:hariharibol/models/chat.dart';
import 'package:hariharibol/models/paged.dart';
import 'package:hariharibol/services/api_client.dart';
import 'package:hariharibol/services/chat_service.dart';

ChatCredits fakeCredits({
  int percent = 80,
  bool exhausted = false,
  bool enabled = true,
  bool canUpgrade = true,
  ChatLimitedBy? limitedBy,
  String? levelName = 'Sevak',
}) =>
    ChatCredits(
      enabled: enabled,
      levelName: levelName,
      percent: percent,
      exhausted: exhausted,
      limitedBy: limitedBy,
      resetsAt: null,
      renewsAt: DateTime(2026, 11, 3),
      canUpgrade: canUpgrade,
    );

ChatConversation fakeConversation({
  String id = 'c1',
  String title = 'New chat',
  ChatLimitReached? limitReached,
}) =>
    ChatConversation(
      id: id,
      title: title,
      messageCount: 0,
      lastMessageAt: DateTime(2026, 10, 16),
      limitReached: limitReached,
    );

ChatMessage serverMessage(
  String id,
  ChatRole role,
  String content, {
  int seq = 1,
  ChatMessageStatus status = ChatMessageStatus.complete,
}) =>
    ChatMessage(id: id, clientKey: id, seq: seq, role: role, content: content, status: status);

/// A chat server that plays back what a test pushes into it.
///
/// Sending or regenerating opens a stream the test then feeds by hand
/// ([push], [finish], [drop]) — the real service's job of turning HTTP into
/// events is covered by the parser tests; what is under test here is what the
/// controller does with them. A refusal the server would make before streaming
/// is queued with [refuseNext].
class FakeChatService implements ChatService {
  ChatStatus statusValue = ChatStatus(
    description: 'Answers from the Sri Vaishnava tradition.',
    credits: fakeCredits(),
    maxInputChars: 500,
    maxMessages: 40,
  );

  ChatConversationDetail detail = ChatConversationDetail(
    conversation: fakeConversation(),
    messages: const [],
  );

  /// Every call made, in order: `send:<id>:<text>`, `regenerate:<id>`, …
  final List<String> calls = [];

  StreamController<ChatStreamEvent>? live;
  ApiFailure? _refusal;
  bool cancelled = false;
  ChatCompactResult? compactResult;
  ChatContinueResult? continueResult;

  void refuseNext(ApiFailure failure) => _refusal = failure;

  void push(ChatStreamEvent event) => live!.add(event);

  Future<void> finish() => live!.close();

  /// The connection drops: an error on the stream.
  void drop() => live!.addError(const ApiFailure(kind: FailureKind.network));

  Stream<ChatStreamEvent> _open(String call, ApiCancelToken? cancel) async* {
    calls.add(call);
    final refusal = _refusal;
    if (refusal != null) {
      _refusal = null;
      throw refusal;
    }
    final controller = live = StreamController<ChatStreamEvent>(onCancel: () => cancelled = true);
    yield* controller.stream;
  }

  @override
  Stream<ChatStreamEvent> send(String id, String content, {ApiCancelToken? cancel}) =>
      _open('send:$id:$content', cancel);

  @override
  Stream<ChatStreamEvent> regenerate(String id, {ApiCancelToken? cancel}) => _open('regenerate:$id', cancel);

  @override
  Future<ChatStatus> status() async => statusValue;

  @override
  Future<ChatConversationPage> conversations({int page = 1}) async => Paged.empty<ChatConversation>();

  @override
  Future<ChatConversation> create({String? title}) async {
    calls.add('create');
    return fakeConversation();
  }

  @override
  Future<ChatConversationDetail> conversation(String id) async => detail;

  @override
  Future<ChatConversation> rename(String id, String title) async => fakeConversation(id: id, title: title);

  @override
  Future<void> delete(String id) async => calls.add('delete:$id');

  @override
  Future<ChatCompactResult> compact(String id) async {
    calls.add('compact:$id');
    return compactResult ??
        ChatCompactResult(compacted: true, conversation: fakeConversation(id: id), credits: fakeCredits(percent: 70));
  }

  @override
  Future<ChatContinueResult> continueChat(String id) async {
    calls.add('continue:$id');
    return continueResult ?? ChatContinueResult(conversation: fakeConversation(id: 'c2'), carriedEverything: true);
  }
}
