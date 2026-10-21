import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/constants/storage_keys.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/core/theme/app_typography.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/language.dart';
import 'package:hariharibol/models/language_settings.dart';
import 'package:hariharibol/models/reading_mode.dart';
import 'package:hariharibol/models/verse.dart';
import 'package:hariharibol/models/verse_part.dart';
import 'package:hariharibol/providers/language_settings_provider.dart';
import 'package:hariharibol/providers/languages_provider.dart';
import 'package:hariharibol/providers/reading_prefs_provider.dart';
import 'package:hariharibol/services/local_store.dart';
import 'package:hariharibol/widgets/library/reading_settings_sheet.dart';
import 'package:hariharibol/widgets/library/verse_block.dart';
import 'package:hive_ce_flutter/hive_flutter.dart';

const _sanskrit = 'धर्मक्षेत्रे कुरुक्षेत्रे';
const _transliteration = 'dharma-kṣetre kuru-kṣetre';
const _meaning = 'Dhritarashtra said: what did my sons do?';
const _purport = 'A long commentary on the first verse.';
const _wordMeaning = 'in the place of pilgrimage';

Verse _verse({String? purport = _purport, VerseExplanation? explanation}) => Verse(
      id: 'v',
      verseId: '1.1.1',
      bookNumber: 1,
      type: 'SHLOKA',
      verseNumber: 1,
      sanskrit: _sanskrit,
      transliteration: _transliteration,
      wordMeanings: const [WordMeaning(word: 'dharma-kṣetre', meaning: _wordMeaning)],
      translation: VerseTranslation(
        id: 't',
        languageCode: 'en',
        type: 'TRANSLATION',
        meaning: _meaning,
        purport: purport,
      ),
      explanation: explanation,
    );

/// The hidden parts held in memory: a write started inside a widget test's fake
/// clock never finishes. That the real one reaches the device is tested below.
class _HiddenInMemory extends HiddenVersePartsNotifier {
  @override
  Set<VersePart> build() => {};

  @override
  Future<void> set(VersePart part, {required bool hidden}) async {
    state = hidden ? {...state, part} : ({...state}..remove(part));
  }
}

/// "Word meanings" open or shut, in memory for the same reason.
class _WordsOpenInMemory extends WordMeaningsOpenNotifier {
  @override
  bool build() => false;

  @override
  Future<void> set(bool open) async => state = open;
}

class _FontSizeInMemory extends ReadingFontSizeNotifier {
  @override
  ReadingFontSize build() => ReadingFontSize.medium;

  @override
  Future<void> set(ReadingFontSize size) async => state = size;
}

class _ModeInMemory extends ReadingModeNotifier {
  @override
  ReadingMode build() => ReadingMode.verses;

  @override
  Future<void> set(ReadingMode mode) async => state = mode;
}

class _StoryPartInMemory extends StoryPartNotifier {
  @override
  StoryPart build() => StoryPart.translation;

  @override
  Future<void> set(StoryPart part) async => state = part;
}

class _StoryNumbersInMemory extends StoryNumbersNotifier {
  @override
  bool build() => true;

  @override
  Future<void> set(bool shown) async => state = shown;
}

class _LanguagesInMemory extends LanguageSettingsNotifier {
  @override
  LanguageSettings build() => const LanguageSettings(app: 'en', reading: 'en', speaking: 'en');

  @override
  Future<void> setReading(String code) async => state = state.copyWith(reading: code);
}

const _delegates = [
  AppLocalizations.delegate,
  GlobalMaterialLocalizations.delegate,
  GlobalWidgetsLocalizations.delegate,
  GlobalCupertinoLocalizations.delegate,
];

Widget _block(Verse verse, Set<VersePart> hidden) => MaterialApp(
      theme: AppTheme.light,
      localizationsDelegates: _delegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: ProviderScope(
          overrides: [wordMeaningsOpenProvider.overrideWith(_WordsOpenInMemory.new)],
          child: SingleChildScrollView(
            child: VerseBlock(
              verse: verse,
              fontScale: 1,
              hidden: hidden,
              isFavorite: false,
              isHighlighted: false,
              noteCount: 0,
              onToggleFavorite: () {},
              onToggleHighlight: () {},
              onOpenNotes: () {},
              onOpenRelated: () {},
            ),
          ),
        ),
      ),
    );

