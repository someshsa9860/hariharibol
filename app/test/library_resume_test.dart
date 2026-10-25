import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hariharibol/core/navigation/app_navigator.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/core/theme/app_typography.dart' show ReadingFontSize;
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/book.dart';
import 'package:hariharibol/models/language_settings.dart';
import 'package:hariharibol/models/reading_place.dart';
import 'package:hariharibol/models/verse.dart';
import 'package:hariharibol/models/verse_part.dart';
import 'package:hariharibol/providers/book_provider.dart';
import 'package:hariharibol/providers/language_settings_provider.dart';
import 'package:hariharibol/providers/reading_audio_provider.dart';
import 'package:hariharibol/providers/reading_place_provider.dart';
import 'package:hariharibol/providers/reading_prefs_provider.dart';
import 'support/story_fakes.dart';
import 'package:hariharibol/services/audio/interruption_policy.dart';
import 'package:hariharibol/services/audio/reading_audio.dart';
import 'package:hariharibol/services/audio/reading_memory.dart';
import 'package:hariharibol/services/audio/reading_playback_controller.dart';
import 'package:hariharibol/models/reading_mode.dart';
import 'package:hariharibol/services/reading_place_store.dart';
import 'package:hariharibol/widgets/library/story_verse.dart';
import 'package:hariharibol/views/dashboard/library_tab.dart';
import 'package:hariharibol/views/library/chapter_read_view.dart';
import 'package:hariharibol/widgets/dashboard/book_card.dart';
import 'package:hariharibol/widgets/library/last_read_tile.dart';

import 'reading_playback_test.dart' show FakeAudio, FakePlayer;

const _gita = Book(
  id: 'gita',
  slug: 'bhagavad-gita',
  title: 'Bhagavad-gita As It Is',
  bookNumber: 1,
  type: 'SCRIPTURE',
  totalChapters: 18,
  totalVerses: 700,
);

const _bhagavatam = Book(
  id: 'sb',
  slug: 'srimad-bhagavatam',
  title: 'Srimad Bhagavatam',
  bookNumber: 2,
  type: 'SCRIPTURE',
  totalCantos: 12,
  totalChapters: 335,
  totalVerses: 14000,
);

/// A shell with no verses: it cannot be read, so it is not offered as a book to
/// be "not started".
const _empty = Book(id: 'empty', slug: 'empty', title: 'Empty shell', bookNumber: 3, type: 'STOTRA');

const _notStarted = 'Not started yet. Tap to begin.';

/// Language settings held in memory: a write started inside a widget test's fake
/// clock never finishes (see "The routine tab" in app/CLAUDE.md).
class _LanguagesInMemory extends LanguageSettingsNotifier {
  @override
  LanguageSettings build() => const LanguageSettings(app: 'en', reading: 'en', speaking: 'en');
}

class _FontInMemory extends ReadingFontSizeNotifier {
  @override
  ReadingFontSize build() => ReadingFontSize.medium;
}

class _HiddenInMemory extends HiddenVersePartsNotifier {
  @override
  Set<VersePart> build() => {};
}

class _WordMeaningsInMemory extends WordMeaningsOpenNotifier {
  @override
  bool build() => false;
}

/// Where a push landed, drawn as text so a test can read it.
class _Landed extends StatelessWidget {
  const _Landed(this.location);

  final String location;

  @override
  Widget build(BuildContext context) => Scaffold(body: Text('landed:$location'));
}

