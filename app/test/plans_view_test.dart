// The plans screen, drawn from a catalogue: every plan the server lists is a
// card with its price, and what Ask Sakha gives it is said in replies, never in
// tokens.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/subscription.dart';
import 'package:hariharibol/providers/subscription_provider.dart';
import 'package:hariharibol/views/premium/plans_view.dart';

class _FakeEntitlement extends EntitlementNotifier {
  @override
  Future<Entitlement> build() async => Entitlement.none;
}

Map<String, dynamic> _plan(
  String slug,
  String name,
  int tier, {
  int? price,
  Map<String, dynamic>? sakha,
}) =>
    {
      'id': 'plan_$slug',
      'slug': slug,
      'name': name,
      'description': 'About $name.',
      'tier': tier,
      'isFree': price == null,
      'prices': [
        if (price != null)
          {
            'id': 'price_$slug',
            // The test host is not iOS, so this is the store it will ask for.
            'provider': 'GOOGLE_PLAY',
            'productId': '${slug}_monthly',
            'priceMinor': price,
            'currency': 'INR',
            'periodDays': 30,
            'trialDays': 0,
          },
      ],
      'features': {
        'ads.removed': {'enabled': price != null, 'limit': null},
      },
      'sakha': ?sakha,
    };

PlanCatalog _catalog({bool withSakha = true}) => PlanCatalog.fromJson({
      'features': [
        {'key': 'ads.removed', 'name': 'Ad-free', 'kind': 'FLAG'},
      ],
      'plans': [
        _plan('free', 'Free', 0, sakha: withSakha ? {'repliesPerMonth': 15} : null),
        _plan('arta', 'Ārta', 1, price: 4900, sakha: withSakha ? {'repliesPerMonth': 100} : null),
        _plan('jijnasu', 'Jijñāsu', 2, price: 9900, sakha: withSakha ? {'repliesPerMonth': 250} : null),
        _plan('artharthi', 'Arthārthī', 3, price: 19900, sakha: withSakha ? {'repliesPerMonth': 500} : null),
        _plan('jnani', 'Jñānī', 4, price: 39900, sakha: withSakha ? {'repliesPerMonth': 1000} : null),
      ],
    });

Widget _app(PlanCatalog catalog) => ProviderScope(
      overrides: [
        planCatalogProvider.overrideWith((ref) async => catalog),
        storeProductsProvider.overrideWith((ref) async => const <String, ProductDetails>{}),
        entitlementProvider.overrideWith(_FakeEntitlement.new),
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
        home: const PlansView(),
      ),
    );

Future<void> _open(WidgetTester tester, PlanCatalog catalog) async {
  tester.view.physicalSize = const Size(1320, 2868);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(_app(catalog));
  await tester.pump();
  await tester.pump();
}

void main() {
  testWidgets('shows the title, the subtitle and a card for every plan the server lists', (tester) async {
    await _open(tester, _catalog());

    expect(find.text('Plans'), findsOneWidget);
    expect(find.textContaining('The whole app is free'), findsOneWidget);

    // The list is lazy, so scroll to each card rather than counting them at once.
    for (final name in ['Free', 'Ārta', 'Jijñāsu', 'Arthārthī', 'Jñānī']) {
      await tester.scrollUntilVisible(find.text(name), 300, scrollable: find.byType(Scrollable).first);
      expect(find.text(name), findsOneWidget, reason: name);
    }
  });

  testWidgets('says what Ask Sakha gives each plan in replies a month, never in tokens', (tester) async {
    await _open(tester, _catalog());

    const replies = {
      'Free': 15,
      'Ārta': 100,
      'Jijñāsu': 250,
      'Arthārthī': 500,
      'Jñānī': 1000,
    };
    for (final entry in replies.entries) {
      await tester.scrollUntilVisible(
        find.text('About ${entry.value} replies a month'),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('About ${entry.value} replies a month'), findsOneWidget, reason: entry.key);
    }
    expect(find.textContaining('oken'), findsNothing);
  });

  testWidgets('an older server that sends no Ask Sakha block leaves the row out', (tester) async {
    await _open(tester, _catalog(withSakha: false));

    await tester.scrollUntilVisible(find.text('Jñānī'), 300, scrollable: find.byType(Scrollable).first);
    expect(find.textContaining('replies a month'), findsNothing);
    // The plans themselves still draw.
    expect(find.text('Jñānī'), findsOneWidget);
  });
}
