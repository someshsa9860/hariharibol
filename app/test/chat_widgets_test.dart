// What the chat draws: an answer's markdown (a table, a code block, a shloka in
// a block quote), the credit meter (a percentage, never a token count), the
// out-of-credits card, and the whole screen against a fake server.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/core/theme/app_typography.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/api_failure.dart';
import 'package:hariharibol/models/chat.dart';
import 'package:hariharibol/providers/chat_provider.dart';
import 'package:hariharibol/views/chat/chat_view.dart';
import 'package:hariharibol/widgets/chat/chat_credit_meter.dart';
import 'package:hariharibol/widgets/chat/chat_credits_card.dart';
import 'package:hariharibol/widgets/chat/chat_markdown.dart';
import 'package:hariharibol/widgets/chat/chat_message_bubble.dart';
import 'package:hariharibol/widgets/chat/shloka_card.dart';

import 'support/fake_chat_service.dart';

Widget app(Widget home, {ThemeData? theme, List<Override> overrides = const []}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      theme: theme ?? AppTheme.light,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: home),
    ),
  );
}

const _answer = '''
## Dharma

Here is **bold**, *italic* and a [link](https://example.com).

| Term | Meaning |
|---|---|
| Dharma | Duty |
| Karma | Action |

```dart
final japa = 108;
```

> कर्मण्येवाधिकारस्ते मा फलेषु कदाचन ।
> karmaṇy-evādhikāras te mā phaleṣu kadācana
>
> You have a right to your duty alone.

- one
- two
''';

String allText(WidgetTester tester) {
  final buffer = StringBuffer();
  for (final text in tester.widgetList<Text>(find.byType(Text))) {
    buffer.writeln(text.data ?? text.textSpan?.toPlainText() ?? '');
  }
  return buffer.toString();
}

