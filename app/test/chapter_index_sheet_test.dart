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
import 'package:hariharibol/providers/language_settings_provider.dart';
import 'package:hariharibol/widgets/common/app_error_view.dart';
import 'package:hariharibol/widgets/library/chapter_header.dart';
import 'package:hariharibol/widgets/library/chapter_index_sheet.dart';

/// Reading in Marathi, held in memory (a write started under a widget test's
/// fake clock never finishes).
class _LanguagesInMemory extends LanguageSettingsNotifier {
  @override
  LanguageSettings build() => const LanguageSettings(app: 'en', reading: 'mr', speaking: 'en');
}

const _gitaChapters = [
  BookSection(
    id: 'g1',
    number: 1,
    title: 'Observing the Armies',
    titleI18n: {'en': 'Observing the Armies', 'mr': 'अर्जुनविषादयोग'},
    totalVerses: 46,
  ),
  BookSection(
    id: 'g2',
    number: 2,
    title: 'Contents of the Gita Summarized',
    titleI18n: {'en': 'Contents of the Gita Summarized', 'mr': 'सांख्ययोग'},
    totalVerses: 72,
  ),
];

const _cantos = [
  BookSection(
    id: 'c1',
    number: 1,
    title: 'Creation',
    titleI18n: {'en': 'Creation', 'mr': 'सृष्टी'},
    totalChapters: 2,
    totalVerses: 57,
  ),
  BookSection(id: 'c2', number: 2, title: 'The Cosmic Manifestation', totalChapters: 2, totalVerses: 80),
];

List<BookSection> _cantoChapters(int canto) => [
      BookSection(id: '$canto-1', number: 1, cantoNumber: canto, title: 'Questions by the Sages', totalVerses: 23),
      BookSection(id: '$canto-2', number: 2, cantoNumber: canto, title: 'Divinity and Divine Service', totalVerses: 34),
    ];

List<BookSection> _manyChapters(int count) => [
      for (var n = 1; n <= count; n++) BookSection(id: 'm$n', number: n, title: 'Chapter title $n', totalVerses: 40),
    ];

/// The sheet as the reader opens it, with whatever it gave back kept in [picks].
Widget _app({
  int? canto,
  required int chapter,
  required List<ChapterPick?> picks,
  List<BookSection> gitaChapters = _gitaChapters,
  Object? cantosError,
}) =>
    ProviderScope(
      overrides: [
        languageSettingsProvider.overrideWith(_LanguagesInMemory.new),
        bookCantosProvider.overrideWith((ref, slug) async {
          if (cantosError != null) throw cantosError;
          return _cantos;
        }),
        bookChaptersProvider.overrideWith(
          (ref, args) async => args.canto == null ? gitaChapters : _cantoChapters(args.canto!),
        ),
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
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () async => picks.add(await showChapterIndexSheet(
                context,
                slug: 'book',
                bookTitle: 'The book',
                chapter: chapter,
                canto: canto,
              )),
              child: const Text('open'),
            ),
          ),
        ),
      ),
    );

