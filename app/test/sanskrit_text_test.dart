import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/format/sanskrit_text.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/reading_mode.dart';
import 'package:hariharibol/models/verse.dart';
import 'package:hariharibol/widgets/library/sanskrit_text.dart';
import 'package:hariharibol/widgets/library/story_verse.dart';

const _noBreak = ' ';

void main() {
  group('tidySanskrit', () {
    test('turns the keyboard bars into danda and double danda', () {
      expect(tidySanskrit('शंसिसि |\nवद ||'), 'शंसिसि$_noBreak।\nवद$_noBreak॥');
    });

    test('sets the verse number between two double dandas, each held to it', () {
      expect(
        tidySanskrit('तन्मे ब्रूहि सुनिश्चितम् ||५-१||'),
        'तन्मे ब्रूहि सुनिश्चितम्$_noBreak॥$_noBreak५-१$_noBreak॥',
      );
    });

    test('does the same for text that already has the double danda', () {
      expect(
        tidySanskrit('तं विद्धि ॥१८-५१॥'),
        'तं विद्धि$_noBreak॥$_noBreak१८-५१$_noBreak॥',
      );
    });

    test('joins two single dandas into a double one', () {
      expect(tidySanskrit('वदति । । '), 'वदति$_noBreak॥ ');
    });

    test('leaves text that is already printed alone, and never touches a line break', () {
      expect(tidySanskrit('धर्मक्षेत्रे\nकुरुक्षेत्रे'), 'धर्मक्षेत्रे\nकुरुक्षेत्रे');
      expect(tidySanskrit('एकम्।'), 'एकम्।');
    });
  });

  group('splitSpeaker', () {
    test('lifts the line that names who speaks', () {
      // The widget hands it the tidied text, where the bar is already a danda.
      final split = splitSpeaker(tidySanskrit('अर्जुन उवाच |\nसंन्यासं कर्मणां कृष्ण'));
      expect(split.speaker, 'अर्जुन उवाच$_noBreak।');
      expect(split.verse, 'संन्यासं कर्मणां कृष्ण');
    });

    test('knows the speaker without a danda, and a speaker run into one word', () {
      expect(splitSpeaker('श्रीभगवानुवाच\nकिम्').speaker, 'श्रीभगवानुवाच');
      expect(splitSpeaker('श्रीशुक उवाच।\nकिम्').speaker, 'श्रीशुक उवाच।');
    });

    test('a first line that is part of the verse is not lifted', () {
      const text = 'ज्ञेयः स नित्यसंन्यासी\nनिर्द्वन्द्वो हि महाबाहो';
      expect(splitSpeaker(text).speaker, isNull);
      expect(splitSpeaker(text).verse, text);
    });

    test('a speaker with nothing after it stays as the verse', () {
      expect(splitSpeaker('अर्जुन उवाच ।').speaker, isNull);
      expect(splitSpeaker('अर्जुन उवाच ।\n  ').speaker, isNull);
    });
  });

  group('on the page', () {
    Widget app(Widget child) => ProviderScope(
          child: MaterialApp(
            theme: AppTheme.light,
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            home: Scaffold(body: SingleChildScrollView(child: child)),
          ),
        );

    Verse verse({int number = 5, String sanskrit = 'अर्जुन उवाच |\nसंन्यासं कर्मणां ||५-१||'}) => Verse(
          id: 'v$number',
          verseId: '1.5.$number',
          bookNumber: 1,
          type: 'SHLOKA',
          verseNumber: number,
          sanskrit: sanskrit,
          transliteration: 'arjuna uvāca',
        );

    StoryVerse story(Verse v, {StoryPart part = StoryPart.sanskrit, bool numbers = true, bool favorite = false}) =>
        StoryVerse(
          verse: v,
          part: part,
          fontScale: 1,
          showNumber: numbers,
          isFavorite: favorite,
          isHighlighted: false,
          playing: false,
        );

    testWidgets('SanskritText draws danda for the bars and the speaker as its own run', (tester) async {
      await tester.pumpWidget(app(const SanskritText('अर्जुन उवाच |\nकिम् ||१||')));
      final text = tester.widget<Text>(find.byType(Text));
      final plain = text.textSpan!.toPlainText();
      expect(plain, contains('॥'));
      expect(plain, isNot(contains('|')));
      final runs = (text.textSpan! as TextSpan).children!.whereType<TextSpan>().toList();
      expect(runs.first.text, 'अर्जुन उवाच$_noBreak।\n');
      expect(runs.first.style!.fontSize, lessThan(text.textSpan!.style!.fontSize!));
    });

    testWidgets('the number stands in a column of its own, so the verse starts at one edge', (tester) async {
      await tester.pumpWidget(app(Column(children: [
        story(verse(number: 5)),
        story(verse(number: 105)),
      ])));
      final starts = tester.widgetList<SanskritText>(find.byType(SanskritText)).map(
            (w) => tester.getTopLeft(find.byWidget(w)).dx,
          );
      expect(starts.toSet().length, 1, reason: 'a 1-digit and a 3-digit verse number start the verse at the same x');
      expect(find.text('5'), findsOneWidget);
      expect(find.text('105'), findsOneWidget);
    });

    testWidgets('without the number the Sanskrit is full width, and a saved verse keeps its bookmark', (tester) async {
      await tester.pumpWidget(app(story(verse(), numbers: false, favorite: true)));
      expect(find.text('5'), findsNothing);
      expect(find.byIcon(Icons.bookmark_rounded), findsOneWidget);
    });

    testWidgets('a saved verse carries its bookmark in the number column', (tester) async {
      await tester.pumpWidget(app(story(verse(), favorite: true)));
      expect(find.byIcon(Icons.bookmark_rounded), findsOneWidget);
      expect(find.text('5'), findsOneWidget);
    });

    testWidgets('running text keeps its number in front of the first words', (tester) async {
      final meaning = Verse(
        id: 'v',
        verseId: '1.5.7',
        bookNumber: 1,
        type: 'SHLOKA',
        verseNumber: 7,
        translation: const VerseTranslation(id: 't', languageCode: 'en', type: 'TRANSLATION', meaning: 'Arjuna said'),
      );
      await tester.pumpWidget(app(story(meaning, part: StoryPart.translation)));
      expect(find.textContaining('7 ', findRichText: true), findsOneWidget);
      expect(find.byType(SanskritText), findsNothing);
    });
  });
}
