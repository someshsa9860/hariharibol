// Refer and earn drawn from a summary. The theme's buttons are full width (an
// infinite minimum), so one set loose in a Row made the screen throw and draw
// nothing but its title.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/share.dart';
import 'package:hariharibol/providers/referral_provider.dart';
import 'package:hariharibol/views/premium/refer_view.dart';

ReferralSummary _summary({List<Map<String, dynamic>> history = const []}) => ReferralSummary.fromJson({
      'code': 'HARI7788',
      'url': 'https://hariharibol.com/satsang/HARI7788',
      'totals': {'invited': 3, 'pending': 1, 'successful': 2},
      'rules': {'rewardDays': 30},
      'rewardActiveUntil': '2026-12-01T00:00:00.000Z',
      'history': history,
    });

Widget _app(ReferralSummary summary) => ProviderScope(
      overrides: [referralProvider.overrideWith((ref) async => summary)],
      child: MaterialApp(
        theme: AppTheme.light,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: const ReferView(),
      ),
    );

void main() {
  void phone(WidgetTester tester, {double width = 393, double height = 852}) {
    tester.view.physicalSize = Size(width, height);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
  }

  testWidgets('draws the code, the invite buttons, the totals and the box to type a code', (tester) async {
    phone(tester);
    await tester.pumpWidget(_app(_summary()));
    await tester.pumpAndSettle();

    final text = AppLocalizations.of(tester.element(find.byType(ReferView)));
    expect(tester.takeException(), isNull);
    expect(find.text('HARI7788'), findsOneWidget);
    expect(find.text(text.referInvite), findsOneWidget);
    expect(find.text(text.shareCopyLink), findsWidgets);
    expect(find.text(text.referStatRewarded), findsOneWidget);
    expect(find.text(text.referUseCode), findsOneWidget);
    expect(find.byType(TextField), findsOneWidget);
  });

  testWidgets('the invite buttons are as wide as their label, not the screen', (tester) async {
    phone(tester);
    await tester.pumpWidget(_app(_summary()));
    await tester.pumpAndSettle();

    final text = AppLocalizations.of(tester.element(find.byType(ReferView)));
    final invite = tester.getRect(find.widgetWithText(FilledButton, text.referInvite));
    final copy = tester.getRect(find.widgetWithText(OutlinedButton, text.shareCopyLink));
    final useCode = tester.getRect(find.widgetWithText(FilledButton, text.referUseCode));
    for (final button in [invite, copy, useCode]) {
      expect(button.width, lessThan(300), reason: 'a full-width button is what broke the screen');
    }
    expect(tester.takeException(), isNull);
  });

  testWidgets('holds at the narrowest phone and the largest text', (tester) async {
    phone(tester, width: 320, height: 568);
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    await tester.pumpWidget(_app(_summary(history: [
      {'name': 'Asha', 'status': 'QUALIFIED', 'invitedAt': '2026-10-01T00:00:00.000Z'},
      {'name': 'Ravi', 'status': 'PENDING', 'invitedAt': null},
    ])));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    await tester.scrollUntilVisible(find.text('Asha'), 200, scrollable: find.byType(Scrollable).first);
    expect(find.text('Asha'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
