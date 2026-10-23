import 'dart:async';

import 'package:hariharibol/models/api_failure.dart';
import 'package:hariharibol/models/chat.dart';
import 'package:hariharibol/models/sakha_profile.dart';
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

  /// What the server answers to "my conversation": null for a reader who has
  /// not said anything yet, which is how most tests begin.
  ChatConversationDetail? detail;

  /// Every call made, in order: `send:<id>:<text>`, `regenerate:<id>`, `clear`…
  final List<String> calls = [];

  StreamController<ChatStreamEvent>? live;
  ApiFailure? _refusal;
  bool cancelled = false;
  ChatContinueResult? continueResult;

  /// When set, `current()` fails with it (once).
  ApiFailure? currentFailure;

  /// When set, `clear()` fails with it (once).
  ApiFailure? clearFailure;

  /// When set, the next upload fails with it.
  Object? uploadFailure;

  /// When set, an upload waits for the test to complete this.
  Completer<ChatUploadedImage>? uploadGate;

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
  Stream<ChatStreamEvent> send(String id, String content, {String? imageKey, ApiCancelToken? cancel}) =>
      _open('send:$id:$content${imageKey == null ? '' : ':image=$imageKey'}', cancel);

  @override
  Stream<ChatStreamEvent> regenerate(String id, {ApiCancelToken? cancel}) => _open('regenerate:$id', cancel);

  @override
  Future<ChatStatus> status() async => statusValue;

  @override
  Future<ChatConversationDetail?> current() async {
    final failure = currentFailure;
    if (failure != null) {
      currentFailure = null;
      throw failure;
    }
    return detail;
  }

  @override
  Future<ChatConversation> create({String? title}) async {
    calls.add('create');
    return fakeConversation();
  }

  @override
  Future<void> clear() async {
    calls.add('clear');
    final failure = clearFailure;
    if (failure != null) {
      clearFailure = null;
      throw failure;
    }
    detail = null;
  }

  /// What the server has noted about the reader. A test sets it; the three
  /// calls below read and change it the way the server would.
  SakhaProfile profileValue = const SakhaProfile();

  /// When set, the next `profile()`, `setProfileLearning()` or `deleteProfile()`
  /// fails with it (once).
  ApiFailure? profileFailure;
  ApiFailure? learningFailure;
  ApiFailure? deleteProfileFailure;

  /// When set, `profile()` waits for the test to complete this.
  Completer<void>? profileGate;

  @override
  Future<SakhaProfile> profile() async {
    calls.add('profile');
    final gate = profileGate;
    if (gate != null) await gate.future;
    final failure = profileFailure;
    if (failure != null) {
      profileFailure = null;
      throw failure;
    }
    return profileValue;
  }

  @override
  Future<SakhaProfile> setProfileLearning(bool learning) async {
    calls.add('learning:$learning');
    final failure = learningFailure;
    if (failure != null) {
      learningFailure = null;
      throw failure;
    }
    return profileValue = profileValue.copyWith(learning: learning);
  }

  @override
  Future<void> deleteProfile() async {
    calls.add('deleteProfile');
    final failure = deleteProfileFailure;
    if (failure != null) {
      deleteProfileFailure = null;
      throw failure;
    }
    // The server empties the row when learning is off and removes it when on;
    // either way the reader is left with nothing noted and the same switch.
    profileValue = SakhaProfile(learning: profileValue.learning);
  }

  @override
  Future<ChatUploadedImage> uploadImage(String path, {ApiCancelToken? cancel}) async {
    calls.add('upload:$path');
    final failure = uploadFailure;
    if (failure != null) {
      uploadFailure = null;
      throw failure;
    }
    final gate = uploadGate;
    if (gate != null) return gate.future;
    return ChatUploadedImage(key: 'key:${path.split('/').last}', url: 'https://files.test/${path.split('/').last}');
  }

  @override
  Future<ChatContinueResult> continueChat(String id) async {
    calls.add('continue:$id');
    return continueResult ?? ChatContinueResult(conversation: fakeConversation(id: 'c2'), carriedEverything: true);
  }
}
