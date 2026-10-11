import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/constants/storage_keys.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/verse.dart';
import 'package:hariharibol/providers/reading_prefs_provider.dart';
import 'package:hariharibol/services/local_store.dart';
import 'package:hariharibol/widgets/library/verse_block.dart';
import 'package:hive_ce_flutter/hive_flutter.dart';

const _translation = VerseTranslation(
  id: 't',
  languageCode: 'en',
  type: 'TRANSLATION',
  meaning: 'Dhritarashtra said: what did my sons do?',
);

const _words = [
  WordMeaning(word: 'dharma-kṣetre', meaning: 'in the place of pilgrimage'),
  WordMeaning(word: 'kuru-kṣetre', meaning: 'in the place named Kurukṣetra'),
  WordMeaning(meaning: 'a meaning the source gave no word for'),
];

Verse _verse({List<WordMeaning> words = _words, String? sanskrit = 'धर्मक्षेत्रे कुरुक्षेत्रे'}) => Verse(
      id: 'v',
      verseId: '1.1.1',
      bookNumber: 1,
      type: 'SHLOKA',
      verseNumber: 1,
      sanskrit: sanskrit,
      transliteration: 'dharma-kṣetre kuru-kṣetre',
      wordMeanings: words,
      translation: _translation,
    );

/// "Word meanings" held in memory, so the widget tests do not wait on the disk
/// (a save started inside a widget test's fake clock never finishes there). That
/// the real one is written to and read from the device is tested below.
class _OpenInMemory extends WordMeaningsOpenNotifier {
  _OpenInMemory(this._initial);

  final bool _initial;

  @override
  bool build() => _initial;

  @override
  Future<void> set(bool open) async => state = open;
}

Widget _app(Verse verse, {bool open = false}) => _appOf([verse], open: open);

Widget _appOf(List<Verse> verses, {bool open = false}) => ProviderScope(
      overrides: [wordMeaningsOpenProvider.overrideWith(() => _OpenInMemory(open))],
      child: MaterialApp(
        theme: AppTheme.light,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: SingleChildScrollView(
            child: Column(
              children: [
                for (final verse in verses)
                  VerseBlock(
                    verse: verse,
                    fontScale: 1,
                    isFavorite: false,
                    isHighlighted: false,
                    noteCount: 0,
                    onToggleFavorite: () {},
                    onToggleHighlight: () {},
                    onOpenNotes: () {},
                    onOpenRelated: () {},
                  ),
              ],
            ),
          ),
        ),
      ),
    );

