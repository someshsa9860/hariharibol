import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/api_failure.dart';
import 'package:hariharibol/models/book.dart';
import 'package:hariharibol/models/language_settings.dart';
import 'package:hariharibol/providers/book_provider.dart';
import 'package:hariharibol/providers/book_sync_provider.dart';
import 'package:hariharibol/providers/language_settings_provider.dart';
import 'package:hariharibol/views/library/book_detail_view.dart';
import 'package:hariharibol/views/library/chapter_list_view.dart';

/// Language settings held in memory: a write started inside a widget test's
/// fake clock never finishes (see "The routine tab" in app/CLAUDE.md).
class _LanguagesInMemory extends LanguageSettingsNotifier {
  @override
  LanguageSettings build() => const LanguageSettings(app: 'en', reading: 'mr', speaking: 'en');

  @override
  Future<void> setReading(String code) async => state = state.copyWith(reading: code);
}

const _gita = Book(
  id: 'gita',
  slug: 'bhagavad-gita',
  title: 'Bhagavad-gita As It Is',
  bookNumber: 1,
  type: 'SCRIPTURE',
  description: 'The Song of God',
  titleI18n: {'en': 'Bhagavad-gita As It Is', 'mr': 'भगवद्गीता', 'hi': 'भगवद्गीता'},
  descriptionI18n: {'en': 'The Song of God', 'mr': 'भगवंताचे गीत'},
  totalChapters: 2,
  totalVerses: 119,
);

const _bhagavatam = Book(
  id: 'sb',
  slug: 'srimad-bhagavatam',
  title: 'Srimad Bhagavatam',
  bookNumber: 2,
  type: 'SCRIPTURE',
  titleI18n: {'en': 'Srimad Bhagavatam', 'mr': 'श्रीमद्भागवतम्'},
  totalCantos: 2,
  totalChapters: 4,
  totalVerses: 300,
);

const _gitaChapters = [
  BookSection(
    id: 'g1',
    number: 1,
    title: 'Observing the Armies',
    titleI18n: {'en': 'Observing the Armies', 'mr': 'अर्जुनविषादयोग', 'hi': 'अर्जुनविषादयोग'},
    totalVerses: 46,
  ),
  BookSection(
    id: 'g2',
    number: 2,
    title: 'Contents of the Gita Summarized',
    titleI18n: {'en': 'Contents of the Gita Summarized', 'mr': 'सांख्ययोग'},
    totalVerses: 73,
  ),
];

const _cantos = [
  BookSection(
    id: 'c1',
    number: 1,
    title: 'Creation',
    titleI18n: {'en': 'Creation', 'mr': 'सृष्टी'},
    totalChapters: 2,
    totalVerses: 180,
  ),
  BookSection(
    id: 'c2',
    number: 2,
    title: 'The Cosmic Manifestation',
    titleI18n: {'en': 'The Cosmic Manifestation'},
    totalChapters: 2,
    totalVerses: 120,
  ),
];

const _cantoChapters = [
  BookSection(id: 's1', number: 1, cantoNumber: 1, title: 'Questions by the Sages', totalVerses: 23),
  BookSection(id: 's2', number: 2, cantoNumber: 1, title: 'Divinity and Divine Service', totalVerses: 34),
];

Widget _app(
  Widget home, {
  List<BookSection>? cantos,
  Object? cantosError,
  List<BookSection>? gitaChapters,
}) =>
    ProviderScope(
      overrides: [
        languageSettingsProvider.overrideWith(_LanguagesInMemory.new),
        bookDetailProvider.overrideWith((ref, slug) async => slug == _gita.slug ? _gita : _bhagavatam),
        bookCantosProvider.overrideWith((ref, slug) async {
          if (cantosError != null) throw cantosError;
          return cantos ?? _cantos;
        }),
        bookChaptersProvider.overrideWith(
          (ref, args) async => args.canto == null ? (gitaChapters ?? _gitaChapters) : _cantoChapters,
        ),
        bookSyncSummaryProvider.overrideWith((ref, bookId) => const Stream.empty()),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: home,
      ),
    );

