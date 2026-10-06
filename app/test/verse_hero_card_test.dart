// What the dashboard's main card does when the verse is thin.
//
// Most of the library has Sanskrit, a transliteration and a translation. Some
// of it does not: a verse can be published before a translator's rendering is
// entered, and a Bhagavatam range often has no transliteration. The card sits
// at the top of the first screen anyone sees, so a null in any of those fields
// has to render a smaller card, never a blank screen.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/verse.dart';
import 'package:hariharibol/widgets/dashboard/verse_hero_card.dart';

Verse verse({
  String? sanskrit,
  String? transliteration,
  VerseTranslation? translation,
}) =>
    Verse(
      id: 'v1',
      verseId: '1.2.47',
      bookNumber: 1,
      type: 'SHLOKA',
      chapterNumber: 2,
      verseNumber: 47,
      sanskrit: sanskrit,
      transliteration: transliteration,
      translation: translation,
      book: const VerseBookRef(
        id: 'b1',
        slug: 'bhagavad-gita',
        title: 'Bhagavad Gita',
        bookNumber: 1,
      ),
    );

Future<void> pumpCard(WidgetTester tester, Verse subject, {VoidCallback? onTap}) {
  return tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: VerseHeroCard(label: 'Verse of the day', verse: subject, onTap: onTap),
      ),
    ),
  );
}

void main() {
  testWidgets('a complete verse shows script, sound, sense and the translator',
      (tester) async {
    await pumpCard(
      tester,
      verse(
        sanskrit: 'कर्मण्येवाधिकारस्ते',
        transliteration: 'karmany-evadhikaras te',
        translation: const VerseTranslation(
          id: 't1',
          languageCode: 'en',
          type: 'TRANSLATION',
          meaning: 'You have a right to perform your prescribed duty.',
          translator: Translator(id: 'p1', slug: 'prabhupada', name: 'A. C. Bhaktivedanta Swami'),
        ),
      ),
    );

    expect(find.text('VERSE OF THE DAY'), findsOneWidget);
    expect(find.text('कर्मण्येवाधिकारस्ते'), findsOneWidget);
    expect(find.text('karmany-evadhikaras te'), findsOneWidget);
    expect(find.textContaining('prescribed duty'), findsOneWidget);
    expect(find.text('— A. C. Bhaktivedanta Swami'), findsOneWidget);
    expect(find.text('Bhagavad Gita · 2.47'), findsOneWidget);
  });

  testWidgets('a verse with nothing but a reference still renders', (tester) async {
    await pumpCard(tester, verse());

    expect(tester.takeException(), isNull);
    // With no Sanskrit to lead with, the reference takes its place rather than
    // leaving the card headed by its label and a gap.
    expect(find.text('Bhagavad Gita 2.47'), findsOneWidget);
    expect(find.text('Bhagavad Gita · 2.47'), findsOneWidget);
  });

  testWidgets('the arrow appears only when the card goes somewhere', (tester) async {
    await pumpCard(tester, verse(sanskrit: 'कर्मण्येवाधिकारस्ते'));
    expect(find.byIcon(Icons.arrow_forward_rounded), findsNothing);

    await pumpCard(tester, verse(sanskrit: 'कर्मण्येवाधिकारस्ते'), onTap: () {});
    expect(find.byIcon(Icons.arrow_forward_rounded), findsOneWidget);
  });
}
