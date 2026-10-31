// The action row at the top of a verse. With every button it ran off the edge of
// a phone ("right overflowed by 38 pixels", the last buttons out of reach), so
// what does not fit now goes into a "more" menu.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/verse.dart';
import 'package:hariharibol/widgets/library/verse_block.dart';

Verse _verse({int related = 2}) => Verse(
      id: 'v',
      verseId: '1.1.1',
      bookNumber: 1,
      type: 'SHLOKA',
      verseNumber: 1,
      sanskrit: 'धर्मक्षेत्रे कुरुक्षेत्रे',
      relatedCount: related,
    );

Widget _app(
  double width, {
  bool everything = true,
  VoidCallback? onAskSakha,
  VoidCallback? onCollapse,
  int related = 2,
}) =>
    ProviderScope(
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
          body: Align(
            alignment: Alignment.topLeft,
            child: SizedBox(
              width: width,
              child: VerseBlock(
                verse: _verse(related: related),
                fontScale: 1,
                isFavorite: false,
                isHighlighted: false,
                noteCount: 3,
                onToggleFavorite: () {},
                onToggleHighlight: () {},
                onOpenNotes: () {},
                onOpenRelated: () {},
                onAskSakha: everything ? (onAskSakha ?? () {}) : null,
                onStartReels: everything ? () {} : null,
                onCompareTranslations: everything ? () {} : null,
                onPlay: everything ? () {} : null,
                onCollapse: onCollapse,
              ),
            ),
          ),
        ),
      ),
    );

void main() {
  void screen(WidgetTester tester, {double width = 1000}) {
    tester.view.physicalSize = Size(width, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
  }

  AppLocalizations words(WidgetTester tester) => AppLocalizations.of(tester.element(find.byType(VerseBlock)));

  testWidgets('on a phone the row fits and the rest wait in the more menu', (tester) async {
    screen(tester);
    var asked = 0;
    await tester.pumpWidget(_app(393, onAskSakha: () => asked++));
    await tester.pumpAndSettle();

    final text = words(tester);
    expect(tester.takeException(), isNull, reason: 'no overflow');
    expect(find.byTooltip(text.actionBookmark), findsOneWidget);
    expect(find.byTooltip(text.shareTitle), findsOneWidget);
    expect(find.byTooltip(text.verseAskSakha), findsNothing, reason: 'moved into the menu');

    await tester.tap(find.byTooltip(text.reelMore));
    await tester.pumpAndSettle();
    expect(find.text(text.verseAskSakha), findsOneWidget);
    expect(find.text(text.verseStartReels), findsOneWidget);
    expect(find.text(text.verseCompareTranslations), findsOneWidget);
    expect(find.text(text.verseRelatedTitle), findsOneWidget);

    await tester.tap(find.text(text.verseAskSakha));
    await tester.pumpAndSettle();
    expect(asked, 1);
  });

  testWidgets('the narrowest phone fits too, with more in the menu', (tester) async {
    screen(tester);
    await tester.pumpWidget(_app(320));
    await tester.pumpAndSettle();

    final text = words(tester);
    expect(tester.takeException(), isNull);
    expect(find.byTooltip(text.actionBookmark), findsOneWidget);
    await tester.tap(find.byTooltip(text.reelMore));
    await tester.pumpAndSettle();
    expect(find.text(text.shareTitle), findsOneWidget);
    expect(find.text(text.verseNotesTitle), findsOneWidget);
  });

  testWidgets('with room every action stays in the row and there is no menu', (tester) async {
    screen(tester);
    await tester.pumpWidget(_app(900));
    await tester.pumpAndSettle();

    final text = words(tester);
    expect(tester.takeException(), isNull);
    expect(find.byTooltip(text.reelMore), findsNothing);
    for (final tooltip in [
      text.actionBookmark,
      text.actionHighlight,
      text.verseNotesTitle,
      text.shareTitle,
      text.verseStartReels,
      text.verseAskSakha,
      text.verseCompareTranslations,
      text.verseRelatedTitle,
    ]) {
      expect(find.byTooltip(tooltip), findsOneWidget, reason: tooltip);
    }
  });

  testWidgets('a verse opened out of a story leads with a button that folds it back', (tester) async {
    screen(tester);
    var folded = 0;
    await tester.pumpWidget(_app(320, onCollapse: () => folded++));
    await tester.pumpAndSettle();

    final text = words(tester);
    expect(tester.takeException(), isNull);
    expect(find.byTooltip(text.readingStoryCollapse), findsOneWidget, reason: 'first in the row, so the last to go into the menu');
    await tester.tap(find.byTooltip(text.readingStoryCollapse));
    expect(folded, 1);
  });

  testWidgets('without onCollapse there is no such button', (tester) async {
    screen(tester);
    await tester.pumpWidget(_app(900));
    await tester.pumpAndSettle();

    expect(find.byTooltip(words(tester).readingStoryCollapse), findsNothing);
  });

  testWidgets('a verse with only the basic actions needs no menu on a phone', (tester) async {
    screen(tester);
    await tester.pumpWidget(_app(393, everything: false, related: 0));
    await tester.pumpAndSettle();

    final text = words(tester);
    expect(tester.takeException(), isNull);
    expect(find.byTooltip(text.reelMore), findsNothing);
    expect(find.byTooltip(text.shareTitle), findsOneWidget);
  });
}
