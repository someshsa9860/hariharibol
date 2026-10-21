import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/book_reel.dart';
import 'package:hariharibol/widgets/reels/verse_reel_pages.dart';

Future<void> pumpPages(
  WidgetTester tester,
  VerseReelContent content, {
  VoidCallback? onEnded,
  BookReelStyle style = BookReelStyle.fallback,
}) {
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
        body: VerseReelPages(content: content, style: style, isActive: true, onEnded: onEnded),
      ),
    ),
  );
}

void main() {
  const verse = VerseReelContent(
    label: 'Bhagavad Gita 2.47',
    sanskrit: 'कर्मण्येवाधिकारस्ते',
    transliteration: 'karmaṇy-evādhikāras te',
    meaning: 'You have a right to your duty alone.',
    purport: 'A short purport.',
  );

  test('a long purport is split into pieces that lose no words', () {
    final text = List.generate(400, (i) => 'word$i${i % 9 == 0 ? '.' : ''}').join(' ');
    final pieces = splitPurport(
      text,
      style: const TextStyle(fontSize: 20, height: 1.6),
      width: 280,
      maxHeight: 300,
      direction: TextDirection.ltr,
      scaler: TextScaler.noScaling,
    );
    expect(pieces.length, greaterThan(1));
    expect(pieces.join(' '), text);
  });

  test('a short purport stays on one page', () {
    final pieces = splitPurport(
      'Just a few words.',
      style: const TextStyle(fontSize: 20),
      width: 280,
      maxHeight: 300,
      direction: TextDirection.ltr,
      scaler: TextScaler.noScaling,
    );
    expect(pieces, ['Just a few words.']);
  });

  testWidgets('starts on the Sanskrit and its transliteration', (tester) async {
    await pumpPages(tester, verse);
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('कर्मण्येवाधिकारस्ते'), findsOneWidget);
    expect(find.text('karmaṇy-evādhikāras te'), findsOneWidget);
    expect(find.text('Bhagavad Gita 2.47'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('tapping goes meaning, purport, then hands over to the next reel', (tester) async {
    var ended = 0;
    await pumpPages(tester, verse, onEnded: () => ended++);
    await tester.pump(const Duration(seconds: 1));

    await tester.tapAt(const Offset(700, 300));
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('You have a right to your duty alone.'), findsOneWidget);

    await tester.tapAt(const Offset(700, 300));
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('A short purport.'), findsOneWidget);
    expect(ended, 0);

    await tester.tapAt(const Offset(700, 300));
    await tester.pump();
    expect(ended, 1);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('a page moves on by itself when its time is up', (tester) async {
    var ended = 0;
    await pumpPages(
      tester,
      const VerseReelContent(meaning: 'Only a meaning.'),
      onEnded: () => ended++,
      style: const BookReelStyle(minPageSeconds: 2),
    );
    await tester.pump();
    await tester.pump(const Duration(seconds: 3));
    expect(ended, 1);
    await tester.pumpWidget(const SizedBox());
  });

  test('the style reads colours and flags, and falls back on bad values', () {
    final style = BookReelStyle.fromJson({
      'background': 'solid',
      'colorTop': '#112233',
      'colorBottom': 'nope',
      'showComments': 0,
      'showLike': 1,
    });
    expect(style.background, BookReelBackground.solid);
    expect(style.colorTop, const Color(0xFF112233));
    expect(style.colorBottom, BookReelStyle.fallback.colorBottom);
    expect(style.showComments, isFalse);
    expect(style.hasRail, isTrue);
    expect(BookReelStyle.fromJson({'showLike': 0, 'showComments': 0, 'showSave': 0, 'showShare': 0, 'showMore': 0}).hasRail, isFalse);
  });
}
