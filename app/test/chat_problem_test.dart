// What the chat tells the reader when a turn goes wrong. A failure is sorted by
// the server's code first and by its kind second, and the line on screen is
// always one of the app's own, in the reader's language — never the server's
// text, a provider's, or an exception's.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/api_failure.dart';
import 'package:hariharibol/models/chat.dart';
import 'package:hariharibol/providers/chat_state.dart';
import 'package:hariharibol/widgets/chat/chat_notices.dart';

ChatStreamError event(String code, {bool retryable = true}) => ChatStreamError(
      code: code,
      message: 'text the server wrote',
      retryable: retryable,
      partial: false,
      messageId: null,
      details: null,
    );

void main() {
  group('a failed call', () {
    ChatIssue issueOf(ApiFailure failure, {bool replyStarted = false}) =>
        ChatProblem.fromFailure(failure, replyStarted: replyStarted).issue;

    test('with no route to the server is offline; cut off once the reply began, a lost connection', () {
      const failure = ApiFailure(kind: FailureKind.network);
      expect(issueOf(failure), ChatIssue.offline);
      expect(issueOf(failure, replyStarted: true), ChatIssue.connectionLost);
    });

    test('that took too long is a timeout, before or during the reply', () {
      const failure = ApiFailure(kind: FailureKind.timeout);
      expect(issueOf(failure), ChatIssue.timedOut);
      expect(issueOf(failure, replyStarted: true), ChatIssue.timedOut);
    });

    test('over a certificate the phone rejected is not "offline"', () {
      final problem = ChatProblem.fromFailure(
        const ApiFailure(kind: FailureKind.network, code: ClientFailureCode.insecureConnection),
        canRetry: true,
      );
      expect(problem.issue, ChatIssue.failed);
      expect(problem.failure!.code, ClientFailureCode.insecureConnection);
    });

    test('with a rate limit, or the provider\'s busy code on any status, is "busy right now"', () {
      expect(issueOf(const ApiFailure(kind: FailureKind.rateLimited, statusCode: 429)), ChatIssue.overloaded);
      expect(
        issueOf(const ApiFailure(kind: FailureKind.server, statusCode: 503, code: 'AI_BUSY')),
        ChatIssue.overloaded,
      );
    });

    test('with a server fault, or a provider that cannot be used, is "not available"', () {
      expect(issueOf(const ApiFailure(kind: FailureKind.server, statusCode: 500)), ChatIssue.unavailable);
      expect(issueOf(const ApiFailure(kind: FailureKind.server, statusCode: 502)), ChatIssue.unavailable);
      for (final code in ['AI_UNAVAILABLE', 'AI_MISCONFIGURED', 'AI_BUDGET_EXHAUSTED']) {
        expect(issueOf(ApiFailure(kind: FailureKind.server, code: code)), ChatIssue.unavailable, reason: code);
      }
    });

    test('with a reply the provider could not complete is "could not finish that reply"', () {
      for (final code in ['AI_FAILED', 'AI_BAD_OUTPUT']) {
        expect(issueOf(ApiFailure(kind: FailureKind.server, statusCode: 502, code: code)), ChatIssue.replyFailed);
      }
    });

    test('because another reply is still being written is "wait", and never offers Retry', () {
      final problem = ChatProblem.fromFailure(
        const ApiFailure(kind: FailureKind.conflict, statusCode: 409),
        canRetry: true,
      );
      expect(problem.issue, ChatIssue.busy);
      expect(problem.canRetry, isFalse);
    });

    test('for any other reason is a plain failure, keeping the failure only to pick a line', () {
      for (final kind in [FailureKind.unauthorized, FailureKind.forbidden, FailureKind.notFound, FailureKind.unknown]) {
        final problem = ChatProblem.fromFailure(
          ApiFailure(kind: kind, message: 'text the server wrote'),
          canRetry: true,
        );
        expect(problem.issue, ChatIssue.failed, reason: kind.name);
        expect(problem.failure!.kind, kind, reason: kind.name);
        expect(problem.canRetry, isTrue, reason: kind.name);
      }
    });

    test('offers Retry only where the turn can be asked for again', () {
      for (final failure in const [
        ApiFailure(kind: FailureKind.network),
        ApiFailure(kind: FailureKind.timeout),
        ApiFailure(kind: FailureKind.rateLimited),
        ApiFailure(kind: FailureKind.server),
        ApiFailure(kind: FailureKind.unknown),
      ]) {
        expect(ChatProblem.fromFailure(failure).canRetry, isFalse, reason: failure.kind.name);
        expect(ChatProblem.fromFailure(failure, canRetry: true).canRetry, isTrue, reason: failure.kind.name);
      }
    });
  });

  group('an error event in the stream', () {
    test('is sorted by its code', () {
      expect(ChatProblem.fromEvent(event('AI_BUSY')).issue, ChatIssue.overloaded);
      expect(ChatProblem.fromEvent(event('AI_UNAVAILABLE')).issue, ChatIssue.unavailable);
      expect(ChatProblem.fromEvent(event('AI_FAILED')).issue, ChatIssue.replyFailed);
      expect(ChatProblem.fromEvent(event('AI_BAD_OUTPUT')).issue, ChatIssue.replyFailed);
    });

    test('offers Retry only when the server says it is retryable and the question is saved', () {
      expect(ChatProblem.fromEvent(event('AI_BUSY'), canRetry: true).canRetry, isTrue);
      expect(ChatProblem.fromEvent(event('AI_BUSY', retryable: false), canRetry: true).canRetry, isFalse);
      expect(ChatProblem.fromEvent(event('AI_BUSY')).canRetry, isFalse);
    });

    test('with a code nobody knows is a plain failure, and its text is dropped', () {
      final problem = ChatProblem.fromEvent(event('SOMETHING_NEW'), canRetry: true);
      expect(problem.issue, ChatIssue.failed);
      expect(problem.failure!.message, isEmpty);
      expect(problem.canRetry, isTrue);
    });
  });

  group('the notice under the messages', () {
    // What a server, a driver or a provider might say — none of it may be seen.
    const hostile = "connect ECONNREFUSED 10.0.0.5:5432 · PrismaClientKnownRequestError · "
        "models/gemini-2.0-flash is not found (404) · Instance of 'ResponseBody' · "
        "type '_ControllerStream<Uint8List>' is not a subtype";
    const hostileFailure = ApiFailure(kind: FailureKind.unknown, message: hostile, code: 'WHATEVER');

    final lines = <ChatIssue, String>{
      ChatIssue.offline: 'No connection. Check your internet and try again.',
      ChatIssue.timedOut: 'That took too long. Please try again.',
      ChatIssue.connectionLost: 'The connection was interrupted. Please try again.',
      ChatIssue.overloaded: 'Sakha is busy right now. Please try again in a moment.',
      ChatIssue.unavailable: 'Sakha is not available right now. Please try again a little later.',
      ChatIssue.replyFailed: 'Sakha could not finish that reply. Please try again.',
      ChatIssue.busy: 'Please wait for the current reply to finish.',
      ChatIssue.tooLong: 'That message is too long. Please shorten it.',
      ChatIssue.conversationFull: 'This chat has grown long',
      ChatIssue.failed: 'Something went wrong. Please try again.',
      // The screen draws a card for these two and never this line; the notice
      // still has words of its own should it ever be handed one.
      ChatIssue.creditsExhausted: 'Something went wrong. Please try again.',
      ChatIssue.notAvailable: 'Something went wrong. Please try again.',
    };

    Widget host(ChatProblem problem, {Locale locale = const Locale('en'), VoidCallback? onRetry}) {
      return MaterialApp(
        locale: locale,
        theme: AppTheme.light,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(body: ChatProblemNotice(problem: problem, onRetry: onRetry ?? () {}, onDismiss: () {})),
      );
    }

    String shown(WidgetTester tester) => [
          for (final text in tester.widgetList<Text>(find.byType(Text))) text.data ?? text.textSpan?.toPlainText() ?? '',
        ].join('\n');

    test('has a line for every kind of problem', () {
      expect(lines.keys.toSet(), ChatIssue.values.toSet());
    });

    for (final entry in lines.entries) {
      testWidgets('${entry.key.name} reads "${entry.value}" whatever the server wrote', (tester) async {
        await tester.pumpWidget(host(ChatProblem(entry.key, failure: hostileFailure)));

        expect(find.text(entry.value), findsOneWidget);
        expect(shown(tester), isNot(contains('ECONNREFUSED')));
        expect(shown(tester), isNot(contains('Prisma')));
        expect(shown(tester), isNot(contains('gemini')));
        expect(shown(tester), isNot(contains('ResponseBody')));
        expect(shown(tester), isNot(contains('subtype')));
        expect(shown(tester), isNot(contains('404')));
      });
    }

    testWidgets('a plain failure picks the line for what it was, in the app\'s words', (tester) async {
      await tester.pumpWidget(host(const ChatProblem(ChatIssue.failed, failure: ApiFailure(kind: FailureKind.unauthorized))));
      expect(find.text('Your session has ended. Please sign in again.'), findsOneWidget);

      await tester.pumpWidget(host(const ChatProblem(
        ChatIssue.failed,
        failure: ApiFailure(kind: FailureKind.network, code: ClientFailureCode.insecureConnection),
      )));
      expect(find.text('The connection is not secure.'), findsOneWidget);
    });

    testWidgets('speaks the app language, whichever it is', (tester) async {
      for (final locale in AppLocalizations.supportedLocales) {
        final words = lookupAppLocalizations(locale);
        for (final entry in {
          ChatIssue.offline: words.errorNetwork,
          ChatIssue.timedOut: words.errorTimeout,
          ChatIssue.connectionLost: words.chatConnectionLost,
          ChatIssue.overloaded: words.chatOverloaded,
          ChatIssue.unavailable: words.chatUnavailable,
          ChatIssue.replyFailed: words.chatReplyFailed,
        }.entries) {
          await tester.pumpWidget(host(ChatProblem(entry.key), locale: locale));
          expect(find.text(entry.value), findsOneWidget, reason: '${entry.key.name} in ${locale.languageCode}');
        }
      }
    });

    testWidgets('offers Try again only when asking again can help', (tester) async {
      var retried = 0;
      await tester.pumpWidget(host(const ChatProblem(ChatIssue.overloaded, canRetry: true), onRetry: () => retried++));
      await tester.tap(find.widgetWithText(TextButton, 'Try again'));
      expect(retried, 1);

      await tester.pumpWidget(host(const ChatProblem(ChatIssue.overloaded)));
      expect(find.widgetWithText(TextButton, 'Try again'), findsNothing);
    });

    testWidgets('shows the offline icon for a lost connection and a warning for the rest', (tester) async {
      for (final issue in [ChatIssue.offline, ChatIssue.connectionLost]) {
        await tester.pumpWidget(host(ChatProblem(issue)));
        expect(find.byIcon(Icons.wifi_off_rounded), findsOneWidget, reason: issue.name);
      }
      for (final issue in [ChatIssue.overloaded, ChatIssue.unavailable, ChatIssue.replyFailed, ChatIssue.failed]) {
        await tester.pumpWidget(host(ChatProblem(issue)));
        expect(find.byIcon(Icons.error_outline_rounded), findsOneWidget, reason: issue.name);
      }
    });
  });
}
