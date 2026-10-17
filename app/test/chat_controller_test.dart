// The chat controller, driven by a fake server that plays back a stream by
// hand: tokens accumulate, Stop keeps what arrived, an error after some text
// keeps it and offers Retry, a refusal before streaming becomes a screen state,
// and regenerating replaces the last answer.

import 'dart:async';

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

  ChatState read() => container.read(chatControllerProvider);

  /// The screen watches its controller, which is what keeps it alive; so does this.
  ChatController controller() {
    container.listen(chatControllerProvider, (_, _) {});
    return container.read(chatControllerProvider.notifier);
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
    final notifier = controller();
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
      final state = read();
      expect(state.loaded, isTrue);
      expect(state.conversation!.title, 'On the Gita');
      expect(state.messages.map((m) => m.content), ['What is dharma?', 'Dharma is duty.']);
    });

    test('a reader who has not said anything yet has no conversation', () async {
      final chat = controller();
      await chat.ready;
      final state = read();
      expect(state.loaded, isTrue);
      expect(state.conversation, isNull);
      expect(state.messages, isEmpty);
      expect(state.hasHistory, isFalse);
    });

    test('a failed load keeps its failure, and reload tries again', () async {
      fake.currentFailure = const ApiFailure(kind: FailureKind.network);
      final chat = controller();
      await chat.ready;
      expect(read().loaded, isFalse);
      expect(read().loadFailure, isNotNull);

      await chat.reload();
      expect(read().loaded, isTrue);
      expect(read().loadFailure, isNull);
    });
  });

  group('streaming', () {
    test('tokens accumulate in the answer, which is shown at once for the first one', () async {
      final chat = await existing();
      final sending = chat.send('Tell me more');
      await pumpEventQueue();

      // The question and an empty answer are on screen before the server speaks.
      expect(read().messages.map((m) => m.content), ['What is dharma?', 'Dharma is duty.', 'Tell me more', '']);
      expect(read().phase, ChatPhase.waiting);
      expect(read().awaitingFirstWord, isTrue);

      fake.push(meta(text: 'Tell me more'));
      fake.push(const ChatDelta('Hari'));
      await pumpEventQueue();
      expect(read().messages.last.content, 'Hari');
      expect(read().phase, ChatPhase.streaming);

      fake.push(const ChatDelta(' bol'));
      fake.push(const ChatDelta('!'));
      fake.push(done('Hari bol!'));
      await fake.finish();
      await sending;

      final state = read();
      expect(state.phase, ChatPhase.idle);
      expect(state.messages.last.content, 'Hari bol!');
      expect(state.messages.last.status, ChatMessageStatus.complete);
      expect(state.problem, isNull);
    });

    test('text is buffered: many deltas become few repaints', () async {
      final chat = await existing();
      final seen = <String>[];
      container.listen(chatControllerProvider, (_, next) => seen.add(next.messages.last.content));

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
      final key = read().messages.last.clientKey;

      fake.push(meta());
      fake.push(const ChatDelta('x'));
      await pumpEventQueue();
      expect(read().messages.last.clientKey, key);
      expect(read().messages.last.id, 'a1');

      fake.push(done('x'));
      await fake.finish();
      await sending;
      expect(read().messages.last.clientKey, key);
    });

    test('the sent question is replaced by the server\'s copy', () async {
      final chat = await existing();
      final sending = chat.send('hi');
      await pumpEventQueue();
      expect(read().messages[2].id, startsWith('local-'));

      fake.push(meta(user: 'u99'));
      fake.push(done('ok'));
      await fake.finish();
      await sending;
      expect(read().messages[2].id, 'u99');
      expect(read().messages[2].seq, 3);
    });

    test('compacting is shown until the first word', () async {
      final chat = await existing();
      final sending = chat.send('hi');
      await pumpEventQueue();
      fake.push(const ChatCompacting());
      await pumpEventQueue();
      expect(read().compacting, isTrue);

      fake.push(meta());
      fake.push(const ChatDelta('x'));
      await pumpEventQueue();
      expect(read().compacting, isFalse);

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

    test('the conversation is made on the server when the first message is sent', () async {
      final chat = controller();
      await chat.ready;
      final sending = chat.send('Namaste');
      await pumpEventQueue();
      expect(fake.calls, ['create', 'send:c1:Namaste']);
      expect(read().conversation!.id, 'c1');

      fake.push(meta(text: 'Namaste'));
      fake.push(done('Hari Bol'));
      await fake.finish();
      await sending;
      expect(read().messages.map((m) => m.content), ['Namaste', 'Hari Bol']);
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

      final state = read();
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
      expect(read().messages.last.content, 'one two');
    });

    test('before any word arrives the empty answer is removed', () async {
      final chat = await existing();
      final sending = chat.send('hi');
      await pumpEventQueue();
      fake.push(meta());
      await pumpEventQueue();

      await chat.stop();
      await sending;
      expect(read().messages.map((m) => m.content), ['What is dharma?', 'Dharma is duty.', 'hi']);
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
      expect(read().messages.last.content, 'kept');
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

      final state = read();
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
      expect(read().problem, isNull);
      expect(read().messages.last.content, '');

      fake.push(meta(regenerate: true));
      fake.push(const ChatDelta('The whole answer.'));
      fake.push(done('The whole answer.'));
      await fake.finish();
      await retrying;
      expect(read().messages.map((m) => m.content), ['What is dharma?', 'Dharma is duty.', 'hi', 'The whole answer.']);
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

      expect(read().messages.last.content, 'part');
      expect(read().problem!.issue, ChatIssue.connectionLost);
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
      expect(read().messages.last.content, 'some');
      expect(read().problem!.issue, ChatIssue.replyFailed);
      expect(read().problem!.canRetry, isTrue);

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
      expect(read().messages.last.content, 'hi');
    });

    test('a network failure before the server saw the question hands the text back', () async {
      final chat = await existing();
      fake.refuseNext(const ApiFailure(kind: FailureKind.network));
      await chat.send('my question');

      final state = read();
      expect(state.messages.map((m) => m.content), ['What is dharma?', 'Dharma is duty.']);
      expect(state.restoredDraft, 'my question');
      expect(state.problem!.issue, ChatIssue.offline);
      expect(state.problem!.canRetry, isFalse);

      chat.draftRestored();
      expect(read().restoredDraft, isNull);
    });

    test('a call that timed out before the server saw the question says so, and hands the text back', () async {
      final chat = await existing();
      fake.refuseNext(const ApiFailure(kind: FailureKind.timeout));
      await chat.send('my question');

      final state = read();
      expect(state.problem!.issue, ChatIssue.timedOut);
      expect(state.problem!.canRetry, isFalse);
      expect(state.restoredDraft, 'my question');
    });

    test('a server fault before the stream is "not available", never the server\'s own words', () async {
      final chat = await existing();
      fake.refuseNext(const ApiFailure(
        kind: FailureKind.server,
        statusCode: 500,
        message: 'PrismaClientKnownRequestError: connect ECONNREFUSED 10.0.0.5:5432',
      ));
      await chat.send('my question');

      final state = read();
      expect(state.problem!.issue, ChatIssue.unavailable);
      expect(state.problem!.failure, isNull);
      expect(state.restoredDraft, 'my question');
    });

    test('a rate limit is "busy right now", and the question comes back', () async {
      final chat = await existing();
      fake.refuseNext(const ApiFailure(kind: FailureKind.rateLimited, statusCode: 429));
      await chat.send('my question');

      expect(read().problem!.issue, ChatIssue.overloaded);
      expect(read().restoredDraft, 'my question');
    });

    test('a fault of the app\'s own is a plain "something went wrong", not a lost connection', () async {
      final chat = await existing();
      final sending = chat.send('hi');
      await pumpEventQueue();
      fake.live!.addError(StateError('type \'_ControllerStream<Uint8List>\' is not a subtype'));
      await sending;

      final state = read();
      expect(state.phase, ChatPhase.idle);
      expect(state.problem!.issue, ChatIssue.failed);
      expect(state.problem!.failure!.kind, FailureKind.unknown);
      expect(state.problem!.failure!.message, isEmpty);
      // The server never answered, so the question is the reader's to send again.
      expect(state.restoredDraft, 'hi');
    });

    test('a fault after some text keeps it and offers Retry', () async {
      final chat = await existing();
      final sending = chat.send('hi');
      await pumpEventQueue();
      fake.push(meta());
      fake.push(const ChatDelta('Half an answ'));
      await pumpEventQueue();
      fake.live!.addError(const FormatException('Unexpected character'));
      await sending;

      final state = read();
      expect(state.messages.last.content, 'Half an answ');
      expect(state.problem!.issue, ChatIssue.failed);
      expect(state.problem!.canRetry, isTrue);
    });

    test('a provider that is busy is "busy right now" and can be asked again', () async {
      final chat = await existing();
      final sending = chat.send('hi');
      await pumpEventQueue();
      fake.push(meta());
      fake.push(const ChatStreamError(
        code: 'AI_BUSY',
        message: '503 UNAVAILABLE: the model gemini-2.0-flash is overloaded',
        retryable: true,
        partial: false,
        messageId: null,
        details: null,
      ));
      await sending;

      final problem = read().problem!;
      expect(problem.issue, ChatIssue.overloaded);
      expect(problem.canRetry, isTrue);
      expect(problem.failure, isNull);
    });

    for (final code in ['AI_UNAVAILABLE', 'AI_MISCONFIGURED', 'AI_BUDGET_EXHAUSTED']) {
      test('$code is "not available", and the key or model it names is not shown', () async {
        final chat = await existing();
        final sending = chat.send('hi');
        await pumpEventQueue();
        fake.push(meta());
        fake.push(ChatStreamError(
          code: code,
          message: 'OPENAI_API_KEY is not set',
          retryable: false,
          partial: false,
          messageId: null,
          details: null,
        ));
        await sending;

        expect(read().problem!.issue, ChatIssue.unavailable);
        expect(read().problem!.canRetry, isFalse);
        expect(read().problem!.failure, isNull);
      });
    }

    test('a code the app does not know is a plain failure that never carries the server\'s text', () async {
      final chat = await existing();
      final sending = chat.send('hi');
      await pumpEventQueue();
      fake.push(meta());
      fake.push(const ChatStreamError(
        code: 'SOMETHING_NEW',
        message: 'internal: could not write to table "ChatMessage"',
        retryable: true,
        partial: false,
        messageId: null,
        details: null,
      ));
      await sending;

      final problem = read().problem!;
      expect(problem.issue, ChatIssue.failed);
      expect(problem.failure!.message, isEmpty);
      expect(problem.canRetry, isTrue);
    });

    test('an error event that is not retryable offers no Retry', () async {
      final chat = await existing();
      final sending = chat.send('hi');
      await pumpEventQueue();
      fake.push(meta());
      fake.push(const ChatStreamError(
        code: 'AI_FAILED',
        message: 'x',
        retryable: false,
        partial: false,
        messageId: null,
        details: null,
      ));
      await sending;

      expect(read().problem!.issue, ChatIssue.replyFailed);
      expect(read().problem!.canRetry, isFalse);
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

      final problem = read().problem!;
      expect(problem.issue, ChatIssue.creditsExhausted);
      expect(problem.limitedBy, ChatLimitedBy.daily);
      expect(problem.canUpgrade, isTrue);
      expect(problem.startNewChat, isFalse);
      expect(problem.resetsAt, isNotNull);
      expect(read().restoredDraft, 'one more');
      expect(read().messages, hasLength(2));
      expect(read().phase, ChatPhase.idle);
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
      expect(read().problem!.startNewChat, isTrue);
      expect(read().problem!.canUpgrade, isFalse);
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
      expect(read().problem!.issue, ChatIssue.notAvailable);
      expect(read().problem!.canUpgrade, isTrue);
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
      expect(read().problem!.issue, ChatIssue.conversationFull);
      expect(read().isFull, isTrue);
      expect(read().canSend, isFalse);
    });

    test('409 for a reply already in progress is "busy"', () async {
      final chat = await existing();
      fake.refuseNext(const ApiFailure(kind: FailureKind.conflict, statusCode: 409, code: 'CONFLICT'));
      await chat.send('x');
      expect(read().problem!.issue, ChatIssue.busy);
    });

    test('400 MESSAGE_TOO_LONG', () async {
      final chat = await existing();
      fake.refuseNext(const ApiFailure(kind: FailureKind.validation, statusCode: 400, code: 'MESSAGE_TOO_LONG'));
      await chat.send('x');
      expect(read().problem!.issue, ChatIssue.tooLong);
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
      expect(read().problem!.issue, ChatIssue.creditsExhausted);
      expect(read().restoredDraft, 'x');
    });
  });

  group('regenerate', () {
    test('replaces the last answer with a new one', () async {
      final chat = await existing();
      final regenerating = chat.regenerate();
      await pumpEventQueue();

      expect(fake.calls.last, 'regenerate:c1');
      expect(read().messages.map((m) => m.content), ['What is dharma?', '']);

      fake.push(meta(regenerate: true));
      fake.push(const ChatDelta('Dharma is what upholds.'));
      fake.push(done('Dharma is what upholds.'));
      await fake.finish();
      await regenerating;

      expect(read().messages.map((m) => m.content), ['What is dharma?', 'Dharma is what upholds.']);
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
      expect(read().problem!.issue, ChatIssue.creditsExhausted);
      expect(read().messages.map((m) => m.content), ['What is dharma?']);
      expect(read().restoredDraft, isNull);
    });

    test('does nothing in a chat with no question to answer', () async {
      final chat = await existing(messages: const []);
      await chat.regenerate();
      expect(fake.calls, isEmpty);
    });
  });

  group('the rest', () {
    test('a full chat continues in a new one', () async {
      final chat = await existing(chat: fakeConversation(id: 'c1', limitReached: ChatLimitReached.messages));
      expect(read().isFull, isTrue);
      final next = await chat.startNewChat();
      expect(next!.conversation.id, 'c2');
      expect(next.carriedEverything, isTrue);
      expect(read().working, isFalse);
      // Sakha keeps the summary; the screen starts empty, in the new chat.
      expect(read().conversation!.id, 'c2');
      expect(read().messages, isEmpty);
      expect(read().isFull, isFalse);
    });
  });

  group('clearing the chat', () {
    test('removes the conversation and what is on screen', () async {
      final chat = await existing();
      expect(read().hasHistory, isTrue);

      await chat.clear();
      expect(fake.calls, contains('clear'));
      final state = read();
      expect(state.conversation, isNull);
      expect(state.messages, isEmpty);
      expect(state.hasHistory, isFalse);
      expect(state.working, isFalse);
      expect(state.loaded, isTrue);
    });

    test('the next question starts a fresh conversation on the server', () async {
      final chat = await existing();
      await chat.clear();
      fake.calls.clear();

      final sending = chat.send('Namaste again');
      await pumpEventQueue();
      expect(fake.calls, ['create', 'send:c1:Namaste again']);

      fake.push(meta(text: 'Namaste again'));
      fake.push(done('Hari Bol'));
      await fake.finish();
      await sending;
      expect(read().messages.map((m) => m.content), ['Namaste again', 'Hari Bol']);
    });

    test('a failure leaves the chat as it was and is thrown for the screen to word', () async {
      final chat = await existing();
      fake.clearFailure = const ApiFailure(kind: FailureKind.network);

      await expectLater(chat.clear(), throwsA(isA<ApiFailure>()));
      final state = read();
      expect(state.working, isFalse);
      expect(state.messages, hasLength(2));
      expect(state.conversation, isNotNull);
    });

    test('is ignored while a reply is being written', () async {
      final chat = await existing();
      final sending = chat.send('hi');
      await pumpEventQueue();

      await chat.clear();
      expect(fake.calls, isNot(contains('clear')));

      fake.push(meta());
      fake.push(done('ok'));
      await fake.finish();
      await sending;
    });

    test('takes a picture waiting in the box with it', () async {
      final chat = await existing();
      await chat.attachImage('/photos/lamp.jpg');
      await pumpEventQueue();
      expect(read().draftImage, isNotNull);

      await chat.clear();
      expect(read().draftImage, isNull);
    });
  });

  group('the notice above the box', () {
    test('is sent away when the reader closes it', () async {
      final chat = await existing();
      fake.refuseNext(const ApiFailure(kind: FailureKind.network));
      await chat.send('hi');
      expect(read().problem, isNotNull);

      chat.dismissProblem();
      expect(read().problem, isNull);
    });

    test('closing it when there is none changes nothing', () async {
      final chat = await existing();
      final before = read();
      chat.dismissProblem();
      expect(identical(read(), before), isTrue);
    });
  });

  group('pictures', () {
    test('a chosen picture goes up at once and is ready when the server has it', () async {
      final chat = await existing();
      final gate = fake.uploadGate = Completer<ChatUploadedImage>();

      final attaching = chat.attachImage('/photos/lamp.jpg');
      await pumpEventQueue();
      expect(read().draftImage!.uploading, isTrue);
      expect(read().draftImage!.path, '/photos/lamp.jpg');

      gate.complete(const ChatUploadedImage(key: 'k-lamp', url: 'https://files.test/lamp'));
      await attaching;
      expect(read().draftImage!.ready, isTrue);
      expect(read().draftImage!.key, 'k-lamp');
    });

    test('the question goes with the picture, and the picture shows in it at once', () async {
      final chat = await existing();
      await chat.attachImage('/photos/lamp.jpg');
      final sending = chat.send('What is this lamp?');
      await pumpEventQueue();

      expect(fake.calls.last, 'send:c1:What is this lamp?:image=key:lamp.jpg');
      final question = read().messages[read().messages.length - 2];
      expect(question.content, 'What is this lamp?');
      expect(question.localImagePath, '/photos/lamp.jpg');
      expect(read().draftImage, isNull);

      fake.push(meta(text: 'What is this lamp?'));
      fake.push(done('A diya.'));
      await fake.finish();
      await sending;
    });

    test('a picture alone is a question', () async {
      final chat = await existing();
      await chat.attachImage('/photos/lamp.jpg');
      final sending = chat.send('   ');
      await pumpEventQueue();
      expect(fake.calls.last, 'send:c1::image=key:lamp.jpg');

      fake.push(meta(text: ''));
      fake.push(done('A diya.'));
      await fake.finish();
      await sending;
    });

    test('nothing is sent while the picture is still going up', () async {
      final chat = await existing();
      fake.uploadGate = Completer<ChatUploadedImage>();
      chat.attachImage('/photos/lamp.jpg');
      await pumpEventQueue();

      await chat.send('hurry');
      expect(fake.calls.where((c) => c.startsWith('send')), isEmpty);
      expect(read().draftImage!.uploading, isTrue);
    });

    test('an upload that never arrived can be tried again', () async {
      final chat = await existing();
      fake.uploadFailure = const ApiFailure(kind: FailureKind.network);
      await chat.attachImage('/photos/lamp.jpg');
      expect(read().draftImage!.problem, ChatImageProblem.couldNotUpload);
      expect(read().draftImage!.canRetry, isTrue);

      await chat.retryImage();
      expect(read().draftImage!.ready, isTrue);
    });

    test('a picture the server cannot use is not offered a retry', () async {
      final chat = await existing();
      fake.uploadFailure = const ApiFailure(kind: FailureKind.unknown, statusCode: 400);
      await chat.attachImage('/photos/notes.txt');
      expect(read().draftImage!.problem, ChatImageProblem.notUsable);
      expect(read().draftImage!.canRetry, isFalse);

      await chat.retryImage();
      expect(fake.calls.where((c) => c.startsWith('upload')), hasLength(1));
    });

    test('a plan without pictures says so', () async {
      final chat = await existing();
      fake.uploadFailure = const ApiFailure(kind: FailureKind.unknown, statusCode: 403);
      await chat.attachImage('/photos/lamp.jpg');
      expect(read().draftImage!.problem, ChatImageProblem.notAvailable);
    });

    test('taking it out while it goes up drops the late answer', () async {
      final chat = await existing();
      final gate = fake.uploadGate = Completer<ChatUploadedImage>();
      final attaching = chat.attachImage('/photos/lamp.jpg');
      await pumpEventQueue();

      chat.removeImage();
      expect(read().draftImage, isNull);

      gate.complete(const ChatUploadedImage(key: 'late', url: 'https://files.test/late'));
      await attaching;
      expect(read().draftImage, isNull);
    });

    test('choosing another replaces the first', () async {
      final chat = await existing();
      await chat.attachImage('/photos/one.jpg');
      await chat.attachImage('/photos/two.jpg');
      expect(read().draftImage!.path, '/photos/two.jpg');
      expect(read().draftImage!.key, 'key:two.jpg');
    });

    test('is not taken while a reply is being written', () async {
      final chat = await existing();
      final sending = chat.send('hi');
      await pumpEventQueue();

      await chat.attachImage('/photos/lamp.jpg');
      expect(read().draftImage, isNull);

      fake.push(meta());
      fake.push(done('ok'));
      await fake.finish();
      await sending;
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
