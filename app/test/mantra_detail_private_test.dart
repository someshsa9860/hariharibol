import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/navigation/app_navigator.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/mantra.dart';
import 'package:hariharibol/providers/mantra_provider.dart';
import 'package:hariharibol/views/mantra/mantra_detail_view.dart';

import 'support/chant_stores.dart';
import 'support/fake_own_mantra_service.dart';

void main() {
  final text = lookupAppLocalizations(const Locale('en'));

  setUp(keepStoresInMemory);

  Future<void> open(WidgetTester tester, Mantra mantra) async {
    tester.view.physicalSize = const Size(400 * 3, 1200 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          mantraDetailProvider(mantra.slug).overrideWith((ref) => Stream.value(mantra)),
        ],
        child: MaterialApp(
          navigatorKey: AppNavigator.instance.rootKey,
          scaffoldMessengerKey: AppNavigator.instance.messengerKey,
          theme: AppTheme.light,
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: MantraDetailView(slug: mantra.slug),
        ),
      ),
    );
    await tester.pump();
    await tester.pump();
  }

  testWidgets('a mantra the reader made is private: no Share, and it can be changed or removed', (tester) async {
    await open(tester, ownMantra('mine'));

    expect(find.text('Name of mine'), findsOneWidget);
    expect(find.text(text.ownMantraPrivate), findsWidgets);
    expect(find.byTooltip(text.shareTitle), findsNothing);
    expect(find.text(text.ownMantraChangePicture), findsOneWidget);
    expect(find.text(text.ownMantraRemove), findsOneWidget);
  });

  testWidgets('a private mantra made by someone else can be removed but not given a picture', (tester) async {
    await open(tester, ownMantra('theirs', mine: false));

    expect(find.byTooltip(text.shareTitle), findsNothing);
    expect(find.text(text.ownMantraChangePicture), findsNothing);
    expect(find.text(text.ownMantraRemove), findsOneWidget);
  });

  testWidgets('a public mantra can be shared and has no private controls', (tester) async {
    await open(tester, ownMantra('open', type: 'PUBLIC', mine: false));

    expect(find.byTooltip(text.shareTitle), findsOneWidget);
    expect(find.text(text.ownMantraRemove), findsNothing);
    expect(find.text(text.ownMantraChangePicture), findsNothing);
  });
}
