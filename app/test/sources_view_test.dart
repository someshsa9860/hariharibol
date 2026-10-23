// Settings → Sources & disclaimer.
//
// The page is all copy, so what is tested is that it says what it must — every
// source, the AI notice, the address to write to — that Prabhupāda's credit
// always shows here even while AppConfig.showAuthorName keeps his name off
// every other surface, and that no language's longer wording breaks the layout.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/constants/app_config.dart';
import 'package:hariharibol/core/constants/text_sources.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/views/settings/sources_view.dart';

Future<void> pumpPage(WidgetTester tester, {Locale locale = const Locale('en')}) {
  return tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light,
      locale: locale,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      home: const SourcesView(),
    ),
  );
}

/// The page's own list: each address is a SelectableText, which brings a
/// scrollable of its own.
final page = find.descendant(of: find.byType(ListView), matching: find.byType(Scrollable)).first;

void main() {
  testWidgets('names every source, the AI notice and the address to write to', (tester) async {
    await pumpPage(tester);

    expect(find.text('Sources & disclaimer'), findsOneWidget);
    for (final address in [
      TextSources.gita,
      TextSources.bhagavatamEarly,
      TextSources.bhagavatamLate,
      TextSources.dnyaneshwari,
      AppConfig.supportEmail,
    ]) {
      await tester.scrollUntilVisible(find.text(address), 200, scrollable: page);
      expect(find.text(address), findsOneWidget);
    }
    await tester.scrollUntilVisible(
      find.text('Translations into other languages'),
      -200,
      scrollable: page,
    );
    expect(find.textContaining('with the help of AI'), findsOneWidget);
    expect(find.textContaining('Cantos 1–9', skipOffstage: false), findsOneWidget);
    expect(find.textContaining('Cantos 10–12', skipOffstage: false), findsOneWidget);
  });

  testWidgets("Prabhupada's credit always shows, regardless of AppConfig.showAuthorName", (tester) async {
    await pumpPage(tester);

    expect(find.textContaining('Bhaktivedanta', skipOffstage: false), findsOneWidget);
    expect(find.textContaining('all rights in it remain', skipOffstage: false), findsOneWidget);
  });

  testWidgets('renders in every language without overflowing', (tester) async {
    for (final locale in AppLocalizations.supportedLocales) {
      await pumpPage(tester, locale: locale);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: locale.toString());
      expect(find.text(TextSources.gita, skipOffstage: false), findsOneWidget);
    }
  });
}
