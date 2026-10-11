// The "Heard live" card on the counter. What is guarded: it says nothing when no
// helper is listening, it shows the words and the verdict in words (never colour
// alone), and it fits a narrow phone at a large text size in both themes.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/services/heard_words.dart';
import 'package:hariharibol/widgets/chant/chant_heard_card.dart';

Future<void> pumpCard(
  WidgetTester tester,
  HeardWords? heard, {
  Brightness brightness = Brightness.light,
  bool reduceMotion = true,
}) {
  tester.view.physicalSize = const Size(320 * 3, 640 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  return tester.pumpWidget(
    MaterialApp(
      theme: brightness == Brightness.light ? AppTheme.light : AppTheme.dark,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      home: MediaQuery(
        data: MediaQueryData(
          textScaler: const TextScaler.linear(1.4),
          size: const Size(320, 640),
          disableAnimations: reduceMotion,
        ),
        child: Scaffold(
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: ChantHeardCard(heard: heard),
          ),
        ),
      ),
    ),
  );
}

Future<void> settle(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 600));
}

void main() {
  testWidgets('nothing is drawn while no helper is listening', (tester) async {
    await pumpCard(tester, null);
    await settle(tester);
    expect(find.byType(Card), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('before anything is heard it says what will appear and waits', (tester) async {
    final heard = HeardWords();
    await pumpCard(tester, heard);
    await settle(tester);

    expect(find.text('HEARD LIVE'), findsOneWidget);
    expect(find.text('Waiting for your voice'), findsOneWidget);
    expect(find.textContaining('Chant out loud'), findsOneWidget);
    expect(find.text('Not counted'), findsNothing);
  });

  testWidgets('shows the words as they come, and does not call it uncounted mid-chant', (tester) async {
    final heard = HeardWords();
    await pumpCard(tester, heard);

    heard
      ..voice(true)
      ..hear('hare krishna', isFinal: false, match: 0.4, needed: 0.5);
    await settle(tester);

    expect(find.text('Hearing you…'), findsOneWidget);
    expect(find.text('hare krishna'), findsOneWidget);
    expect(find.text('40% match · needs 50%'), findsOneWidget);
    expect(find.text('Not counted'), findsNothing, reason: 'the chant is still going');
    expect(find.text('Counted +1'), findsNothing);
  });

  testWidgets('says counted, in words, once a chant has added to the count', (tester) async {
    final heard = HeardWords();
    await pumpCard(tester, heard);

    heard.hear('hare krishna hare', isFinal: true, counted: 1, match: 0.72, needed: 0.5);
    await settle(tester);

    expect(find.text('Last heard'), findsOneWidget);
    expect(find.text('hare krishna hare'), findsOneWidget);
    expect(find.text('72% match · needs 50%'), findsOneWidget);
    expect(find.text('Counted +1'), findsOneWidget);
  });

  testWidgets('says not counted when a finished stretch fell short', (tester) async {
    final heard = HeardWords();
    await pumpCard(tester, heard);

    heard.hear('good morning', isFinal: true, match: 0.2, needed: 0.5);
    await settle(tester);

    expect(find.text('Not counted'), findsOneWidget);
    expect(find.text('20% match · needs 50%'), findsOneWidget);
  });

  testWidgets('lists the stretches before the latest one', (tester) async {
    final heard = HeardWords();
    await pumpCard(tester, heard);

    heard
      ..hear('first words', isFinal: true, counted: 1, match: 0.9, needed: 0.5)
      ..hear('second words', isFinal: true, match: 0.1, needed: 0.5)
      ..hear('third words', isFinal: true, counted: 1, match: 0.8, needed: 0.5);
    await settle(tester);

    expect(find.text('Earlier'), findsOneWidget);
    // The latest is the main line; the two before it are the rows.
    expect(find.text('third words'), findsOneWidget);
    expect(find.text('second words'), findsOneWidget);
    expect(find.text('first words'), findsOneWidget);
    expect(find.text('10% match'), findsOneWidget);
    expect(find.text('90% match'), findsOneWidget);
  });

  testWidgets('word detection shows the words with no verdict', (tester) async {
    final heard = HeardWords();
    await pumpCard(tester, heard);

    heard.hear('hare krishna', isFinal: false);
    await settle(tester);

    expect(find.text('Hearing you…'), findsOneWidget, reason: 'words arriving mean it hears you');
    expect(find.text('hare krishna'), findsOneWidget);
    expect(find.textContaining('match'), findsNothing);
    expect(find.text('Not counted'), findsNothing);
  });

  testWidgets('animates while a voice is heard when motion is allowed, and leaves cleanly', (tester) async {
    final heard = HeardWords()..voice(true);
    await pumpCard(tester, heard, reduceMotion: false);
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pump(const Duration(milliseconds: 300));
    expect(tester.takeException(), isNull);

    heard.voice(false);
    await tester.pump(const Duration(milliseconds: 300));
    // Taking the card out of the tree must stop the animation, or the test ends
    // with a ticker still running.
    await pumpCard(tester, null, reduceMotion: false);
    await settle(tester);
    expect(tester.takeException(), isNull);
  });

  for (final brightness in Brightness.values) {
    testWidgets('fits a narrow phone at a large text size, ${brightness.name}', (tester) async {
      final heard = HeardWords();
      await pumpCard(tester, heard, brightness: brightness);

      heard
        ..hear('hare krishna hare krishna krishna krishna hare hare', isFinal: true, counted: 2, match: 1.0, needed: 0.5)
        ..hear('a rather long sentence that the recogniser made up while nobody was chanting', isFinal: true, match: 0.15, needed: 0.5)
        ..hear('राम राम राम राम राम राम राम राम राम राम राम राम राम राम राम राम', isFinal: false, match: 0.7, needed: 0.65)
        ..voice(true);
      await settle(tester);

      expect(tester.takeException(), isNull);
    });
  }
}