void main() {
  group('an answer\'s markdown', () {
    for (final theme in {'light': AppTheme.light, 'dark': AppTheme.dark}.entries) {
      testWidgets('renders a table, a code block and a shloka without error (${theme.key})', (tester) async {
        await tester.pumpWidget(app(
          const SingleChildScrollView(child: ChatMarkdown(data: _answer)),
          theme: theme.value,
        ));
        await tester.pump();

        expect(tester.takeException(), isNull);
        expect(find.byType(Table), findsOneWidget);
        expect(find.textContaining('Dharma', findRichText: true), findsWidgets);
        expect(find.textContaining('final japa = 108;', findRichText: true), findsOneWidget);
        expect(find.byType(ShlokaCard), findsOneWidget);
        expect(find.text('कर्मण्येवाधिकारस्ते मा फलेषु कदाचन ।'), findsOneWidget);
      });
    }

    testWidgets('sets a shloka in the verse style, never the serif', (tester) async {
      await tester.pumpWidget(app(const SingleChildScrollView(child: ChatMarkdown(data: _answer))));
      await tester.pump();

      final devanagari = tester.widget<Text>(find.text('कर्मण्येवाधिकारस्ते मा फलेषु कदाचन ।'));
      expect(devanagari.style!.fontFamily, isNot(AppTypography.serif));
      expect(devanagari.style!.height, 1.9);

      // The Roman lines of the quote are the transliteration style.
      final roman = tester.widget<Text>(find.text('karmaṇy-evādhikāras te mā phaleṣu kadācana'));
      expect(roman.style!.fontStyle, FontStyle.italic);
    });

    testWidgets('headings are never the serif (it has no Devanagari)', (tester) async {
      await tester.pumpWidget(app(const ChatMarkdown(data: '# हरिः ॐ\n\n## Second')));
      await tester.pump();

      final headings = tester.widgetList<RichText>(find.byType(RichText)).map((r) => r.text.style?.fontFamily);
      expect(headings, isNot(contains(AppTypography.serif)));
    });

    testWidgets('text is selectable once the answer is complete, and not while it streams', (tester) async {
      await tester.pumpWidget(app(const ChatMarkdown(data: 'Hello **world**')));
      await tester.pump();
      expect(find.byType(SelectableText), findsWidgets);

      await tester.pumpWidget(app(const ChatMarkdown(data: 'Hello **world', streaming: true)));
      await tester.pump();
      expect(find.byType(SelectableText), findsNothing);
      // The half-written mark is closed, so no asterisks are on screen.
      expect(find.textContaining('*', findRichText: true), findsNothing);
      expect(find.textContaining('world', findRichText: true), findsOneWidget);
    });

    testWidgets('an unfinished code fence does not show raw backticks while streaming', (tester) async {
      await tester.pumpWidget(app(const ChatMarkdown(data: 'Run:\n\n```bash\nls -la', streaming: true)));
      await tester.pump();
      expect(tester.takeException(), isNull);
      expect(find.textContaining('`', findRichText: true), findsNothing);
      expect(find.textContaining('ls -la', findRichText: true), findsOneWidget);
    });

    testWidgets('an image that is not https is a note, not a fetch', (tester) async {
      await tester.pumpWidget(app(const ChatMarkdown(data: '![A diagram](http://example.com/a.png)')));
      await tester.pump();
      expect(tester.takeException(), isNull);
      expect(find.text('A diagram'), findsOneWidget);
      expect(find.byIcon(Icons.broken_image_outlined), findsOneWidget);
    });
  });

  group('the credit meter', () {
    testWidgets('shows a percentage, the level and the renewal day', (tester) async {
      await tester.pumpWidget(app(ChatCreditMeter(
        credits: fakeCredits(percent: 64, limitedBy: ChatLimitedBy.wallet),
      )));
      await tester.pump();

      expect(find.text('64% left · Sevak'), findsOneWidget);
      expect(find.text('Renews 3 Nov'), findsOneWidget);
      expect(tester.widget<LinearProgressIndicator>(find.byType(LinearProgressIndicator)).value, 0.64);
    });

    testWidgets('says when the daily allowance resets', (tester) async {
      await tester.pumpWidget(app(ChatCreditMeter(
        credits: fakeCredits(percent: 5, limitedBy: ChatLimitedBy.daily),
      )));
      await tester.pump();
      expect(find.text('Resets at midnight'), findsOneWidget);
    });

    testWidgets('never shows a token count, whatever the numbers behind it', (tester) async {
      await tester.pumpWidget(app(ChatCreditMeter(credits: fakeCredits(percent: 37, limitedBy: ChatLimitedBy.wallet))));
      await tester.pump();

      final text = allText(tester);
      expect(text.toLowerCase(), isNot(contains('token')));
      // Every number on it is a percentage or a day: three digits at most.
      expect(RegExp(r'\d{4,}').hasMatch(text), isFalse, reason: text);
    });
  });

  group('the out-of-credits card', () {
    testWidgets('offers Upgrade where a higher plan exists', (tester) async {
      var upgraded = 0;
      await tester.pumpWidget(app(ChatCreditsCard(
        kind: ChatCreditsKind.wallet,
        canUpgrade: true,
        onUpgrade: () => upgraded++,
      )));
      await tester.pump();

      expect(find.text('Your credits have run out'), findsOneWidget);
      await tester.tap(find.widgetWithText(FilledButton, 'Upgrade'));
      expect(upgraded, 1);
    });

    testWidgets('has no Upgrade when there is nothing higher to buy', (tester) async {
      await tester.pumpWidget(app(ChatCreditsCard(kind: ChatCreditsKind.daily, canUpgrade: false, onUpgrade: () {})));
      await tester.pump();
      expect(find.text('Upgrade'), findsNothing);
      expect(find.text('Resets at midnight'), findsOneWidget);
    });

    testWidgets('a chat that used its share offers a new chat', (tester) async {
      var started = 0;
      await tester.pumpWidget(app(ChatCreditsCard(
        kind: ChatCreditsKind.chatShare,
        canUpgrade: false,
        onUpgrade: () {},
        onStartNewChat: () => started++,
      )));
      await tester.pump();
      await tester.tap(find.text('Start a new chat'));
      expect(started, 1);
    });
  });

  group('a message', () {
    testWidgets('the reader\'s sits in a bubble, the assistant\'s is plain text with actions', (tester) async {
      await tester.pumpWidget(app(Column(children: [
        ChatMessageBubble(message: serverMessage('u', ChatRole.user, 'What is japa?')),
        ChatMessageBubble(message: serverMessage('a', ChatRole.assistant, 'Japa is **chanting**.'), onRegenerate: () {}),
      ])));
      await tester.pump();

      expect(find.text('What is japa?'), findsOneWidget);
      expect(find.byTooltip('Copy'), findsOneWidget);
      expect(find.byTooltip('Share'), findsOneWidget);
      expect(find.byTooltip('Regenerate'), findsOneWidget);
    });

    testWidgets('only the last answer is given Regenerate', (tester) async {
      await tester.pumpWidget(app(
        ChatMessageBubble(message: serverMessage('a', ChatRole.assistant, 'Older answer.')),
      ));
      await tester.pump();
      expect(find.byTooltip('Regenerate'), findsNothing);
    });

    testWidgets('a stopped reply says so in words', (tester) async {
      await tester.pumpWidget(app(ChatMessageBubble(
        message: serverMessage('a', ChatRole.assistant, 'Half', status: ChatMessageStatus.stopped),
      )));
      await tester.pump();
      expect(find.text('Stopped'), findsOneWidget);
    });

    testWidgets('while waiting for the first word it shows dots, and no actions', (tester) async {
      await tester.pumpWidget(app(ChatMessageBubble(
        message: ChatMessage.local(key: 'k', role: ChatRole.assistant),
        streaming: true,
        compacting: true,
      )));
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.bySemanticsLabel('The assistant is writing'), findsOneWidget);
      expect(find.text('Tidying our conversation…'), findsOneWidget);
      expect(find.byTooltip('Copy'), findsNothing);
    });
  });

  group('the chat screen', () {
    late FakeChatService fake;

    Future<void> open(WidgetTester tester, {String id = 'c1'}) async {
      tester.view.physicalSize = const Size(400 * 3, 800 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(app(
        ChatView(conversationId: id),
        overrides: [chatServiceProvider.overrideWithValue(fake)],
      ));
      await tester.pump();
      await tester.pump();
    }

    setUp(() {
      fake = FakeChatService()
        ..detail = ChatConversationDetail(
          conversation: fakeConversation(id: 'c1', title: 'On the Gita'),
          messages: [
            serverMessage('m1', ChatRole.user, 'What is dharma?', seq: 1),
            serverMessage('m2', ChatRole.assistant, 'Dharma is **duty**.', seq: 2),
          ],
        );
    });

    testWidgets('shows the messages, the meter and the box', (tester) async {
      await open(tester);

      expect(find.text('On the Gita'), findsOneWidget);
      expect(find.text('What is dharma?'), findsOneWidget);
      expect(find.textContaining('duty', findRichText: true), findsOneWidget);
      expect(find.text('80% left · Sevak'), findsOneWidget);
      expect(find.byType(TextField), findsOneWidget);
      // The last answer can be asked for again.
      expect(find.byTooltip('Regenerate'), findsOneWidget);
    });

    testWidgets('a new chat introduces the assistant by its own description', (tester) async {
      await open(tester, id: 'new');

      expect(find.text('Answers from the Sri Vaishnava tradition.'), findsOneWidget);
      expect(find.text('New chat'), findsOneWidget);
    });

    testWidgets('sending streams the answer and the button becomes Stop, then Send again', (tester) async {
      await open(tester);

      await tester.enterText(find.byType(TextField), 'Tell me more');
      await tester.pump();
      await tester.tap(find.byTooltip('Send'));
      await tester.pump();

      expect(find.text('Tell me more'), findsOneWidget);
      expect(find.byTooltip('Stop'), findsOneWidget);
      // The box was emptied the moment the question went.
      expect(tester.widget<TextField>(find.byType(TextField)).controller!.text, isEmpty);

      fake.push(ChatMeta(
        conversation: fakeConversation(id: 'c1', title: 'On the Gita'),
        userMessage: serverMessage('u2', ChatRole.user, 'Tell me more', seq: 3),
        assistantMessageId: 'a2',
      ));
      fake.push(const ChatDelta('Hari '));
      fake.push(const ChatDelta('bol'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.textContaining('Hari bol', findRichText: true), findsOneWidget);

      fake.push(ChatDone(
        message: serverMessage('a2', ChatRole.assistant, 'Hari bol', seq: 4),
        conversation: fakeConversation(id: 'c1', title: 'On the Gita'),
        credits: fakeCredits(percent: 60),
      ));
      await fake.finish();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byTooltip('Send'), findsOneWidget);
      expect(find.text('60% left · Sevak'), findsOneWidget);
    });

    testWidgets('a refused question comes back into the box with the exhausted card above it', (tester) async {
      await open(tester);
      fake.refuseNext(const ApiFailure(
        kind: FailureKind.unknown,
        statusCode: 402,
        code: 'CREDITS_EXHAUSTED',
        details: {'limitedBy': 'wallet', 'canUpgrade': true},
      ));
      await tester.enterText(find.byType(TextField), 'one more please');
      await tester.pump();
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

    testWidgets('a full chat swaps the box for Start a new chat', (tester) async {
      fake.detail = ChatConversationDetail(
        conversation: fakeConversation(id: 'c1', title: 'Long one', limitReached: ChatLimitReached.messages),
        messages: [serverMessage('m1', ChatRole.user, 'hi', seq: 1)],
      );
      await open(tester);

      expect(find.text('This chat has grown long'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Start a new chat'), findsOneWidget);
      expect(find.byType(TextField), findsNothing);
    });

    testWidgets('a dropped connection shows what arrived and a Try again button', (tester) async {
      await open(tester);
      await tester.enterText(find.byType(TextField), 'hello');
      await tester.pump();
      await tester.tap(find.byTooltip('Send'));
      await tester.pump();

      fake.push(ChatMeta(
        conversation: fakeConversation(id: 'c1', title: 'On the Gita'),
        userMessage: serverMessage('u2', ChatRole.user, 'hello', seq: 3),
        assistantMessageId: 'a2',
      ));
      fake.push(const ChatDelta('The beginning'));
      await tester.pump();
      // An error on a stream needs a real turn of the event loop to arrive.
      await tester.runAsync(() async {
        fake.drop();
        await pumpEventQueue();
      });
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.textContaining('The beginning', findRichText: true), findsOneWidget);
      expect(find.text('Connection lost. What arrived is kept above.'), findsOneWidget);
      expect(find.text('Interrupted'), findsOneWidget);
      expect(find.widgetWithText(TextButton, 'Try again'), findsOneWidget);
    });
  });
}