Future<void> _toggle(WidgetTester tester) async {
  await tester.tap(find.text('Word meanings'));
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('a verse with word meanings', () {
    testWidgets('shows the heading and keeps the words shut until opened', (tester) async {
      await tester.pumpWidget(_app(_verse()));

      expect(find.text('Word meanings'), findsOneWidget);
      expect(find.text('dharma-kṣetre'), findsNothing);
      expect(find.text('in the place of pilgrimage'), findsNothing);
    });

    testWidgets('opens to one row for each word', (tester) async {
      await tester.pumpWidget(_app(_verse()));
      await _toggle(tester);

      expect(find.text('dharma-kṣetre'), findsOneWidget);
      expect(find.text('in the place of pilgrimage'), findsOneWidget);
      expect(find.text('kuru-kṣetre'), findsOneWidget);
      expect(find.text('in the place named Kurukṣetra'), findsOneWidget);
    });

    testWidgets('a word with no Sanskrit shows only its meaning', (tester) async {
      await tester.pumpWidget(_app(_verse()));
      await _toggle(tester);

      expect(find.text('a meaning the source gave no word for'), findsOneWidget);
      // No dash and no blank cell stands in for the missing word.
      expect(find.textContaining('—'), findsNothing);
    });

    testWidgets('closes again when tapped a second time', (tester) async {
      await tester.pumpWidget(_app(_verse()));
      await _toggle(tester);
      await _toggle(tester);

      expect(find.text('dharma-kṣetre'), findsNothing);
    });

    testWidgets('sits between the transliteration and the translation', (tester) async {
      await tester.pumpWidget(_app(_verse()));

      final script = tester.getTopLeft(find.text('धर्मक्षेत्रे कुरुक्षेत्रे')).dy;
      final transliteration = tester.getTopLeft(find.text('dharma-kṣetre kuru-kṣetre')).dy;
      final words = tester.getTopLeft(find.text('Word meanings')).dy;
      final meaning = tester.getTopLeft(find.textContaining('Dhritarashtra said')).dy;

      expect(script, lessThan(transliteration));
      expect(transliteration, lessThan(words));
      expect(words, lessThan(meaning));
    });

    testWidgets('is still there when the verse has no Devanagari', (tester) async {
      await tester.pumpWidget(_app(_verse(sanskrit: null)));

      expect(find.text('Word meanings'), findsOneWidget);
    });
  });

  group('whether it is open', () {
    testWidgets('a verse built while the reader has it open starts open', (tester) async {
      await tester.pumpWidget(_app(_verse(), open: true));

      expect(find.text('dharma-kṣetre'), findsOneWidget);
    });

    testWidgets('closing it from open shuts the words again', (tester) async {
      await tester.pumpWidget(_app(_verse(), open: true));
      await _toggle(tester);

      expect(find.text('dharma-kṣetre'), findsNothing);
    });

    testWidgets('opening one verse opens every verse', (tester) async {
      final other = _verse(words: const [WordMeaning(word: 'atha', meaning: 'now')]);
      await tester.pumpWidget(_appOf([_verse(), other]));
      expect(find.text('atha'), findsNothing);

      await tester.tap(find.text('Word meanings').first);
      await tester.pumpAndSettle();

      expect(find.text('dharma-kṣetre'), findsOneWidget);
      expect(find.text('atha'), findsOneWidget);
    });
  });

  group('a verse without word meanings', () {
    testWidgets('has no section at all', (tester) async {
      await tester.pumpWidget(_app(_verse(words: const [])));

      expect(find.text('Word meanings'), findsNothing);
      // The rest of the verse is untouched.
      expect(find.text('dharma-kṣetre kuru-kṣetre'), findsOneWidget);
      expect(find.textContaining('Dhritarashtra said'), findsOneWidget);
    });

    testWidgets('has none even when the reader has it open everywhere', (tester) async {
      await tester.pumpWidget(_app(_verse(words: const []), open: true));

      expect(find.text('Word meanings'), findsNothing);
    });

    testWidgets('and one with no Devanagari either shows just what it has', (tester) async {
      await tester.pumpWidget(_app(_verse(words: const [], sanskrit: null)));

      expect(find.text('Word meanings'), findsNothing);
      expect(find.text('dharma-kṣetre kuru-kṣetre'), findsOneWidget);
    });
  });

  // The real notifier against the real store. Plain tests, so the writes run on
  // real time.
  group('whether it is open is remembered on the device', () {
    late Directory dir;

    setUpAll(() async {
      dir = await Directory.systemTemp.createTemp('hariharibol_words');
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

    test('is shut until the reader opens it', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      expect(container.read(wordMeaningsOpenProvider), isFalse);
    });

    test('opening it is written to the device', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      await container.read(wordMeaningsOpenProvider.notifier).set(true);

      expect(container.read(wordMeaningsOpenProvider), isTrue);
      expect(LocalStore.instance.read<bool>(BoxKeys.wordMeaningsOpen), isTrue);
    });

    test('a later session starts the way it was left', () async {
      final first = ProviderContainer();
      await first.read(wordMeaningsOpenProvider.notifier).set(true);
      first.dispose();

      final second = ProviderContainer();
      addTearDown(second.dispose);
      expect(second.read(wordMeaningsOpenProvider), isTrue);
    });

    test('closing it is remembered too', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      await container.read(wordMeaningsOpenProvider.notifier).set(true);
      await container.read(wordMeaningsOpenProvider.notifier).set(false);

      expect(LocalStore.instance.read<bool>(BoxKeys.wordMeaningsOpen), isFalse);
      expect(ProviderContainer().read(wordMeaningsOpenProvider), isFalse);
    });
  });
}