Widget _app(Widget home, {List<Book> books = const [_gita, _bhagavatam], List<Override> overrides = const []}) {
  final router = GoRouter(
    routes: [
      GoRoute(path: '/', builder: (context, state) => home),
      GoRoute(
        path: '/library/:slug',
        builder: (context, state) => _Landed(state.uri.toString()),
      ),
      GoRoute(
        path: '/library/:slug/chapters/:number',
        builder: (context, state) => _Landed(state.uri.toString()),
      ),
    ],
  );
  AppNavigator.instance.attach(router);

  return ProviderScope(
    overrides: [
      languageSettingsProvider.overrideWith(_LanguagesInMemory.new),
      booksProvider.overrideWith((ref) => Stream.value(books)),
      ...overrides,
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

ProviderContainer _container(WidgetTester tester) =>
    ProviderScope.containerOf(tester.element(find.byType(Scaffold).first));

String _landed(WidgetTester tester) {
  final text = tester.widget<Text>(find.textContaining('landed:'));
  return text.data!.substring('landed:'.length);
}

// --- the reader ---------------------------------------------------------------

Verse _verse(int n) => Verse(
  id: 'v$n',
  verseId: '1.2.$n',
  bookNumber: 1,
  type: 'SHLOKA',
  verseNumber: n,
  sanskrit: 'श्लोक $n',
);

const _chapter = BookSection(id: 'ch2', number: 2, title: 'Contents of the Gita Summarized', totalVerses: 30);

const _chapterOne = BookSection(id: 'ch1', number: 1, title: 'Observing the Armies', totalVerses: 46);

Widget _reader({
  int? targetVerse,
  int verses = 30,
  ReadingMode mode = ReadingMode.verses,
  List<BookSection> chapters = const [_chapter],
}) {
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

  return _app(
    ChapterReadView(slug: 'bhagavad-gita', number: 2, targetVerseNumber: targetVerse),
    overrides: [
      readingAudioProvider.overrideWithValue(audio),
      readingFontSizeProvider.overrideWith(_FontInMemory.new),
      hiddenVersePartsProvider.overrideWith(_HiddenInMemory.new),
      readingModeProvider.overrideWith(() => StoryModeInMemory(mode)),
      storyPartProvider.overrideWith(StoryPartInMemory.new),
      storyNumbersProvider.overrideWith(StoryNumbersInMemory.new),
      wordMeaningsOpenProvider.overrideWith(_WordMeaningsInMemory.new),
      chapterReadingProvider.overrideWith(
        (ref, args) async => ChapterReading(chapter: _chapter, verses: [for (var n = 1; n <= verses; n++) _verse(n)]),
      ),
      bookChaptersProvider.overrideWith((ref, args) async => chapters),
      bookCantosProvider.overrideWith((ref, slug) async => const []),
    ],
  );
}

/// Closes the reader and lets the progress it sends on the way out finish.
/// Leaving a chapter at any verse but the first tells the account (a request the
/// test's HTTP stub refuses, which the reader ignores); a test that ended with
/// the screen still up would have that request's timer left over.
Future<void> _leave(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  for (var i = 0; i < 5; i++) {
    await tester.pump(const Duration(milliseconds: 10));
  }
}

ReadingPlace? _placeIn(WidgetTester tester) =>
    _container(tester).read(readingPlacesProvider)['bhagavad-gita'];

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(ReadingPlaceStore.keepInMemory);
  tearDown(ReadingPlaceStore.keepInStore);

  group('the saved place', () {
    test('survives being written and read back', () {
      ReadingPlaceStore.writeAll({
        'srimad-bhagavatam': const ReadingPlace(canto: 2, chapter: 10, verse: 4),
        'bhagavad-gita': const ReadingPlace(chapter: 2, verse: 47),
      });

      final places = ReadingPlaceStore.readAll();
      expect(places['srimad-bhagavatam'], const ReadingPlace(canto: 2, chapter: 10, verse: 4));
      expect(places['bhagavad-gita'], const ReadingPlace(chapter: 2, verse: 47));
      expect(places['bhagavad-gita']!.canto, isNull, reason: 'the Gita has no canto level');
    });

    test('a stored entry that names no chapter is dropped, not a crash', () {
      expect(ReadingPlace.fromJson({'verse': 3}), isNull);
      expect(ReadingPlace.fromJson({'chapter': 0, 'verse': 3}), isNull);
      expect(ReadingPlace.fromJson('nonsense'), isNull);
      expect(ReadingPlace.fromJson({'chapter': 5})!.verse, 1, reason: 'no verse starts at the first');
    });

    test('the provider remembers a place and does not write one it already has', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(readingPlacesProvider.notifier);

      notifier.remember('bhagavad-gita', const ReadingPlace(chapter: 2, verse: 5));
      expect(container.read(readingPlacesProvider)['bhagavad-gita']!.verse, 5);

      // Overwrite the store behind its back: an identical place must not touch it.
      ReadingPlaceStore.writeAll({});
      notifier.remember('bhagavad-gita', const ReadingPlace(chapter: 2, verse: 5));
      expect(ReadingPlaceStore.readAll(), isEmpty);

      notifier.remember('bhagavad-gita', const ReadingPlace(chapter: 2, verse: 6));
      expect(ReadingPlaceStore.readAll()['bhagavad-gita']!.verse, 6);
    });

    test('a new provider scope starts from what was saved', () {
      ReadingPlaceStore.writeAll({'bhagavad-gita': const ReadingPlace(chapter: 3, verse: 9)});

      final container = ProviderContainer();
      addTearDown(container.dispose);

      expect(container.read(readingPlacesProvider)['bhagavad-gita'], const ReadingPlace(chapter: 3, verse: 9));
    });
  });

  group('the Read tab', () {
    testWidgets('says plainly that a book has not been started, for each book', (tester) async {
      await tester.pumpWidget(_app(const LibraryTab()));
      await tester.pumpAndSettle();

      expect(find.text('Continue reading'), findsOneWidget);
      expect(find.byType(LastReadTile), findsNWidgets(2));
      expect(find.text(_notStarted), findsNWidgets(2));
      expect(find.text('Recent favourites'), findsNothing);
      expect(find.text('No favourites yet'), findsNothing);
    });

    testWidgets('shows where the reader is in both books, canto and all', (tester) async {
      ReadingPlaceStore.writeAll({
        'bhagavad-gita': const ReadingPlace(chapter: 2, verse: 47),
        'srimad-bhagavatam': const ReadingPlace(canto: 2, chapter: 10, verse: 4),
      });
      await tester.pumpWidget(_app(const LibraryTab()));
      await tester.pumpAndSettle();

      expect(find.text('Chapter 2 · Verse 47'), findsOneWidget);
      expect(find.text('Canto 2 · Chapter 10 · Verse 4'), findsOneWidget);
      expect(find.text(_notStarted), findsNothing);
    });

    testWidgets('a book read and a book not read each say so', (tester) async {
      ReadingPlaceStore.writeAll({'bhagavad-gita': const ReadingPlace(chapter: 1, verse: 1)});
      await tester.pumpWidget(_app(const LibraryTab()));
      await tester.pumpAndSettle();

      expect(find.text('Chapter 1 · Verse 1'), findsOneWidget);
      expect(find.text(_notStarted), findsOneWidget);
    });

    testWidgets('a book with nothing in it is listed but not offered as unstarted', (tester) async {
      await tester.pumpWidget(_app(const LibraryTab(), books: const [_gita, _empty]));
      await tester.pumpAndSettle();

      expect(find.byType(LastReadTile), findsOneWidget);
      expect(find.byType(BookCard), findsNWidgets(2));
    });

    testWidgets('the books and where the reader is arrive in the same frame', (tester) async {
      ReadingPlaceStore.writeAll({'bhagavad-gita': const ReadingPlace(chapter: 2, verse: 47)});
      await tester.pumpWidget(_app(const LibraryTab()));

      // The first frame in which a book can be drawn is also the first with the
      // reader's place: nothing arrives a beat after the rest.
      for (var i = 0; i < 20 && find.byType(BookCard).evaluate().isEmpty; i++) {
        await tester.pump(const Duration(milliseconds: 10));
      }
      expect(find.byType(BookCard), findsWidgets);
      expect(find.text('Chapter 2 · Verse 47'), findsOneWidget);
      await tester.pumpAndSettle();
    });

    testWidgets('tapping a book where the reader stopped opens that chapter at that verse', (tester) async {
      ReadingPlaceStore.writeAll({
        'bhagavad-gita': const ReadingPlace(chapter: 2, verse: 47),
        'srimad-bhagavatam': const ReadingPlace(canto: 2, chapter: 10, verse: 4),
      });
      await tester.pumpWidget(_app(const LibraryTab()));
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(BookCard, 'Bhagavad-gita As It Is'));
      await tester.pumpAndSettle();
      expect(_landed(tester), '/library/bhagavad-gita/chapters/2?verse=47');

      AppNavigator.instance.pop();
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(LastReadTile, 'Srimad Bhagavatam'));
      await tester.pumpAndSettle();
      expect(_landed(tester), '/library/srimad-bhagavatam/chapters/10?canto=2&verse=4');
    });

    testWidgets('tapping a book never opened opens its own page to choose from', (tester) async {
      await tester.pumpWidget(_app(const LibraryTab()));
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(BookCard, 'Srimad Bhagavatam'));
      await tester.pumpAndSettle();
      expect(_landed(tester), '/library/srimad-bhagavatam');

      AppNavigator.instance.pop();
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(LastReadTile, 'Bhagavad-gita As It Is'));
      await tester.pumpAndSettle();
      expect(_landed(tester), '/library/bhagavad-gita');
    });
  });

  group('the reader remembers the place', () {
    testWidgets('a chapter opened from the top is remembered at its first verse', (tester) async {
      await tester.pumpWidget(_reader());
      await tester.pumpAndSettle();

      expect(_placeIn(tester), const ReadingPlace(chapter: 2, verse: 1));
    });

    testWidgets('a chapter opened at a verse is remembered at that verse, and stays there', (tester) async {
      await tester.pumpWidget(_reader(targetVerse: 12));
      await tester.pumpAndSettle();

      // Scrolling to the verse is not the reader scrolling: it must not nudge the
      // place a verse back, or every reopening would lose ground.
      expect(_placeIn(tester), const ReadingPlace(chapter: 2, verse: 12));
      expect(find.text('श्लोक 12'), findsOneWidget);
      await _leave(tester);
    });

    testWidgets('read as a story, the chapter lands on the verse it was sent to and remembers it', (tester) async {
      await tester.pumpWidget(_reader(targetVerse: 12, mode: ReadingMode.story));
      await tester.pumpAndSettle();

      // Story mode shows the meaning by default; this fixture has none, so the
      // chip row says so, and the verses stay in the list with their keys.
      expect(find.byType(StoryVerse), findsWidgets);
      expect(find.byType(Divider), findsNothing, reason: 'verses run on, with nothing drawn between them');
      expect(_placeIn(tester), const ReadingPlace(chapter: 2, verse: 12));
      await _leave(tester);
    });

    testWidgets('scrolling by hand and stopping remembers the verse the reader reached', (tester) async {
      await tester.pumpWidget(_reader());
      await tester.pumpAndSettle();
      expect(_placeIn(tester)!.verse, 1);

      await tester.fling(find.byType(ListView), const Offset(0, -900), 1500);
      await tester.pumpAndSettle();
      final partway = _placeIn(tester)!.verse;
      expect(partway, greaterThan(1));

      await tester.fling(find.byType(ListView), const Offset(0, -100000), 4000);
      await tester.pumpAndSettle();
      expect(_placeIn(tester)!.verse, greaterThan(partway));

      await tester.fling(find.byType(ListView), const Offset(0, 100000), 4000);
      await tester.pumpAndSettle();
      expect(_placeIn(tester)!.verse, 1, reason: 'back at the top it is the first verse again');
    });

    testWidgets('the verse remembered is one that is on the screen', (tester) async {
      await tester.pumpWidget(_reader());
      await tester.pumpAndSettle();

      await tester.fling(find.byType(ListView), const Offset(0, -2500), 2000);
      await tester.pumpAndSettle();

      final verse = _placeIn(tester)!.verse;
      expect(find.text('श्लोक $verse'), findsOneWidget);
      await _leave(tester);
    });

    testWidgets('Contents lists the chapters over the reader, and the one picked replaces it', (tester) async {
      await tester.pumpWidget(_reader(chapters: const [_chapterOne, _chapter]));
      await tester.pumpAndSettle();

      await tester.tap(find.byTooltip('Contents'));
      await tester.pumpAndSettle();
      expect(find.text('READING NOW'), findsOneWidget);

      await tester.tap(find.text('Observing the Armies'));
      await tester.pumpAndSettle();

      expect(_landed(tester), '/library/bhagavad-gita/chapters/1');
      // Replaced, not pushed: back leads where the reader came from, not to chapter 2.
      expect(AppNavigator.instance.canPop, isFalse);
      await _leave(tester);
    });
  });
}
