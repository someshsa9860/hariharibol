// The Home tab's mantra row used to be a fixed 140.8 px tall while a card is as
// tall as its text, so Kannada (and a larger text size) overflowed it — the
// yellow-and-black "BOTTOM OVERFLOWED" stripe on the cards. The row now takes the
// height of its tallest card.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/mantra.dart';
import 'package:hariharibol/widgets/dashboard/mantra_row.dart';

const _kannada = 'ಹರೇ ಕೃಷ್ಣ ಹರೇ ಕೃಷ್ಣ | ಕೃಷ್ಣ ಕೃಷ್ಣ ಹರೇ ಹರೇ ॥ '
    'ಹರೇ ರಾಮ ಹರೇ ರಾಮ | ರಾಮ ರಾಮ ಹರೇ ಹರೇ ॥';

const _mahamantra = Mantra(
  id: 'm1',
  slug: 'mahamantra',
  name: 'ಹರೇ ಕೃಷ್ಣ ಮಹಾಮಂತ್ರ',
  text: _kannada,
  textLanguage: 'kn',
  category: 'mahamantra',
  audioUrl: 'https://example.test/a.mp3',
);

const _short = Mantra(
  id: 'm2',
  slug: 'short',
  name: 'Short',
  text: 'Hare',
  textLanguage: 'en',
);

Future<void> _pump(
  WidgetTester tester, {
  required ThemeData theme,
  double textScale = 1,
  List<Mantra> mantras = const [_mahamantra, _short],
}) async {
  tester.view.physicalSize = const Size(402 * 3, 874 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    MaterialApp(
      theme: theme,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)),
        child: child!,
      ),
      home: Scaffold(
        body: Align(
          alignment: Alignment.topLeft,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: MantraRow(mantras: mantras, onOpen: (_) {}),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  for (final scale in [1.0, 1.3, 2.0]) {
    for (final entry in {'light': AppTheme.light, 'dark': AppTheme.dark}.entries) {
      testWidgets('nothing overflows at ${scale}x text, ${entry.key}', (tester) async {
        await _pump(tester, theme: entry.value, textScale: scale);
        // A RenderFlex overflow is reported as a test exception.
        expect(tester.takeException(), isNull);
      });
    }
  }

  testWidgets('every card is as tall as the tallest', (tester) async {
    await _pump(tester, theme: AppTheme.light);

    final cards = find.byType(Card);
    expect(cards, findsNWidgets(2));
    expect(tester.getSize(cards.at(0)).height, tester.getSize(cards.at(1)).height);
  });

  testWidgets('a row of short mantras is not stretched to a fixed height', (tester) async {
    await _pump(tester, theme: AppTheme.light, mantras: const [_short]);

    expect(tester.takeException(), isNull);
    // A name and one line of text, nothing more: well under the old 140.8 px.
    expect(tester.getSize(find.byType(Card)).height, lessThan(140));
  });
}
