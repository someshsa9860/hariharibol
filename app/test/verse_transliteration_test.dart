import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/verse.dart';
import 'package:hariharibol/widgets/library/verse_block.dart';

const _sanskrit = 'धर्मक्षेत्रे कुरुक्षेत्रे';

Widget _app(String? transliteration) => ProviderScope(
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
            child: VerseBlock(
              verse: Verse(
                id: 'v',
                verseId: '1.1.1',
                bookNumber: 1,
                type: 'SHLOKA',
                verseNumber: 1,
                sanskrit: _sanskrit,
                transliteration: transliteration,
              ),
              fontScale: 1,
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

void main() {
  testWidgets('Roman text under a Devanagari verse is shown', (tester) async {
    await tester.pumpWidget(_app('dharma-kṣetre kuru-kṣetre'));
    expect(find.text('dharma-kṣetre kuru-kṣetre'), findsOneWidget);
  });

  testWidgets('another script under a Devanagari verse is shown', (tester) async {
    await tester.pumpWidget(_app('தர்மக்ஷேத்ரே குருக்ஷேத்ரே'));
    expect(find.text('தர்மக்ஷேத்ரே குருக்ஷேத்ரே'), findsOneWidget);
  });

  testWidgets('Devanagari under a Devanagari verse would only repeat it, so it is left out', (tester) async {
    await tester.pumpWidget(_app('धर्मक्षेत्रे कुरुक्षेत्रे'));
    expect(find.text(_sanskrit), findsOneWidget, reason: 'the verse itself, once');
  });

  testWidgets('no transliteration shows nothing extra', (tester) async {
    await tester.pumpWidget(_app(null));
    expect(find.text(_sanskrit), findsOneWidget);
  });
}
