import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol_dev/core/theme/app_theme.dart';
import 'package:hariharibol_dev/l10n/generated/app_localizations.dart';
import 'package:hariharibol_dev/models/dev_event.dart';
import 'package:hariharibol_dev/models/dev_summary.dart';
import 'package:hariharibol_dev/widgets/chat/composer.dart';
import 'package:hariharibol_dev/widgets/chat/message_bubble.dart';
import 'package:hariharibol_dev/widgets/live/event_tile.dart';
import 'package:hariharibol_dev/widgets/live/summary_grid.dart';

Widget host(Widget child) => MaterialApp(
      theme: AppTheme.light,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: child),
    );

void main() {
  testWidgets('an event tile shows its title, text and kind, and can be tapped', (tester) async {
    var tapped = false;
    final event = DevEvent(
      id: 'e1',
      type: 'error.spike',
      severity: 'critical',
      title: '25 server errors in 5 minutes',
      body: '25× GET /api/app/home',
      data: const {},
      createdAt: DateTime.now(),
    );
    await tester.pumpWidget(host(EventTile(event: event, onTap: () => tapped = true)));

    expect(find.text('25 server errors in 5 minutes'), findsOneWidget);
    expect(find.text('25× GET /api/app/home'), findsOneWidget);
    expect(find.text('Error spike'), findsOneWidget);
    expect(find.text('Just now'), findsOneWidget);

    await tester.tap(find.byType(EventTile));
    expect(tapped, isTrue);
  });

  testWidgets('the summary shows its numbers', (tester) async {
    const summary = DevSummary(
      users: 1200,
      signupsToday: 14,
      signups7d: 90,
      unreadChats: 2,
      unreadMessages: 5,
      criticalLastHour: 1,
      errorsLastHour: 7,
      online: 31,
    );
    await tester.pumpWidget(host(const SingleChildScrollView(child: SummaryGrid(summary: summary))));

    for (final text in ['31', '1200', '14', '7', '1', '2']) {
      expect(find.text(text), findsWidgets);
    }
    expect(find.text('Errors, last hour'), findsOneWidget);
  });

  testWidgets('a failed message says so and offers a retry on tap', (tester) async {
    var retried = false;
    await tester.pumpWidget(host(MessageBubble(
      body: 'On it',
      createdAt: DateTime.now(),
      mine: true,
      failed: true,
      onRetry: () => retried = true,
    )));

    expect(find.text('Not sent. Tap to try again.'), findsOneWidget);
    await tester.tap(find.text('On it'));
    expect(retried, isTrue);
  });

  testWidgets('the composer sends the trimmed text and clears itself, and ignores an empty box', (tester) async {
    final sent = <String>[];
    await tester.pumpWidget(host(Align(
      alignment: Alignment.bottomCenter,
      child: Composer(onSend: (value) async => sent.add(value)),
    )));

    await tester.tap(find.byIcon(Icons.send));
    expect(sent, isEmpty);

    await tester.enterText(find.byType(TextField), '  Fixed in 2.1  ');
    await tester.tap(find.byIcon(Icons.send));
    await tester.pump();

    expect(sent, ['Fixed in 2.1']);
    expect(find.text('Fixed in 2.1'), findsNothing);
  });
}
