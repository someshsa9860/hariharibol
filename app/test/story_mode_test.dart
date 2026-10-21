import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/reading_mode.dart';
import 'package:hariharibol/models/verse.dart';
import 'package:hariharibol/providers/reading_prefs_provider.dart';
import 'package:hariharibol/widgets/library/story_part_bar.dart';
import 'package:hariharibol/widgets/library/story_verse.dart';

const _sanskrit = 'धर्मक्षेत्रे कुरुक्षेत्रे';
const _transliteration = 'dharma-kṣetre kuru-kṣetre';
const _meaning = 'Dhritarashtra said: what did my sons do?';
const _purport = 'A long commentary on the first verse.';

Verse _verse({int number = 1, String? purport = _purport, String? sanskrit = _sanskrit}) => Verse(
      id: 'v$number',
      verseId: '1.1.$number',
      bookNumber: 1,
      type: 'SHLOKA',
      verseNumber: number,
      sanskrit: sanskrit,
      transliteration: _transliteration,
      translation: VerseTranslation(
        id: 't',
        languageCode: 'en',
        type: 'TRANSLATION',
        meaning: _meaning,
        purport: purport,
      ),
    );

/// The story's settings held in memory: a write started inside a widget test's
/// fake clock never finishes (see "The routine tab" in app/CLAUDE.md).
class _PartInMemory extends StoryPartNotifier {
  _PartInMemory(this.chosen);

  final StoryPart chosen;

  @override
  StoryPart build() => chosen;

  @override
  Future<void> set(StoryPart part) async => state = part;
}

Widget _app(Widget child, {StoryPart part = StoryPart.translation}) => ProviderScope(
      overrides: [storyPartProvider.overrideWith(() => _PartInMemory(part))],
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

StoryVerse _story(Verse verse, StoryPart part, {bool numbers = true, bool favorite = false, VoidCallback? onLongPress}) =>
    StoryVerse(
      verse: verse,
      part: part,
      fontScale: 1,
      showNumber: numbers,
      isFavorite: favorite,
      isHighlighted: false,
      playing: false,
      onLongPress: onLongPress,
    );

void main() {
  group('storyTextOf', () {
    test('gives the part that was chosen, trimmed', () {
      final verse = _verse();
      expect(storyTextOf(verse, StoryPart.sanskrit), _sanskrit);
      expect(storyTextOf(verse, StoryPart.transliteration), _transliteration);
      expect(storyTextOf(verse, StoryPart.translation), _meaning);
      expect(storyTextOf(verse, StoryPart.purport), _purport);
    });

    test('is null where the verse has none of it', () {
      expect(storyTextOf(_verse(purport: null), StoryPart.purport), isNull);
      expect(storyTextOf(_verse(sanskrit: '  '), StoryPart.sanskrit), isNull);
    });

    test('a rendering picked to compare replaces the verse\'s own', () {
      const other = VerseTranslation(id: 'o', languageCode: 'en', type: 'TRANSLATION', meaning: 'Another wording');
      expect(storyTextOf(_verse(), StoryPart.translation, translation: other), 'Another wording');
    });
  });

  group('StoryVerse', () {
    testWidgets('shows the chosen part with the verse number in front', (tester) async {
      await tester.pumpWidget(_app(_story(_verse(number: 7), StoryPart.translation)));
      expect(find.textContaining(_meaning, findRichText: true), findsOneWidget);
      expect(find.textContaining('7', findRichText: true), findsOneWidget);
      expect(find.textContaining(_sanskrit, findRichText: true), findsNothing);
    });

    testWidgets('leaves the number out when numbering is off', (tester) async {
      await tester.pumpWidget(_app(_story(_verse(number: 7), StoryPart.translation, numbers: false)));
      expect(find.textContaining('7', findRichText: true), findsNothing);
    });

    testWidgets('a verse with none of the part draws nothing', (tester) async {
      await tester.pumpWidget(_app(_story(_verse(purport: null), StoryPart.purport)));
      expect(find.byType(Text), findsNothing);
    });

    testWidgets('a saved verse carries a bookmark, and pressing and holding opens its actions', (tester) async {
      var held = 0;
      await tester.pumpWidget(_app(_story(_verse(), StoryPart.sanskrit, favorite: true, onLongPress: () => held++)));
      expect(find.byIcon(Icons.bookmark_rounded), findsOneWidget);
      await tester.longPress(find.byType(StoryVerse));
      expect(held, 1);
    });
  });

  group('StoryPartBar', () {
    testWidgets('lists the four parts, and choosing one changes the setting', (tester) async {
      late WidgetRef ref;
      await tester.pumpWidget(_app(
        Consumer(builder: (context, r, _) {
          ref = r;
          return StoryPartBar(header: const Text('Heading'), verses: [_verse()]);
        }),
      ));
      expect(find.byType(ChoiceChip), findsNWidgets(4));
      expect(find.text('Meaning'), findsOneWidget);

      await tester.tap(find.text('Purport'));
      await tester.pump();
      expect(ref.read(storyPartProvider), StoryPart.purport);
    });

    testWidgets('says so when the chosen part has nothing in the chapter', (tester) async {
      await tester.pumpWidget(_app(
        StoryPartBar(header: const Text('Heading'), verses: [_verse(purport: null)]),
        part: StoryPart.purport,
      ));
      expect(find.textContaining('nothing for the part you chose'), findsOneWidget);
    });
  });

  test('the room between verses is none, and only the ends of the text get any', () {
    expect(storyGapAfter(1, 5), 0);
    expect(storyGapAfter(4, 5), 0);
    expect(storyGapAfter(5, 5), greaterThan(0));
    expect(storyGapAfter(0, 5), greaterThan(0));
  });
}
