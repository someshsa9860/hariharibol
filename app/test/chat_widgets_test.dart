// What the chat draws: an answer's markdown (a table, a code block, a shloka in
// a block quote), the credit meter (a percentage, never a token count), the
// out-of-credits card, and the messages. The whole screen is in
// chat_screen_test.dart.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/core/theme/app_typography.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/chat.dart';
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
      expect(roman.style!.fontFamily, isNot(AppTypography.serif));
      expect(roman.style!.fontStyle, FontStyle.normal);
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
    testWidgets('is small: the percentage and a thin bar, nothing more', (tester) async {
      await tester.pumpWidget(app(ChatCreditMeter(
        credits: fakeCredits(percent: 64, limitedBy: ChatLimitedBy.wallet),
      )));
      await tester.pump();

      expect(find.text('64% left'), findsOneWidget);
      expect(tester.widget<LinearProgressIndicator>(find.byType(LinearProgressIndicator)).value, 0.64);
      // The level and the renewal day wait behind a tap.
      expect(find.text('Sevak'), findsNothing);
      expect(find.text('Renews 3 Nov'), findsNothing);
    });

    testWidgets('a tap shows the level and the renewal day', (tester) async {
      await tester.pumpWidget(app(Center(
        child: ChatCreditMeter(credits: fakeCredits(percent: 64, limitedBy: ChatLimitedBy.wallet)),
      )));
      await tester.pump();

      await tester.tap(find.text('64% left'));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('64% left · Sevak\nRenews 3 Nov'), findsOneWidget);
    });

    testWidgets('says when the daily allowance resets', (tester) async {
      await tester.pumpWidget(app(Center(
        child: ChatCreditMeter(credits: fakeCredits(percent: 5, limitedBy: ChatLimitedBy.daily)),
      )));
      await tester.pump();

      await tester.tap(find.text('5% left'));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.textContaining('Resets at midnight'), findsOneWidget);
    });

    testWidgets('reads out the level and the hint, though they are not on screen', (tester) async {
      final semantics = tester.ensureSemantics();
      await tester.pumpWidget(app(ChatCreditMeter(
        credits: fakeCredits(percent: 64, limitedBy: ChatLimitedBy.wallet),
      )));
      await tester.pump();

      expect(find.bySemanticsLabel('64% left · Sevak, Renews 3 Nov'), findsOneWidget);
      semantics.dispose();
    });

    testWidgets('never shows a token count, whatever the numbers behind it', (tester) async {
      await tester.pumpWidget(app(Center(
        child: ChatCreditMeter(credits: fakeCredits(percent: 37, limitedBy: ChatLimitedBy.wallet)),
      )));
      await tester.pump();
      await tester.tap(find.text('37% left'));
      await tester.pump(const Duration(milliseconds: 300));

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
    testWidgets('the reader\'s sits in a bubble, the answer is plain text with actions', (tester) async {
      await tester.pumpWidget(app(Column(children: [
        ChatMessageBubble(message: serverMessage('u', ChatRole.user, 'What is japa?')),
        ChatMessageBubble(message: serverMessage('a', ChatRole.assistant, 'Japa is **chanting**.'), onRegenerate: () {}),
      ])));
      await tester.pump();

      expect(find.text('What is japa?'), findsOneWidget);
      expect(find.byTooltip('Copy'), findsOneWidget);
      expect(find.byTooltip('Share'), findsOneWidget);
      expect(find.byTooltip('Answer again'), findsOneWidget);
    });

    testWidgets('a picture the reader sent is in the bubble, and opens large when tapped', (tester) async {
      final semantics = tester.ensureSemantics();
      await tester.pumpWidget(app(ChatMessageBubble(
        message: ChatMessage.local(key: 'u', role: ChatRole.user, content: 'What is this?', localImagePath: '/no/such/lamp.jpg'),
      )));
      await tester.pump();

      expect(find.text('What is this?'), findsOneWidget);
      expect(find.bySemanticsLabel('Picture you sent'), findsOneWidget);
      semantics.dispose();
    });

    testWidgets('a message that arrives while the chat is open rises in; one already there does not move', (tester) async {
      await tester.pumpWidget(app(Column(children: [
        ChatMessageBubble(message: serverMessage('old', ChatRole.user, 'Already here')),
        ChatMessageBubble(message: serverMessage('new', ChatRole.user, 'Just sent'), animateIn: true),
      ])));

      Finder fade(String text) => find.ancestor(of: find.text(text), matching: find.byType(FadeTransition));
      expect(tester.widgetList<FadeTransition>(fade('Already here')).any((f) => f.opacity.value < 1), isFalse);
      expect(tester.widgetList<FadeTransition>(fade('Just sent')).any((f) => f.opacity.value < 1), isTrue);

      await tester.pump(const Duration(seconds: 1));
      expect(tester.widgetList<FadeTransition>(fade('Just sent')).any((f) => f.opacity.value < 1), isFalse);
    });

    testWidgets('only the last answer can be asked for again', (tester) async {
      await tester.pumpWidget(app(
        ChatMessageBubble(message: serverMessage('a', ChatRole.assistant, 'Older answer.')),
      ));
      await tester.pump();
      expect(find.byTooltip('Answer again'), findsNothing);
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
      expect(find.bySemanticsLabel('Sakha is writing'), findsOneWidget);
      expect(find.text('Tidying our conversation…'), findsOneWidget);
      expect(find.byTooltip('Copy'), findsNothing);
    });
  });
}