Widget _sheetApp() => ProviderScope(
      overrides: [
        hiddenVersePartsProvider.overrideWith(_HiddenInMemory.new),
        readingFontSizeProvider.overrideWith(_FontSizeInMemory.new),
        readingModeProvider.overrideWith(_ModeInMemory.new),
        storyPartProvider.overrideWith(_StoryPartInMemory.new),
        storyNumbersProvider.overrideWith(_StoryNumbersInMemory.new),
        languageSettingsProvider.overrideWith(_LanguagesInMemory.new),
        languagesProvider.overrideWith((ref) async => const [
              Language(code: 'en', nativeName: 'English', englishName: 'English'),
              Language(code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi'),
              Language(code: 'mr', nativeName: 'मराठी', englishName: 'Marathi'),
            ]),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        localizationsDelegates: _delegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: TextButton(
                onPressed: () => showReadingSettingsSheet(context),
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
    );

Future<void> _openSheet(WidgetTester tester) async {
  await tester.pumpWidget(_sheetApp());
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

ProviderContainer _container(WidgetTester tester) =>
    ProviderScope.containerOf(tester.element(find.byType(Scaffold).first));

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('a verse with parts hidden', () {
    testWidgets('shows every part when nothing is hidden', (tester) async {
      await tester.pumpWidget(_block(_verse(), const {}));

      expect(find.text(_sanskrit), findsOneWidget);
      expect(find.text(_transliteration), findsOneWidget);
      expect(find.text('Word meanings'), findsOneWidget);
      expect(find.text('Purport'), findsOneWidget);
      expect(find.textContaining(_meaning), findsOneWidget);
    });

    testWidgets('hides the Sanskrit and keeps the rest', (tester) async {
      await tester.pumpWidget(_block(_verse(), {VersePart.sanskrit}));

      expect(find.text(_sanskrit), findsNothing);
      expect(find.text(_transliteration), findsOneWidget);
      expect(find.text('Word meanings'), findsOneWidget);
      expect(find.text('Purport'), findsOneWidget);
      expect(find.textContaining(_meaning), findsOneWidget);
    });

    testWidgets('hides the transliteration and keeps the rest', (tester) async {
      await tester.pumpWidget(_block(_verse(), {VersePart.transliteration}));

      expect(find.text(_transliteration), findsNothing);
      expect(find.text(_sanskrit), findsOneWidget);
      expect(find.text('Word meanings'), findsOneWidget);
      expect(find.text('Purport'), findsOneWidget);
    });

    testWidgets('hides the word meanings and keeps the rest', (tester) async {
      await tester.pumpWidget(_block(_verse(), {VersePart.wordMeanings}));

      expect(find.text('Word meanings'), findsNothing);
      expect(find.text(_sanskrit), findsOneWidget);
      expect(find.text(_transliteration), findsOneWidget);
      expect(find.text('Purport'), findsOneWidget);
    });

    testWidgets('hides the purport and keeps the rest', (tester) async {
      await tester.pumpWidget(_block(_verse(), {VersePart.purport}));

      expect(find.text('Purport'), findsNothing);
      expect(find.text(_sanskrit), findsOneWidget);
      expect(find.text('Word meanings'), findsOneWidget);
      expect(find.textContaining(_meaning), findsOneWidget);
    });

    testWidgets('hiding the purport hides the explanation that stands in for it', (tester) async {
      final verse = _verse(
        purport: null,
        explanation: const VerseExplanation(text: 'A plain-language note.', source: 'EDITORIAL'),
      );

      await tester.pumpWidget(_block(verse, const {}));
      final label = AppLocalizations.of(tester.element(find.byType(Scaffold))).verseExplanationLabel;
      expect(find.text(label), findsOneWidget);

      await tester.pumpWidget(_block(verse, {VersePart.purport}));
      expect(find.text(label), findsNothing);
    });

    testWidgets('the translation is never hidden', (tester) async {
      await tester.pumpWidget(_block(_verse(), {...VersePart.values}));

      expect(find.textContaining(_meaning), findsOneWidget);
      expect(find.text(_sanskrit), findsNothing);
      expect(find.text(_transliteration), findsNothing);
      expect(find.text('Word meanings'), findsNothing);
      expect(find.text('Purport'), findsNothing);
    });
  });

  group('the Reading settings sheet', () {
    testWidgets('has one box for each part, unticked until chosen', (tester) async {
      await _openSheet(tester);

      expect(find.text('Hide in verses'), findsOneWidget);
      expect(find.byType(CheckboxListTile), findsNWidgets(VersePart.values.length));
      for (final box in tester.widgetList<CheckboxListTile>(find.byType(CheckboxListTile))) {
        expect(box.value, isFalse);
      }
    });

    testWidgets('ticking a box hides that part, unticking shows it again', (tester) async {
      await _openSheet(tester);

      await tester.tap(find.widgetWithText(CheckboxListTile, 'Purport'));
      await tester.pump();
      expect(_container(tester).read(hiddenVersePartsProvider), {VersePart.purport});

      await tester.tap(find.widgetWithText(CheckboxListTile, 'Sanskrit'));
      await tester.pump();
      expect(_container(tester).read(hiddenVersePartsProvider), {VersePart.purport, VersePart.sanskrit});

      await tester.tap(find.widgetWithText(CheckboxListTile, 'Purport'));
      await tester.pump();
      expect(_container(tester).read(hiddenVersePartsProvider), {VersePart.sanskrit});
    });

    testWidgets('picking a language changes it and closes the sheet', (tester) async {
      await _openSheet(tester);
      expect(find.text('Reading settings'), findsOneWidget);

      await tester.ensureVisible(find.text('हिन्दी'));
      await tester.tap(find.text('हिन्दी'));
      await tester.pumpAndSettle();

      expect(find.text('Reading settings'), findsNothing);
      expect(_container(tester).read(languageSettingsProvider).reading, 'hi');
    });

    testWidgets('picking the language already chosen just closes it', (tester) async {
      await _openSheet(tester);

      await tester.ensureVisible(find.text('English').first);
      await tester.tap(find.text('English').first);
      await tester.pumpAndSettle();

      expect(find.text('Reading settings'), findsNothing);
      expect(_container(tester).read(languageSettingsProvider).reading, 'en');
    });

    testWidgets('choosing a box or a size leaves the sheet open', (tester) async {
      await _openSheet(tester);

      await tester.tap(find.widgetWithText(CheckboxListTile, 'Transliteration'));
      await tester.pump();

      expect(find.text('Reading settings'), findsOneWidget);
    });
  });

  group('the Reading settings sheet — story mode', () {
    testWidgets('verse by verse offers Hide; story swaps it for the part to tell it in and numbers', (tester) async {
      await _openSheet(tester);
      expect(find.text('Hide in verses'), findsOneWidget);
      expect(find.text('Story shows'), findsNothing);

      await tester.tap(find.text('Story'));
      await tester.pumpAndSettle();

      expect(find.text('Hide in verses'), findsNothing);
      expect(find.text('Story shows'), findsOneWidget);
      expect(find.widgetWithText(ChoiceChip, 'Meaning'), findsOneWidget);
      expect(find.text('Verse numbers'), findsOneWidget);
      expect(_container(tester).read(readingModeProvider), ReadingMode.story);
    });

    testWidgets('picking a part and turning numbers off are applied at once', (tester) async {
      await _openSheet(tester);
      await tester.tap(find.text('Story'));
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(ChoiceChip, 'Purport'));
      await tester.pump();
      await tester.tap(find.byType(SwitchListTile));
      await tester.pump();

      expect(_container(tester).read(storyPartProvider), StoryPart.purport);
      expect(_container(tester).read(storyNumbersProvider), isFalse);
    });
  });

  // The real notifier against the real store. Plain tests, so the writes run on
  // real time.
  group('what is hidden is remembered on the device', () {
    late Directory dir;

    setUpAll(() async {
      dir = await Directory.systemTemp.createTemp('hariharibol_hidden');
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
        const MethodChannel('plugins.flutter.io/path_provider'),
        (call) async => dir.path,
      );
      await LocalStore.instance.init();
    });

    tearDownAll(() async {
      await Hive.close();
      if (dir.existsSync()) dir.deleteSync(recursive: true);
    });

    setUp(() => LocalStore.instance.clear());

    test('nothing is hidden until the reader hides it', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      expect(container.read(hiddenVersePartsProvider), isEmpty);
    });

    test('hiding a part is written to the device, one key per part', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      await container.read(hiddenVersePartsProvider.notifier).set(VersePart.purport, hidden: true);

      expect(container.read(hiddenVersePartsProvider), {VersePart.purport});
      expect(LocalStore.instance.read<bool>(BoxKeys.readingHiddenPart('purport')), isTrue);
      expect(LocalStore.instance.read<bool>(BoxKeys.readingHiddenPart('sanskrit')), isNull);
    });

    test('a later session starts the way it was left', () async {
      final first = ProviderContainer();
      await first.read(hiddenVersePartsProvider.notifier).set(VersePart.sanskrit, hidden: true);
      await first.read(hiddenVersePartsProvider.notifier).set(VersePart.wordMeanings, hidden: true);
      await first.read(hiddenVersePartsProvider.notifier).set(VersePart.sanskrit, hidden: false);
      first.dispose();

      final second = ProviderContainer();
      addTearDown(second.dispose);
      expect(second.read(hiddenVersePartsProvider), {VersePart.wordMeanings});
    });
  });
}
