// The whole Ask Sakha screen against a fake server: one conversation with no
// list in front of it, the credit meter on the app bar's line, suggestions on
// an empty chat and quick replies under an answer, Clear chat, a picture added
// from the phone and a question spoken instead of typed.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/navigation/app_navigator.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/api_failure.dart';
import 'package:hariharibol/models/app_user.dart';
import 'package:hariharibol/models/chat.dart';
import 'package:hariharibol/providers/chat_provider.dart';
import 'package:hariharibol/providers/language_chain_provider.dart';
import 'package:hariharibol/providers/session_provider.dart';
import 'package:hariharibol/services/chat_image_picker.dart';
import 'package:hariharibol/services/speech_input.dart';
import 'package:hariharibol/views/chat/chat_view.dart';
import 'package:hariharibol/widgets/chat/chat_message_list.dart';

import 'support/fake_chat_device.dart';
import 'support/fake_chat_service.dart';

void main() {
  late FakeChatService fake;
  late FakeChatImagePicker picker;
  late FakeSpeechInput speech;

  Future<void> open(WidgetTester tester, {List<Override> overrides = const []}) async {
    tester.view.physicalSize = const Size(400 * 3, 800 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(ProviderScope(
      overrides: [
        chatServiceProvider.overrideWithValue(fake),
        chatImagePickerProvider.overrideWithValue(picker),
        speechInputProvider.overrideWithValue(speech),
        // The empty chat greets in the reading language, which needs the store.
        readingChainProvider.overrideWithValue(const ['en']),
        ...overrides,
      ],
      child: MaterialApp(
        navigatorKey: AppNavigator.instance.rootKey,
        scaffoldMessengerKey: AppNavigator.instance.messengerKey,
        theme: AppTheme.light,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: const ChatView(),
      ),
    ));
    await tester.pump();
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
  }

  /// Typing swaps the microphone for Send with a short cross-fade; wait it out
  /// so a tap lands on the button that is there, not the one leaving.
  Future<void> typeIn(WidgetTester tester, String words) async {
    await tester.enterText(find.byType(TextField), words);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
  }

  Future<void> settle(WidgetTester tester) async {
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
  }

  ChatMeta meta(String text, {String user = 'u2', String answer = 'a2'}) => ChatMeta(
        conversation: fakeConversation(id: 'c1', title: 'On the Gita'),
        userMessage: serverMessage(user, ChatRole.user, text, seq: 3),
        assistantMessageId: answer,
      );

  ChatDone done(String text, {String answer = 'a2', int percent = 60}) => ChatDone(
        message: serverMessage(answer, ChatRole.assistant, text, seq: 4),
        conversation: fakeConversation(id: 'c1', title: 'On the Gita'),
        credits: fakeCredits(percent: percent),
      );

  setUp(() {
    picker = FakeChatImagePicker();
    speech = FakeSpeechInput();
    fake = FakeChatService()
      ..detail = ChatConversationDetail(
        conversation: fakeConversation(id: 'c1', title: 'On the Gita'),
        messages: [
          serverMessage('m1', ChatRole.user, 'What is dharma?', seq: 1),
          serverMessage('m2', ChatRole.assistant, 'Dharma is **duty**.', seq: 2),
        ],
      );
  });

  tearDown(() {
    AppNavigator.instance.messengerKey.currentState?.clearSnackBars();
  });

  group('opening', () {
    testWidgets('goes straight to the conversation: its messages and the box, no list', (tester) async {
      await open(tester);

      expect(find.text('Ask Sakha'), findsOneWidget);
      expect(find.text('What is dharma?'), findsOneWidget);
      expect(find.textContaining('duty', findRichText: true), findsOneWidget);
      expect(find.byType(TextField), findsOneWidget);
      // The conversation has no name of its own to show.
      expect(find.text('On the Gita'), findsNothing);
      // The last answer can be asked for again.
      expect(find.byTooltip('Answer again'), findsOneWidget);
    });

    testWidgets('the credit meter is on the same line as the title, not under the app bar', (tester) async {
      await open(tester);

      expect(tester.widget<AppBar>(find.byType(AppBar)).bottom, isNull);
      final bar = tester.getRect(find.byType(AppBar));
      final title = tester.getCenter(find.text('Ask Sakha'));
      final meter = tester.getCenter(find.text('80% left'));

      expect(bar.contains(title), isTrue);
      expect(bar.contains(meter), isTrue);
      expect((title.dy - meter.dy).abs(), lessThan(kToolbarHeight / 2));
      // And it is not squeezed out of the line: it is to the title's right.
      expect(meter.dx, greaterThan(title.dx));
    });

    testWidgets('a reader with nothing said yet is welcomed by Sakha, with suggestions', (tester) async {
      fake.detail = null;
      await open(tester);

      expect(find.text('Your friend Sakha'), findsOneWidget);
      // No name on the account, so the greeting is just the devotional line.
      expect(find.text('Hari Bol, how is your heart today?'), findsOneWidget);
      expect(find.text('Answers from the Sri Vaishnava tradition.'), findsOneWidget);
      expect(find.text('Try asking'), findsOneWidget);
      expect(find.text('A verse to live by'), findsOneWidget);
      // Nothing to clear yet.
      expect(find.byTooltip('Clear chat'), findsNothing);
    });

    testWidgets('an empty chat greets the reader by the first name they gave, never by their email', (tester) async {
      fake.detail = null;
      final asha = AppUser.fromJson({'id': 'usr_1', 'email': 'asha42@smoke.test', 'name': 'Asha Devi'});
      await open(tester, overrides: [currentUserProvider.overrideWith(() => _FixedUser(asha))]);

      expect(find.text('Hari Bol Asha, how is your heart today?'), findsOneWidget);
      expect(find.textContaining('asha42'), findsNothing);
    });

    testWidgets('what Sakha has noticed is not shown on the chat page', (tester) async {
      await open(tester);

      expect(find.byTooltip('What Sakha has noticed'), findsNothing);
    });

    testWidgets('a failed load shows the error and Try again fetches the conversation', (tester) async {
      fake.currentFailure = const ApiFailure(kind: FailureKind.network);
      await open(tester);
      expect(find.byType(TextField), findsNothing);

      await tester.tap(find.widgetWithText(OutlinedButton, 'Try again'));
      await settle(tester);
      expect(find.text('What is dharma?'), findsOneWidget);
    });
  });

  group('suggestions', () {
    testWidgets('tapping a card asks its question at once', (tester) async {
      fake.detail = null;
      await open(tester);

      await tester.tap(find.text('A verse to live by'));
      await tester.pump();
      await tester.pump();

      expect(fake.calls, hasLength(2));
      expect(fake.calls.first, 'create');
      expect(fake.calls.last, startsWith('send:c1:Explain Bhagavad Gita 2.47'));
      // The welcome gives way to the conversation.
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Your friend Sakha'), findsNothing);
      expect(find.textContaining('Explain Bhagavad Gita 2.47', findRichText: true), findsOneWidget);

      fake.push(meta('Explain'));
      fake.push(done('It is about duty.'));
      await fake.finish();
      await settle(tester);
    });

    testWidgets('the cards are shown but do nothing when credits are out', (tester) async {
      fake.detail = null;
      fake.statusValue = ChatStatus(
        description: '',
        credits: fakeCredits(percent: 0, exhausted: true, limitedBy: ChatLimitedBy.daily),
        maxInputChars: 500,
        maxMessages: 40,
      );
      await open(tester);

      await tester.tap(find.text('A verse to live by'), warnIfMissed: false);
      await tester.pump();
      expect(fake.calls, isEmpty);
    });
  });

  group('quick replies', () {
    testWidgets('appear under a finished answer and send their words when tapped', (tester) async {
      await open(tester);
      expect(find.text('Explain simply'), findsOneWidget);
      expect(find.text('Give an example'), findsOneWidget);

      await tester.tap(find.text('Give an example'));
      await tester.pump();
      await tester.pump();
      expect(fake.calls.last, 'send:c1:Give an example');

      // Not while the next answer is being written.
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Explain simply'), findsNothing);

      fake.push(meta('Give an example'));
      fake.push(done('Like this.'));
      await fake.finish();
      await settle(tester);
      expect(find.text('Explain simply'), findsOneWidget);
    });

    testWidgets('are not offered after an answer that was cut short', (tester) async {
      fake.detail = ChatConversationDetail(
        conversation: fakeConversation(id: 'c1'),
        messages: [
          serverMessage('m1', ChatRole.user, 'What is dharma?', seq: 1),
          serverMessage('m2', ChatRole.assistant, 'Dharma is', seq: 2, status: ChatMessageStatus.stopped),
        ],
      );
      await open(tester);
      expect(find.text('Stopped'), findsOneWidget);
      expect(find.text('Explain simply'), findsNothing);
    });
  });

  group('sending', () {
    testWidgets('streams the answer; the button becomes Stop, then Send again', (tester) async {
      await open(tester);

      await typeIn(tester, 'Tell me more');
      await tester.tap(find.byTooltip('Send'));
      await tester.pump();

      expect(find.text('Tell me more'), findsOneWidget);
      expect(find.byTooltip('Stop'), findsOneWidget);
      // The box was emptied the moment the question went.
      expect(tester.widget<TextField>(find.byType(TextField)).controller!.text, isEmpty);

      fake.push(meta('Tell me more'));
      fake.push(const ChatDelta('Hari '));
      fake.push(const ChatDelta('bol'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.textContaining('Hari bol', findRichText: true), findsOneWidget);

      fake.push(done('Hari bol'));
      await fake.finish();
      await settle(tester);

      expect(find.byTooltip('Send'), findsNothing); // an empty box offers the microphone
      expect(find.byTooltip('Speak your question'), findsOneWidget);
      expect(find.text('60% left'), findsOneWidget);
    });

    testWidgets('a refused question comes back into the box with the exhausted card above it', (tester) async {
      await open(tester);
      fake.refuseNext(const ApiFailure(
        kind: FailureKind.unknown,
        statusCode: 402,
        code: 'CREDITS_EXHAUSTED',
        details: {'limitedBy': 'wallet', 'canUpgrade': true},
      ));
      await typeIn(tester, 'one more please');
      await tester.tap(find.byTooltip('Send'));
      await tester.pump();
      await tester.pump();

      expect(find.text('Your credits have run out'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Upgrade'), findsOneWidget);
      // The question was not lost.
      expect(tester.widget<TextField>(find.byType(TextField)).controller!.text, 'one more please');
      // And nothing can be sent until the credits are back.
      expect(tester.widget<TextField>(find.byType(TextField)).enabled, isFalse);
    });

    testWidgets('credits already out show the card and a box that cannot be used', (tester) async {
      fake.statusValue = ChatStatus(
        description: '',
        credits: fakeCredits(percent: 0, exhausted: true, limitedBy: ChatLimitedBy.daily),
        maxInputChars: 500,
        maxMessages: 40,
      );
      await open(tester);

      expect(find.text('You have used today\'s credits'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Upgrade'), findsOneWidget);
      expect(tester.widget<TextField>(find.byType(TextField)).enabled, isFalse);
      // Quick replies would only lead to the same wall.
      expect(find.text('Explain simply'), findsNothing);
    });

    testWidgets('a plan without chat says so', (tester) async {
      fake.statusValue = ChatStatus(
        description: '',
        credits: fakeCredits(percent: 0, enabled: false, exhausted: true),
        maxInputChars: 500,
        maxMessages: 40,
      );
      await open(tester);
      expect(find.text('Chat is not part of your plan'), findsOneWidget);
    });

    testWidgets('a dropped connection shows what arrived and a notice with Try again', (tester) async {
      await open(tester);
      await typeIn(tester, 'hello');
      await tester.tap(find.byTooltip('Send'));
      await tester.pump();

      fake.push(meta('hello'));
      fake.push(const ChatDelta('The beginning'));
      await tester.pump();
      // An error on a stream needs a real turn of the event loop to arrive.
      await tester.runAsync(() async {
        fake.drop();
        await pumpEventQueue();
      });
      await settle(tester);

      expect(find.textContaining('The beginning', findRichText: true), findsOneWidget);
      expect(find.text('The connection was interrupted. Please try again.'), findsOneWidget);
      expect(find.text('Interrupted'), findsOneWidget);
      expect(find.widgetWithText(TextButton, 'Try again'), findsOneWidget);
    });

    testWidgets('the notice can be closed', (tester) async {
      await open(tester);
      fake.refuseNext(const ApiFailure(kind: FailureKind.network));
      await typeIn(tester, 'hello');
      await tester.tap(find.byTooltip('Send'));
      await settle(tester);
      expect(find.text('No connection. Check your internet and try again.'), findsOneWidget);

      await tester.tap(find.byTooltip('Close'));
      await settle(tester);
      expect(find.text('No connection. Check your internet and try again.'), findsNothing);
    });

    testWidgets('a full chat swaps the box for Start a new chat, which opens an empty one', (tester) async {
      fake.detail = ChatConversationDetail(
        conversation: fakeConversation(id: 'c1', limitReached: ChatLimitReached.messages),
        messages: [serverMessage('m1', ChatRole.user, 'hi', seq: 1)],
      );
      await open(tester);

      expect(find.text('This chat has grown long'), findsOneWidget);
      expect(find.byType(TextField), findsNothing);

      await tester.tap(find.widgetWithText(FilledButton, 'Start a new chat'));
      await settle(tester);

      expect(fake.calls, contains('continue:c1'));
      expect(find.byType(TextField), findsOneWidget);
      expect(find.text('Your friend Sakha'), findsOneWidget);
      expect(find.text('hi'), findsNothing);
    });
  });

  group('clearing the chat', () {
    testWidgets('asks first, then removes everything and says so', (tester) async {
      await open(tester);

      await tester.tap(find.byTooltip('Clear chat'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('Clear this chat?'), findsOneWidget);
      expect(find.textContaining('will not remember'), findsOneWidget);

      await tester.tap(find.widgetWithText(FilledButton, 'Clear'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(fake.calls, contains('clear'));
      expect(find.text('What is dharma?'), findsNothing);
      expect(find.text('Your friend Sakha'), findsOneWidget);
      expect(find.text('Chat cleared'), findsOneWidget);
      expect(find.byTooltip('Clear chat'), findsNothing);
      await settle(tester);
    });

    testWidgets('backing out clears nothing', (tester) async {
      await open(tester);

      await tester.tap(find.byTooltip('Clear chat'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(fake.calls, isNot(contains('clear')));
      expect(find.text('What is dharma?'), findsOneWidget);
    });

    testWidgets('a failure keeps the chat and says what happened in the app\'s own words', (tester) async {
      await open(tester);
      fake.clearFailure = const ApiFailure(kind: FailureKind.network);

      await tester.tap(find.byTooltip('Clear chat'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      await tester.tap(find.widgetWithText(FilledButton, 'Clear'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(find.text('What is dharma?'), findsOneWidget);
      expect(find.text('No connection. Check your internet and try again.'), findsOneWidget);
    });

    testWidgets('cannot be pressed while a reply is being written', (tester) async {
      await open(tester);
      await typeIn(tester, 'hi');
      await tester.tap(find.byTooltip('Send'));
      await tester.pump();

      final button = tester.widget<IconButton>(find.widgetWithIcon(IconButton, Icons.delete_sweep_outlined));
      expect(button.onPressed, isNull);

      fake.push(meta('hi'));
      fake.push(done('ok'));
      await fake.finish();
      await settle(tester);
    });
  });

  group('pictures', () {
    Future<void> choose(WidgetTester tester, String label) async {
      await tester.tap(find.byTooltip('Add a picture'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      await tester.tap(find.text(label));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
    }

    testWidgets('a photo from the library waits in the box and goes with the question', (tester) async {
      await open(tester);
      picker.next = '/photos/lamp.jpg';

      await choose(tester, 'Choose from your photos');
      expect(picker.asked, [PictureSource.gallery]);
      expect(fake.calls, contains('upload:/photos/lamp.jpg'));
      expect(find.byTooltip('Remove picture'), findsOneWidget);

      // A picture alone is enough to send.
      await tester.tap(find.byTooltip('Send'));
      await tester.pump();
      await tester.pump();
      expect(fake.calls.last, 'send:c1::image=key:lamp.jpg');
      expect(find.byTooltip('Remove picture'), findsNothing);
      // It now sits in the question's bubble.
      expect(find.bySemanticsLabel('Picture you sent'), findsOneWidget);

      fake.push(meta(''));
      fake.push(done('A diya.'));
      await fake.finish();
      await settle(tester);
    });

    testWidgets('the camera is asked for when the reader chooses it', (tester) async {
      await open(tester);
      picker.next = '/photos/new.jpg';
      await choose(tester, 'Take a photo');
      expect(picker.asked, [PictureSource.camera]);
    });

    testWidgets('backing out of the camera leaves the box as it was', (tester) async {
      await open(tester);
      picker.next = null;
      await choose(tester, 'Take a photo');
      expect(fake.calls, isNot(contains(startsWith('upload'))));
      expect(find.byTooltip('Remove picture'), findsNothing);
    });

    testWidgets('a refused permission points to the phone\'s Settings', (tester) async {
      await open(tester);
      picker.failure = const PictureAccessDenied(PictureSource.camera);
      await choose(tester, 'Take a photo');

      expect(find.textContaining('in your phone\'s Settings to add a picture'), findsOneWidget);
      expect(find.byTooltip('Remove picture'), findsNothing);
    });

    testWidgets('the picture can be taken out again', (tester) async {
      await open(tester);
      picker.next = '/photos/lamp.jpg';
      await choose(tester, 'Choose from your photos');

      await tester.tap(find.byTooltip('Remove picture'));
      await settle(tester);
      expect(find.byTooltip('Remove picture'), findsNothing);
      // Back to the microphone: there is nothing to send.
      expect(find.byTooltip('Send'), findsNothing);
    });

    testWidgets('an upload that failed says so and a tap tries again', (tester) async {
      await open(tester);
      picker.next = '/photos/lamp.jpg';
      fake.uploadFailure = const ApiFailure(kind: FailureKind.network);
      await choose(tester, 'Choose from your photos');

      expect(find.text('The picture could not be added. Tap to try again.'), findsOneWidget);
      // Nothing can be sent with a picture that is not there.
      expect(find.byTooltip('Send'), findsNothing);

      await tester.tap(find.text('The picture could not be added. Tap to try again.'));
      await settle(tester);
      expect(find.text('The picture could not be added. Tap to try again.'), findsNothing);
      expect(find.byTooltip('Send'), findsOneWidget);
    });

    testWidgets('a picture the server cannot use asks for another, with no retry', (tester) async {
      await open(tester);
      picker.next = '/photos/notes.pdf';
      fake.uploadFailure = const ApiFailure(kind: FailureKind.unknown, statusCode: 400);
      await choose(tester, 'Choose from your photos');

      expect(find.text('That picture cannot be used. Please choose another.'), findsOneWidget);
    });
  });

  group('speaking', () {
    testWidgets('the words go into the box as they are heard, and nothing is sent by itself', (tester) async {
      await open(tester);

      await tester.tap(find.byTooltip('Speak your question'));
      await tester.pump();
      expect(speech.started, ['en']);
      expect(find.byTooltip('Stop listening'), findsOneWidget);
      expect(find.text('Listening…'), findsOneWidget);

      speech.hear('what is');
      speech.hear('what is japa');
      await tester.pump(const Duration(milliseconds: 300));
      expect(tester.widget<TextField>(find.byType(TextField)).controller!.text, 'what is japa');

      await tester.tap(find.byTooltip('Stop listening'));
      await settle(tester);
      expect(speech.stopped, isTrue);
      expect(fake.calls, isEmpty);
      // The reader reads it, then sends.
      expect(find.byTooltip('Send'), findsOneWidget);

      await tester.tap(find.byTooltip('Send'));
      await tester.pump();
      await tester.pump();
      expect(fake.calls.last, 'send:c1:what is japa');

      fake.push(meta('what is japa'));
      fake.push(done('Japa is chanting.'));
      await fake.finish();
      await settle(tester);
    });

    testWidgets('asking a quick reply while still listening closes the microphone', (tester) async {
      await open(tester);
      await tester.tap(find.byTooltip('Speak your question'));
      await tester.pump();
      speech.hear('hari bol');
      await tester.pump();
      expect(find.byTooltip('Stop listening'), findsOneWidget);

      // The box has no Send while it listens; anything else that asks a
      // question must still let the microphone go first.
      await tester.tap(find.text('Explain simply'));
      await tester.pump();
      await tester.pump();
      expect(speech.cancelled, isTrue);
      expect(find.byTooltip('Stop listening'), findsNothing);
      expect(fake.calls.last, 'send:c1:Explain simply');
      // What was heard but not sent is not left in the box.
      expect(tester.widget<TextField>(find.byType(TextField)).controller!.text, isEmpty);

      fake.push(meta('Explain simply'));
      fake.push(done('Simply put…'));
      await fake.finish();
      await settle(tester);
    });

    testWidgets('a refused microphone points to the phone\'s Settings', (tester) async {
      await open(tester);
      speech.result = SpeechStart.denied;
      await tester.tap(find.byTooltip('Speak your question'));
      await tester.pump();
      await tester.pump();

      expect(find.textContaining('microphone and speech recognition'), findsOneWidget);
      expect(find.byTooltip('Speak your question'), findsOneWidget);
    });

    testWidgets('a phone with no recogniser says so', (tester) async {
      await open(tester);
      speech.result = SpeechStart.unavailable;
      await tester.tap(find.byTooltip('Speak your question'));
      await tester.pump();
      await tester.pump();
      expect(find.text('Speaking is not available on this phone.'), findsOneWidget);
    });

    testWidgets('silence says nothing was heard; pressing stop at once does not', (tester) async {
      await open(tester);
      await tester.tap(find.byTooltip('Speak your question'));
      await tester.pump();
      speech.endBy(SpeechEnd.heardNothing);
      await tester.pump();
      await tester.pump();
      expect(find.text('Nothing was heard. Please try again.'), findsOneWidget);

      AppNavigator.instance.messengerKey.currentState!.clearSnackBars();
      await tester.pump(const Duration(seconds: 1));

      speech.endOnStop = SpeechEnd.heardNothing;
      await tester.tap(find.byTooltip('Speak your question'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      await tester.tap(find.byTooltip('Stop listening'));
      await settle(tester);
      expect(speech.stopped, isTrue);
      expect(find.text('Nothing was heard. Please try again.'), findsNothing);
    });

    testWidgets('a recogniser that gave up part-way says listening stopped', (tester) async {
      await open(tester);
      await tester.tap(find.byTooltip('Speak your question'));
      await tester.pump();
      speech.endBy(SpeechEnd.failed);
      await tester.pump();
      await tester.pump();
      expect(find.text('Listening stopped. Please try again.'), findsOneWidget);
    });
  });

  group('a long conversation', () {
    testWidgets('a button takes the reader back to the newest message after scrolling up', (tester) async {
      fake.detail = ChatConversationDetail(
        conversation: fakeConversation(id: 'c1'),
        messages: [
          for (var i = 0; i < 20; i++) ...[
            serverMessage('q$i', ChatRole.user, 'Question number $i about the verse', seq: i * 2 + 1),
            serverMessage('a$i', ChatRole.assistant, 'Answer number $i, which is a fairly long reply.', seq: i * 2 + 2),
          ],
        ],
      );
      await open(tester);
      Finder list() => find.descendant(of: find.byType(ChatMessageList), matching: find.byType(Scrollable)).first;
      double offset() => tester.state<ScrollableState>(list()).position.pixels;

      expect(offset(), 0);
      expect(_jumpShown(tester), isFalse);

      await tester.drag(list(), const Offset(0, 700));
      // One frame to start the slide, then time for it to run.
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      expect(offset(), greaterThan(240));
      expect(_jumpShown(tester), isTrue);

      await tester.tap(find.byTooltip('Latest'));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(seconds: 1));
      expect(offset(), 0);
      expect(_jumpShown(tester), isFalse);
      // Nothing was asked of Sakha on the way.
      expect(fake.calls, isEmpty);
    });
  });
}

/// Whether the "Latest" button is on the list: it waits just below the list's
/// bottom edge, faded out, and slides up over it when the reader has scrolled.
bool _jumpShown(WidgetTester tester) {
  final list = tester.getRect(find.byType(ChatMessageList));
  return list.contains(tester.getCenter(find.byTooltip('Latest')));
}

/// A signed-in reader, so the screen has a name to greet without the session.
class _FixedUser extends CurrentUser {
  _FixedUser(this._user);

  final AppUser? _user;

  @override
  AppUser? build() => _user;
}
