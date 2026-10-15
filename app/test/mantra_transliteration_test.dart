// The Roman line under a mantra's text is for a reader of Devanagari. The text
// follows the reading language now, so a Kannada reader's is Kannada and Roman
// under it would be the very thing the reading language is meant to replace; an
// English reader's text is Roman already and the line would only repeat it.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/mantra.dart';
import 'package:hariharibol/providers/mantra_provider.dart';
import 'package:hariharibol/views/mantra/mantra_detail_view.dart';

const _roman = 'hare kṛṣṇa hare kṛṣṇa';

Future<void> _open(WidgetTester tester, String text, String language, {String? transliteration}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        mantraDetailProvider.overrideWith(
          (ref, slug) async => Mantra(
            id: 'm',
            slug: 'm',
            name: 'Mahamantra',
            text: text,
            textLanguage: language,
            transliteration: transliteration,
          ),
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
        home: const MantraDetailView(slug: 'm'),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('Roman under Devanagari is shown', (tester) async {
    await _open(tester, 'हरे कृष्ण हरे कृष्ण', 'sa', transliteration: _roman);
    expect(find.text(_roman), findsOneWidget);
  });

  testWidgets('Roman under Kannada letters is not', (tester) async {
    await _open(tester, 'ಹರೇ ಕೃಷ್ಣ ಹರೇ ಕೃಷ್ಣ', 'kn', transliteration: _roman);
    expect(find.text('ಹರೇ ಕೃಷ್ಣ ಹರೇ ಕೃಷ್ಣ'), findsOneWidget);
    expect(find.text(_roman), findsNothing);
  });

  testWidgets('Roman under Roman is not repeated', (tester) async {
    await _open(tester, 'Hare Krishna Hare Krishna', 'en', transliteration: _roman);
    expect(find.text(_roman), findsNothing);
  });

  testWidgets('Devanagari under Devanagari is not repeated', (tester) async {
    await _open(tester, 'हरे कृष्ण', 'sa', transliteration: 'हरे कृष्ण हरे');
    expect(find.text('हरे कृष्ण हरे'), findsNothing);
  });
}