ProviderContainer _container(WidgetTester tester) =>
    ProviderScope.containerOf(tester.element(find.byType(Scaffold).first));

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('the book screen', () {
    testWidgets('names the book and its chapters in the reading language', (tester) async {
      await tester.pumpWidget(_app(const BookDetailView(slug: 'bhagavad-gita')));
      await tester.pumpAndSettle();

      expect(find.text('भगवद्गीता'), findsOneWidget);
      expect(find.text('भगवंताचे गीत'), findsOneWidget);
      expect(find.text('अर्जुनविषादयोग'), findsOneWidget);
      expect(find.text('सांख्ययोग'), findsOneWidget);
      expect(find.text('Observing the Armies'), findsNothing);
    });

    testWidgets('says how big the book and each chapter are', (tester) async {
      await tester.pumpWidget(_app(const BookDetailView(slug: 'bhagavad-gita')));
      await tester.pumpAndSettle();

      expect(find.text('2 chapters'), findsOneWidget);
      expect(find.text('119 verses'), findsOneWidget);
      expect(find.text('46 verses'), findsOneWidget);
      expect(find.text('73 verses'), findsOneWidget);
      expect(find.textContaining('cantos'), findsNothing, reason: 'the Gita has no canto level');
    });

    testWidgets('a chapter with no title in the language shows the next one in the chain', (tester) async {
      await tester.pumpWidget(_app(const BookDetailView(slug: 'bhagavad-gita')));
      await tester.pumpAndSettle();
      await _container(tester).read(languageSettingsProvider.notifier).setReading('hi');
      await tester.pumpAndSettle();

      // Hindi has chapter 1 only; chapter 2 falls to the app language (English).
      expect(find.text('अर्जुनविषादयोग'), findsOneWidget);
      expect(find.text('Contents of the Gita Summarized'), findsOneWidget);
    });

    testWidgets('changing the reading language re-titles the list without a reload', (tester) async {
      await tester.pumpWidget(_app(const BookDetailView(slug: 'bhagavad-gita')));
      await tester.pumpAndSettle();
      expect(find.text('सांख्ययोग'), findsOneWidget);

      await _container(tester).read(languageSettingsProvider.notifier).setReading('en');
      await tester.pumpAndSettle();

      expect(find.text('सांख्ययोग'), findsNothing);
      expect(find.text('Contents of the Gita Summarized'), findsOneWidget);
      expect(find.text('Bhagavad-gita As It Is'), findsOneWidget);
      expect(find.text('The Song of God'), findsOneWidget);
    });

    testWidgets('lists the cantos of the Bhagavatam, each in the reading language where it has one', (tester) async {
      await tester.pumpWidget(_app(const BookDetailView(slug: 'srimad-bhagavatam')));
      await tester.pumpAndSettle();

      expect(find.text('श्रीमद्भागवतम्'), findsOneWidget);
      expect(find.text('सृष्टी'), findsOneWidget);
      expect(find.text('The Cosmic Manifestation'), findsOneWidget, reason: 'canto 2 has no Marathi title yet');
      expect(find.text('2 cantos'), findsOneWidget);
      expect(find.text('4 chapters'), findsOneWidget);
      expect(find.text('2 chapters'), findsNWidgets(2), reason: 'one per canto row');
    });

    testWidgets('the app bar takes the title, centred, once the heading scrolls under it', (tester) async {
      final many = [
        for (var n = 1; n <= 20; n++) BookSection(id: 'g$n', number: n, title: 'Chapter title $n', totalVerses: 10),
      ];
      final inBar = find.descendant(of: find.byType(AppBar), matching: find.text('भगवद्गीता'));

      await tester.pumpWidget(_app(const BookDetailView(slug: 'bhagavad-gita'), gitaChapters: many));
      await tester.pumpAndSettle();
      expect(inBar, findsNothing, reason: 'the heading is still on the page');

      // Scrolled a little: the heading is still partly in view.
      await tester.drag(find.byType(ListView), const Offset(0, -120));
      await tester.pumpAndSettle();
      expect(inBar, findsNothing);

      await tester.drag(find.byType(ListView), const Offset(0, -400));
      await tester.pumpAndSettle();
      expect(inBar, findsOneWidget);
      final screenCentre = tester.view.physicalSize.width / tester.view.devicePixelRatio / 2;
      expect(tester.getCenter(inBar).dx, closeTo(screenCentre, 1));

      await tester.drag(find.byType(ListView), const Offset(0, 1000));
      await tester.pumpAndSettle();
      expect(inBar, findsNothing, reason: 'back at the top the heading is the title again');
    });

    testWidgets('a row reads as one button naming the chapter, its title and its size', (tester) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(_app(const BookDetailView(slug: 'bhagavad-gita')));
      await tester.pumpAndSettle();

      expect(
        find.bySemanticsLabel('Chapter 1, अर्जुनविषादयोग, 46 verses'),
        findsOneWidget,
      );
      handle.dispose();
    });
  });

  group('a canto\'s chapter list', () {
    testWidgets('opens with the canto\'s title, then the chapters', (tester) async {
      await tester.pumpWidget(_app(const ChapterListView(slug: 'srimad-bhagavatam', canto: 1)));
      await tester.pumpAndSettle();

      expect(find.text('CANTO 1'), findsOneWidget);
      expect(find.text('सृष्टी'), findsOneWidget);
      expect(find.text('180 verses'), findsOneWidget);
      expect(find.text('Questions by the Sages'), findsOneWidget);
      expect(find.text('Divinity and Divine Service'), findsOneWidget);
      expect(find.text('23 verses'), findsOneWidget);
    });

    testWidgets('still lists the chapters when the canto list cannot be loaded', (tester) async {
      await tester.pumpWidget(
        _app(
          const ChapterListView(slug: 'srimad-bhagavatam', canto: 1),
          cantosError: const ApiFailure(kind: FailureKind.network),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Questions by the Sages'), findsOneWidget);
      expect(find.text('CANTO 1'), findsNothing);
    });

    testWidgets('a canto that is not in the list gets no heading, only its chapters', (tester) async {
      await tester.pumpWidget(_app(const ChapterListView(slug: 'srimad-bhagavatam', canto: 7)));
      await tester.pumpAndSettle();

      expect(find.text('Questions by the Sages'), findsOneWidget);
      expect(find.text('CANTO 7'), findsNothing);
    });
  });
}