Future<void> _open(WidgetTester tester) async {
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('the Gita opens on its chapters, in the reading language, with the one being read marked',
      (tester) async {
    final semantics = tester.ensureSemantics();
    final picks = <ChapterPick?>[];
    await tester.pumpWidget(_app(chapter: 2, picks: picks));
    await _open(tester);

    expect(find.text('THE BOOK'), findsOneWidget);
    expect(find.text('Contents'), findsOneWidget);
    expect(find.text('2 chapters'), findsOneWidget);
    expect(find.text('अर्जुनविषादयोग'), findsOneWidget);
    expect(find.text('सांख्ययोग'), findsOneWidget);
    expect(find.text('READING NOW'), findsOneWidget);
    expect(
      tester.getSemantics(find.bySemanticsLabel('Chapter 2, सांख्ययोग, Reading now, 72 verses')),
      isSemantics(isButton: true, isSelected: true),
    );
    expect(
      tester.getSemantics(find.bySemanticsLabel('Chapter 1, अर्जुनविषादयोग, 46 verses')),
      isSemantics(isButton: true, isSelected: false),
    );
    // The Gita has no cantos: no way back to a canto step, and no chevrons.
    expect(find.byTooltip('Back'), findsNothing);
    expect(find.byIcon(Icons.chevron_right_rounded), findsNothing);

    await tester.tap(find.text('अर्जुनविषादयोग'));
    await tester.pumpAndSettle();
    expect(picks, [(canto: null, chapter: 1)]);
    expect(find.text('Contents'), findsNothing);
    semantics.dispose();
  });

  testWidgets('the Bhagavatam opens on its cantos, then shows the chapters of the canto chosen', (tester) async {
    final picks = <ChapterPick?>[];
    await tester.pumpWidget(_app(canto: 1, chapter: 2, picks: picks));
    await _open(tester);

    expect(find.text('2 cantos'), findsOneWidget);
    expect(find.text('सृष्टी'), findsOneWidget);
    // No Marathi title: the English one stands in.
    expect(find.text('The Cosmic Manifestation'), findsOneWidget);
    expect(find.text('2 chapters'), findsNWidgets(2));
    expect(find.text('READING NOW'), findsOneWidget);
    expect(find.text('Questions by the Sages'), findsNothing);

    await tester.tap(find.text('सृष्टी'));
    await tester.pumpAndSettle();
    expect(find.text('CANTO 1'), findsOneWidget);
    expect(find.text('सृष्टी'), findsOneWidget);
    expect(find.text('2 chapters'), findsOneWidget);
    expect(find.text('Questions by the Sages'), findsOneWidget);
    expect(find.text('READING NOW'), findsOneWidget);

    await tester.tap(find.byTooltip('Back'));
    await tester.pumpAndSettle();
    expect(find.text('2 cantos'), findsOneWidget);
    expect(find.text('Questions by the Sages'), findsNothing);

    // Another canto: nothing in it is being read.
    await tester.tap(find.text('The Cosmic Manifestation'));
    await tester.pumpAndSettle();
    expect(find.text('CANTO 2'), findsOneWidget);
    expect(find.text('READING NOW'), findsNothing);

    await tester.tap(find.text('Divinity and Divine Service'));
    await tester.pumpAndSettle();
    expect(picks, [(canto: 2, chapter: 2)]);
  });

  testWidgets('a chapter far down the list is scrolled into view as the sheet opens', (tester) async {
    final picks = <ChapterPick?>[];
    await tester.pumpWidget(_app(chapter: 18, picks: picks, gitaChapters: _manyChapters(18)));
    await _open(tester);

    expect(find.text('Chapter title 18').hitTestable(), findsOneWidget);
    expect(find.text('Chapter title 1'), findsNothing);
  });

  testWidgets('cantos that cannot be loaded say so and can be asked for again', (tester) async {
    final picks = <ChapterPick?>[];
    await tester.pumpWidget(_app(
      canto: 1,
      chapter: 1,
      picks: picks,
      cantosError: const ApiFailure(kind: FailureKind.network, message: 'offline'),
    ));
    await _open(tester);

    expect(find.byType(AppErrorView), findsOneWidget);
    expect(find.text('सृष्टी'), findsNothing);
  });

  testWidgets('the chapter title in the app bar opens the contents when tapped', (tester) async {
    var taps = 0;
    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.light,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        appBar: AppBar(
          title: ChapterAppBarTitle(
            chapter: const BookSection(id: 'c', number: 3, cantoNumber: 2, title: 'x', totalVerses: 1),
            bookTitle: 'The book',
            onTap: () => taps++,
          ),
        ),
      ),
    ));

    expect(find.byIcon(Icons.expand_more_rounded), findsOneWidget);
    await tester.tap(find.text('Canto 2 · Chapter 3'));
    expect(taps, 1);
  });
}
