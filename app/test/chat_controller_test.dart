// The chat controller, driven by a fake server that plays back a stream by
// hand: tokens accumulate, Stop keeps what arrived, an error after some text
// keeps it and offers Retry, a refusal before streaming becomes a screen state,
// and regenerating replaces the last answer.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/constants/chat_config.dart';
import 'package:hariharibol/models/api_failure.dart';
import 'package:hariharibol/models/chat.dart';
import 'package:hariharibol/providers/chat_controller.dart';
import 'package:hariharibol/providers/chat_provider.dart';
import 'package:hariharibol/providers/chat_state.dart';

import 'support/fake_chat_service.dart';

void main() {
  late FakeChatService fake;
  late ProviderContainer container;

  ChatState read(String id) => container.read(chatControllerProvider(id));
  /// The screen watches its controller, which is what keeps it alive; so does this.
  ChatController controller(String id) {
    container.listen(chatControllerProvider(id), (_, _) {});
    return container.read(chatControllerProvider(id).notifier);
  }

  /// Opens a chat that already holds one exchange.
  Future<ChatController> existing({List<ChatMessage>? messages, ChatConversation? chat}) async {
    fake.detail = ChatConversationDetail(
      conversation: chat ?? fakeConversation(id: 'c1', title: 'On the Gita'),
      messages: messages ??
          [
            serverMessage('m1', ChatRole.user, 'What is dharma?', seq: 1),
            serverMessage('m2', ChatRole.assistant, 'Dharma is duty.', seq: 2),
          ],
    );
    final notifier = controller('c1');
    await notifier.ready;
    return notifier;
  }

  ChatMeta meta({String user = 'u1', String answer = 'a1', bool regenerate = false, String text = 'hi'}) => ChatMeta(
        conversation: fakeConversation(id: 'c1', title: 'On the Gita'),
        userMessage: regenerate ? null : serverMessage(user, ChatRole.user, text, seq: 3),
        assistantMessageId: answer,
      );

  ChatDone done(String text, {String answer = 'a1', ChatCredits? credits, ChatLimitReached? limit}) => ChatDone(
        message: serverMessage(answer, ChatRole.assistant, text, seq: 4),
        conversation: fakeConversation(id: 'c1', title: 'On the Gita', limitReached: limit),
        credits: credits ?? fakeCredits(),
      );

  setUp(() {
    fake = FakeChatService();
    container = ProviderContainer(overrides: [chatServiceProvider.overrideWithValue(fake)]);
    addTearDown(container.dispose);
    // Keep the providers alive, as the screen does by watching them.
    container.listen(chatStatusProvider, (_, _) {});
  });

  group('loading', () {
    test('a chat loads its conversation and messages', () async {
      await existing();
      final state = read('c1');
      expect(state.loaded, isTrue);
      expect(state.conversation!.title, 'On the Gita');
      expect(state.messages.map((m) => m.content), ['What is dharma?', 'Dharma is duty.']);
    });

    test('a new chat has nothing to load and no conversation yet', () {
      controller(ChatConfig.newChatId);
      final state = read(ChatConfig.newChatId);
      expect(state.loaded, isTrue);
      expect(state.conversation, isNull);
      expect(state.messages, isEmpty);
    });
  });

  group('streaming', () {
    test('tokens accumulate in the answer, which is shown at once for the first one', () async {
      final chat = await existing();
      final sending = chat.send('Tell me more');
      await pumpEventQueue();

      // The question and an empty answer are on screen before the server speaks.
      expect(read('c1').messages.map((m) => m.content), ['What is dharma?', 'Dharma is duty.', 'Tell me more', '']);
      expect(read('c1').phase, ChatPhase.waiting);
      expect(read('c1').awaitingFirstWord, isTrue);

      fake.push(meta(text: 'Tell me more'));
      fake.push(const ChatDelta('Hari'));
      await pumpEventQueue();
      expect(read('c1').messages.last.content, 'Hari');
      expect(read('c1').phase, ChatPhase.streaming);

      fake.push(const ChatDelta(' bol'));
      fake.push(const ChatDelta('!'));
      fake.push(done('Hari bol!'));
      await fake.finish();
      await sending;

      final state = read('c1');
      expect(state.phase, ChatPhase.idle);
      expect(state.messages.last.content, 'Hari bol!');
      expect(state.messages.last.status, ChatMessageStatus.complete);
      expect(state.problem, isNull);
    });

    test('text is buffered: many deltas become few repaints', () async {
      final chat = await existing();
      final seen = <String>[];
      container.listen(chatControllerProvider('c1'), (_, next) => seen.add(next.messages.last.content));

      final sending = chat.send('go');
      await pumpEventQueue();
      fake.push(meta(text: 'go'));
      fake.push(const ChatDelta('a'));
      await pumpEventQueue();
      seen.clear();

      for (var i = 0; i < 30; i++) {
        fake.push(const ChatDelta('b'));
      }
      await pumpEventQueue();
      // Nothing has been written to the screen yet: the buffer is waiting out its interval.
      expect(seen, isEmpty);

      await Future<void>.delayed(ChatConfig.flushInterval * 2);
      expect(seen, hasLength(1));
      expect(seen.single, 'a${'b' * 30}');

      fake.push(done('a${'b' * 30}'));
      await fake.finish();
      await sending;
    });

    test('the answer keeps one key from placeholder to server message', () async {
      final chat = await existing();
      final sending = chat.send('hi');
      await pumpEventQueue();
      final key = read('c1').messages.last.clientKey;

      fake.push(meta());
      fake.push(const ChatDelta('x'));
      await pumpEventQueue();
      expect(read('c1').messages.last.clientKey, key);
      expect(read('c1').messages.last.id, 'a1');

      fake.push(done('x'));
      await fake.finish();
      await sending;
      expect(read('c1').messages.last.clientKey, key);
    });

    test('the sent question is replaced by the server\'s copy', () async {
      final chat = await existing();
      final sending = chat.send('hi');
      await pumpEventQueue();
      expect(read('c1').messages[2].id, startsWith('local-'));

      fake.push(meta(user: 'u99'));
      fake.push(done('ok'));
      await fake.finish();
      await sending;
      expect(read('c1').messages[2].id, 'u99');
      expect(read('c1').messages[2].seq, 3);
    });

    test('compacting is shown until the first word', () async {
      final chat = await existing();
      final sending = chat.send('hi');
      await pumpEventQueue();
      fake.push(const ChatCompacting());
      await pumpEventQueue();
      expect(read('c1').compacting, isTrue);

      fake.push(meta());
      fake.push(const ChatDelta('x'));
      await pumpEventQueue();
      expect(read('c1').compacting, isFalse);

      fake.push(done('x'));
      await fake.finish();
      await sending;
    });

    test('done applies the new credit reading to the meter', () async {
      await container.read(chatStatusProvider.future);
      expect(container.read(chatStatusProvider).value!.credits.percent, 80);

      final chat = await existing();
      final sending = chat.send('hi');
      await pumpEventQueue();
      fake.push(meta());
      fake.push(done('ok', credits: fakeCredits(percent: 64)));
      await fake.finish();
      await sending;

      expect(container.read(chatStatusProvider).value!.credits.percent, 64);
    });

    test('a second question while one is being answered is ignored', () async {
      final chat = await existing();
      final sending = chat.send('one');
      await pumpEventQueue();
      await chat.send('two');
      expect(fake.calls.where((c) => c.startsWith('send')), ['send:c1:one']);

      fake.push(meta());
      fake.push(done('ok'));
      await fake.finish();
      await sending;
    });

    test('a new chat is made on the server when the first message is sent', () async {
      final chat = controller(ChatConfig.newChatId);
      final sending = chat.send('Namaste');
      await pumpEventQueue();
      expect(fake.calls, ['create', 'send:c1:Namaste']);
      expect(read(ChatConfig.newChatId).conversation!.id, 'c1');

      fake.push(meta(text: 'Namaste'));
      fake.push(done('Hari Bol'));
      await fake.finish();
      await sending;
      expect(read(ChatConfig.newChatId).messages.map((m) => m.content), ['Namaste', 'Hari Bol']);
    });
  });

  group('stop', () {
    test('keeps what arrived, marked as stopped, and closes the connection', () async {
      final chat = await existing();
      final sending = chat.send('hi');
      await pumpEventQueue();
      fake.push(meta());
      fake.push(const ChatDelta('Half an ans'));
      await pumpEventQueue();

      await chat.stop();
      await sending;

      final state = read('c1');
      expect(state.phase, ChatPhase.idle);
      expect(state.messages.last.content, 'Half an ans');
      expect(state.messages.last.status, ChatMessageStatus.stopped);
      expect(state.problem, isNull);
      expect(fake.cancelled, isTrue);

      // Words that were still in the buffer are not lost.
      expect(state.canSend, isTrue);
    });

    test('text still waiting in the buffer is kept', () async {
      final chat = await existing();
      final sending = chat.send('hi');
      await pumpEventQueue();
      fake.push(meta());
      fake.push(const ChatDelta('one'));
      await pumpEventQueue();
      fake.push(const ChatDelta(' two'));
      await pumpEventQueue();

      await chat.stop();
      await sending;
      expect(read('c1').messages.last.content, 'one two');
    });

    test('before any word arrives the empty answer is removed', () async {
      final chat = await existing();
      final sending = chat.send('hi');
      await pumpEventQueue();
      fake.push(meta());
      await pumpEventQueue();

      await chat.stop();
      await sending;
      expect(read('c1').messages.map((m) => m.content), ['What is dharma?', 'Dharma is duty.', 'hi']);
    });

    test('events that arrive after Stop are ignored', () async {
      final chat = await existing();
      final sending = chat.send('hi');
      await pumpEventQueue();
      fake.push(meta());
      fake.push(const ChatDelta('kept'));
      await pumpEventQueue();
      await chat.stop();
      await sending;

      expect(fake.live!.hasListener, isFalse);
      expect(read('c1').messages.last.content, 'kept');
    });
  });

  group('errors', () {
    test('a dropped connection after some text keeps it and offers Retry', () async {
      final chat = await existing();
      final sending = chat.send('hi');
      await pumpEventQueue();
      fake.push(meta());
      fake.push(const ChatDelta('The first par'));
      await pumpEventQueue();
      fake.drop();
      await sending;

      final state = read('c1');
      expect(state.phase, ChatPhase.idle);
      expect(state.messages.last.content, 'The first par');
      expect(state.messages.last.status, ChatMessageStatus.partial);
      expect(state.problem!.issue, ChatIssue.connectionLost);
      expect(state.problem!.canRetry, isTrue);
    });

    test('Retry asks for the answer again, replacing the partial one', () async {
      final chat = await existing();
      final sending = chat.send('hi');
      await pumpEventQueue();
      fake.push(meta());
      fake.push(const ChatDelta('The first par'));
      await pumpEventQueue();
      fake.drop();
      await sending;

      final retrying = chat.retry();
      await pumpEventQueue();
      expect(fake.calls.last, 'regenerate:c1');
      expect(read('c1').problem, isNull);
      expect(read('c1').messages.last.content, '');

      fake.push(meta(regenerate: true));
      fake.push(const ChatDelta('The whole answer.'));
      fake.push(done('The whole answer.'));
      await fake.finish();
      await retrying;
      expect(read('c1').messages.map((m) => m.content), ['What is dharma?', 'Dharma is duty.', 'hi', 'The whole answer.']);
    });

    test('a stream that ends with no done is a lost connection too', () async {
      final chat = await existing();
      final sending = chat.send('hi');
      await pumpEventQueue();
      fake.push(meta());
      fake.push(const ChatDelta('part'));
      await pumpEventQueue();
      await fake.finish();
      await sending;

      expect(read('c1').messages.last.content, 'part');
      expect(read('c1').problem!.issue, ChatIssue.connectionLost);
    });

    test('an error event after some text keeps it; with none, the empty answer goes', () async {
      final chat = await existing();
      var sending = chat.send('hi');
      await pumpEventQueue();
      fake.push(meta());
      fake.push(const ChatDelta('some'));
      await pumpEventQueue();
      fake.push(const ChatStreamError(
        code: 'AI_FAILED',
        message: 'x',
        retryable: true,
        partial: true,
        messageId: 'a1',
        details: null,
      ));
      await sending;
      expect(read('c1').messages.last.content, 'some');
      expect(read('c1').problem!.issue, ChatIssue.replyFailed);
      expect(read('c1').problem!.canRetry, isTrue);

      sending = chat.regenerate();
      await pumpEventQueue();
      fake.push(meta(regenerate: true));
      fake.push(const ChatStreamError(
        code: 'AI_FAILED',
        message: 'x',
        retryable: true,
        partial: false,
        messageId: null,
        details: null,
      ));
      await sending;
      expect(read('c1').messages.last.content, 'hi');
    });

    test('a network failure before the server saw the question hands the text back', () async {
      final chat = await existing();
      fake.refuseNext(const ApiFailure(kind: FailureKind.network));
      await chat.send('my question');

      final state = read('c1');
      expect(state.messages.map((m) => m.content), ['What is dharma?', 'Dharma is duty.']);
      expect(state.restoredDraft, 'my question');
      expect(state.problem!.issue, ChatIssue.connectionLost);
      expect(state.problem!.canRetry, isFalse);

      chat.draftRestored();
      expect(read('c1').restoredDraft, isNull);
    });
  });

  group('refused before streaming', () {
    test('402 CREDITS_EXHAUSTED sets the exhausted state and returns the question', () async {
      final chat = await existing();
      fake.refuseNext(const ApiFailure(
        kind: FailureKind.unknown,
        statusCode: 402,
        code: 'CREDITS_EXHAUSTED',
        details: {'limitedBy': 'daily', 'resetsAt': '2026-10-17T00:00:00.000Z', 'canUpgrade': true, 'startNewChat': false},
      ));
      await chat.send('one more');

      final problem = read('c1').problem!;
      expect(problem.issue, ChatIssue.creditsExhausted);
      expect(problem.limitedBy, ChatLimitedBy.daily);
      expect(problem.canUpgrade, isTrue);
      expect(problem.startNewChat, isFalse);
      expect(problem.resetsAt, isNotNull);
      expect(read('c1').restoredDraft, 'one more');
      expect(read('c1').messages, hasLength(2));
      expect(read('c1').phase, ChatPhase.idle);
    });

    test('402 for this chat\'s share asks for a new chat, not an upgrade', () async {
      final chat = await existing();
      fake.refuseNext(const ApiFailure(
        kind: FailureKind.unknown,
        statusCode: 402,
        code: 'CREDITS_EXHAUSTED',
        details: {'limitedBy': 'wallet', 'canUpgrade': false, 'startNewChat': true},
      ));
      await chat.send('x');
      expect(read('c1').problem!.startNewChat, isTrue);
      expect(read('c1').problem!.canUpgrade, isFalse);
    });

    test('402 CHAT_NOT_AVAILABLE says the plan has no chat', () async {
      final chat = await existing();
      fake.refuseNext(const ApiFailure(
        kind: FailureKind.unknown,
        statusCode: 402,
        code: 'CHAT_NOT_AVAILABLE',
        details: {'canUpgrade': true},
      ));
      await chat.send('x');
      expect(read('c1').problem!.issue, ChatIssue.notAvailable);
      expect(read('c1').problem!.canUpgrade, isTrue);
    });

    test('409 CONVERSATION_LIMIT marks the chat full', () async {
      final chat = await existing();
      fake.refuseNext(const ApiFailure(
        kind: FailureKind.conflict,
        statusCode: 409,
        code: 'CONVERSATION_LIMIT',
        details: {'reason': 'MESSAGES', 'canContinue': true},
      ));
      await chat.send('x');
      expect(read('c1').problem!.issue, ChatIssue.conversationFull);
      expect(read('c1').isFull, isTrue);
      expect(read('c1').canSend, isFalse);
    });

    test('409 for a reply already in progress is "busy"', () async {
      final chat = await existing();
      fake.refuseNext(const ApiFailure(kind: FailureKind.conflict, statusCode: 409, code: 'CONFLICT'));
      await chat.send('x');
      expect(read('c1').problem!.issue, ChatIssue.busy);
    });

    test('400 MESSAGE_TOO_LONG', () async {
      final chat = await existing();
      fake.refuseNext(const ApiFailure(kind: FailureKind.validation, statusCode: 400, code: 'MESSAGE_TOO_LONG'));
      await chat.send('x');
      expect(read('c1').problem!.issue, ChatIssue.tooLong);
    });

    test('an exhausted error event in the stream is the same state', () async {
      final chat = await existing();
      final sending = chat.send('x');
      await pumpEventQueue();
      fake.push(const ChatStreamError(
        code: 'CREDITS_EXHAUSTED',
        message: '',
        retryable: false,
        partial: false,
        messageId: null,
        details: {'limitedBy': 'wallet', 'canUpgrade': true},
      ));
      await sending;
      expect(read('c1').problem!.issue, ChatIssue.creditsExhausted);
      expect(read('c1').restoredDraft, 'x');
    });
  });

  group('regenerate', () {
    test('replaces the last answer with a new one', () async {
      final chat = await existing();
      final regenerating = chat.regenerate();
      await pumpEventQueue();

      expect(fake.calls.last, 'regenerate:c1');
      expect(read('c1').messages.map((m) => m.content), ['What is dharma?', '']);

      fake.push(meta(regenerate: true));
      fake.push(const ChatDelta('Dharma is what upholds.'));
      fake.push(done('Dharma is what upholds.'));
      await fake.finish();
      await regenerating;

      expect(read('c1').messages.map((m) => m.content), ['What is dharma?', 'Dharma is what upholds.']);
    });

    test('is refused with the question still there when credits are out', () async {
      final chat = await existing();
      fake.refuseNext(const ApiFailure(
        kind: FailureKind.unknown,
        statusCode: 402,
        code: 'CREDITS_EXHAUSTED',
        details: {'limitedBy': 'wallet', 'canUpgrade': true},
      ));
      await chat.regenerate();
      expect(read('c1').problem!.issue, ChatIssue.creditsExhausted);
      expect(read('c1').messages.map((m) => m.content), ['What is dharma?']);
      expect(read('c1').restoredDraft, isNull);
    });

    test('does nothing in a chat with no question to answer', () async {
      final chat = await existing(messages: const []);
      await chat.regenerate();
      expect(fake.calls, isEmpty);
    });
  });

  group('the rest', () {
    test('compact applies the credits and reports whether anything was folded', () async {
      final chat = await existing();
      expect(await chat.compact(), isTrue);
      expect(fake.calls, contains('compact:c1'));
      expect(container.read(chatStatusProvider).value!.credits.percent, 70);

      fake.compactResult = ChatCompactResult(compacted: false, conversation: fakeConversation(), credits: fakeCredits(percent: 70));
      expect(await chat.compact(), isFalse);
    });

    test('a full chat continues in a new one', () async {
      final chat = await existing(chat: fakeConversation(id: 'c1', limitReached: ChatLimitReached.messages));
      expect(read('c1').isFull, isTrue);
      final next = await chat.startNewChat();
      expect(next!.conversation.id, 'c2');
      expect(next.carriedEverything, isTrue);
      expect(read('c1').working, isFalse);
    });
  });

  group('parsing the stream', () {
    test('each event is read from its name and data; unknown ones are skipped', () {
      final meta = ChatStreamEvent.parse(
        'meta',
        '{"conversation":{"id":"c1","title":"T","messageCount":2},"userMessage":{"id":"u","seq":1,"role":"user","content":"q","status":"COMPLETE"},"assistantMessageId":"a"}',
      ) as ChatMeta;
      expect(meta.assistantMessageId, 'a');
      expect(meta.userMessage!.role, ChatRole.user);

      expect((ChatStreamEvent.parse('delta', '{"text":"x"}') as ChatDelta).text, 'x');
      expect(ChatStreamEvent.parse('status', '{"phase":"compacting"}'), isA<ChatCompacting>());
      expect(ChatStreamEvent.parse('status', '{"phase":"other"}'), isNull);
      expect(ChatStreamEvent.parse('delta', '{"text":""}'), isNull);
      expect(ChatStreamEvent.parse('future-event', '{}'), isNull);
      expect(ChatStreamEvent.parse('delta', 'not json'), isNull);

      final error = ChatStreamEvent.parse(
        'error',
        '{"code":"AI_FAILED","message":"m","retryable":true,"partial":true,"messageId":"a"}',
      ) as ChatStreamError;
      expect(error.partial, isTrue);
      expect(error.retryable, isTrue);
    });

    test('credits carry a percentage and a level, and no token count at all', () {
      final parsed = ChatCredits.fromJson({
        'enabled': true,
        'levelName': 'Bhakta',
        'percent': 140,
        'exhausted': false,
        'limitedBy': 'wallet',
        'renewsAt': '2026-11-03T00:00:00.000Z',
        'canUpgrade': true,
        'tokens': 123456,
      });
      expect(parsed.percent, 100);
      expect(parsed.limitedBy, ChatLimitedBy.wallet);
      expect(parsed.toString(), isNot(contains('123456')));
    });
  });
}
