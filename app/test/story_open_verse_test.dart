// A verse tapped open in story mode: the chapter keeps running as a story, and the
// one verse becomes the verse-by-verse layout in full (Sanskrit, word meanings,
// purport) until it is folded back.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hariharibol/core/navigation/app_navigator.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/core/theme/app_typography.dart' show ReadingFontSize;
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/book.dart';
import 'package:hariharibol/models/language_settings.dart';
import 'package:hariharibol/models/reading_mode.dart';
import 'package:hariharibol/models/verse.dart';
import 'package:hariharibol/models/verse_part.dart';
import 'package:hariharibol/providers/book_provider.dart';
import 'package:hariharibol/providers/language_settings_provider.dart';
import 'package:hariharibol/providers/reading_audio_provider.dart';
import 'package:hariharibol/providers/reading_prefs_provider.dart';
import 'package:hariharibol/services/audio/interruption_policy.dart';
import 'package:hariharibol/services/audio/reading_audio.dart';
import 'package:hariharibol/services/audio/reading_memory.dart';
import 'package:hariharibol/services/audio/reading_playback_controller.dart';
import 'package:hariharibol/services/reading_place_store.dart';
import 'package:hariharibol/views/library/chapter_read_view.dart';
import 'package:hariharibol/widgets/library/story_verse.dart';
import 'package:hariharibol/widgets/library/verse_block.dart';

import 'reading_playback_test.dart' show FakeAudio, FakePlayer;
import 'support/story_fakes.dart';

const _chapter = BookSection(id: 'ch2', number: 2, title: 'Contents of the Gita Summarized', totalVerses: 3);

Verse _verse(int n) => Verse(
      id: 'v$n',
      verseId: '1.2.$n',
      bookNumber: 1,
      type: 'SHLOKA',
      verseNumber: n,
      sanskrit: 'श्लोक $n',
      wordMeanings: [WordMeaning(word: 'śabda$n', meaning: 'arth$n')],
      translation: VerseTranslation(
        id: 't$n',
        languageCode: 'en',
        type: 'TRANSLATION',
        meaning: 'Meaning of verse $n',
        purport: 'Purport of verse $n',
      ),
    );

class _LanguagesInMemory extends LanguageSettingsNotifier {
  @override
  LanguageSettings build() => const LanguageSettings(app: 'en', reading: 'en', speaking: 'en');
}

class _FontInMemory extends ReadingFontSizeNotifier {
  @override
  ReadingFontSize build() => ReadingFontSize.medium;
}

/// The reader has hidden the Sanskrit; a verse tapped open shows it anyway.
class _SanskritHidden extends HiddenVersePartsNotifier {
  @override
  Set<VersePart> build() => {VersePart.sanskrit};
}

class _WordMeaningsInMemory extends WordMeaningsOpenNotifier {
  @override
  bool build() => false;
}

Widget _reader({ReadingMode mode = ReadingMode.story}) {
  final log = <String>[];
  final controller = ReadingPlaybackController(
    player: FakePlayer(log),
    audio: FakeAudio(log),
    memory: InMemoryReadingMemory(),
  );
  final audio = ReadingAudio(
    controller: controller,
    session: ReadingAudioSession(InterruptionPolicy(controller)),
  );
  final router = GoRouter(
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const ChapterReadView(slug: 'bhagavad-gita', number: 2),
      ),
    ],
  );
  AppNavigator.instance.attach(router);

  return ProviderScope(
    overrides: [
      languageSettingsProvider.overrideWith(_LanguagesInMemory.new),
      readingAudioProvider.overrideWithValue(audio),
      readingFontSizeProvider.overrideWith(_FontInMemory.new),
      hiddenVersePartsProvider.overrideWith(_SanskritHidden.new),
      readingModeProvider.overrideWith(() => StoryModeInMemory(mode)),
      storyPartProvider.overrideWith(StoryPartInMemory.new),
      storyNumbersProvider.overrideWith(StoryNumbersInMemory.new),
      wordMeaningsOpenProvider.overrideWith(_WordMeaningsInMemory.new),
      chapterReadingProvider.overrideWith(
        (ref, args) async => ChapterReading(chapter: _chapter, verses: [for (var n = 1; n <= 3; n++) _verse(n)]),
      ),
      bookChaptersProvider.overrideWith((ref, args) async => const [_chapter]),
      bookCantosProvider.overrideWith((ref, slug) async => const []),
    ],
    child: MaterialApp.router(
      theme: AppTheme.light,
      routerConfig: router,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
    ),
  );
}

/// Closes the reader and lets the progress it sends on the way out finish.
Future<void> _leave(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  for (var i = 0; i < 5; i++) {
    await tester.pump(const Duration(milliseconds: 10));
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(ReadingPlaceStore.keepInMemory);
  tearDown(ReadingPlaceStore.keepInStore);

  testWidgets('a story is running text until a verse is tapped', (tester) async {
    await tester.pumpWidget(_reader());
    await tester.pumpAndSettle();

    expect(find.byType(StoryVerse), findsNWidgets(3));
    expect(find.byType(VerseBlock), findsNothing);
    expect(find.text('श्लोक 2'), findsNothing);
    await _leave(tester);
  });

  testWidgets('tapping a verse opens that one in full, even a part the reader hid', (tester) async {
    await tester.pumpWidget(_reader());
    await tester.pumpAndSettle();

    await tester.tap(find.textContaining('Meaning of verse 2', findRichText: true));
    await tester.pumpAndSettle();

    expect(find.byType(VerseBlock), findsOneWidget);
    expect(find.byType(StoryVerse), findsNWidgets(2), reason: 'the other verses stay in the story');
    expect(find.text('श्लोक 2'), findsOneWidget, reason: 'the Sanskrit is hidden in the settings, but the reader asked for this verse');
    expect(find.text('Word meanings'), findsOneWidget);
    expect(find.text('श्लोक 1'), findsNothing);
    await _leave(tester);
  });

  testWidgets('the button on an opened verse folds it back into the story', (tester) async {
    await tester.pumpWidget(_reader());
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining('Meaning of verse 2', findRichText: true));
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.unfold_less_rounded));
    await tester.pumpAndSettle();

    expect(find.byType(VerseBlock), findsNothing);
    expect(find.byType(StoryVerse), findsNWidgets(3));
    await _leave(tester);
  });

  testWidgets('several verses can be open at once', (tester) async {
    await tester.pumpWidget(_reader());
    await tester.pumpAndSettle();

    await tester.tap(find.textContaining('Meaning of verse 1', findRichText: true));
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining('Meaning of verse 3', findRichText: true));
    await tester.pumpAndSettle();

    expect(find.byType(VerseBlock), findsNWidgets(2));
    expect(find.byType(StoryVerse), findsOneWidget);
    await _leave(tester);
  });

  testWidgets('the verse-by-verse layout has no collapse button of its own', (tester) async {
    await tester.pumpWidget(_reader(mode: ReadingMode.verses));
    await tester.pumpAndSettle();

    expect(find.byType(VerseBlock), findsWidgets);
    expect(find.byIcon(Icons.unfold_less_rounded), findsNothing);
    await _leave(tester);
  });
}
