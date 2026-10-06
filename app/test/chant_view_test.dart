// The counter screen end to end, minus the network: tapping the ring counts,
// the figures follow, a mala that fills is listed in the analytics, and the
// screen fits a narrow phone at a large text size.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/sadhana.dart';
import 'package:hariharibol/providers/sadhana_provider.dart';
import 'package:hariharibol/views/chant/chant_view.dart';
import 'package:hariharibol/widgets/chant/chant_disc.dart';

/// A day with 4 beads to the round, so a whole mala is a handful of taps.
class _FakeToday extends SadhanaTodayNotifier {
  @override
  Future<SadhanaToday> build() async => const SadhanaToday(
        date: '2026-10-06',
        day: SadhanaDay(roundTarget: 16, roundsCompleted: 2, tasksTotal: 0, tasksDone: 0),
        tasks: [],
        sessions: [],
        streak: 0,
        beadsPerRound: 4,
      );
}

void main() {
  testWidgets('taps are counted, timed and listed by mala', (tester) async {
    tester.view.physicalSize = const Size(320 * 3, 640 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    // The counter reads the day as it already is — it is opened from a tab
    // that has loaded it — so the day is loaded before the screen is.
    final container = ProviderContainer(
      overrides: [sadhanaTodayProvider.overrideWith(_FakeToday.new)],
    );
    addTearDown(container.dispose);
    await container.read(sadhanaTodayProvider.future);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          theme: AppTheme.light,
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(textScaler: const TextScaler.linear(1.3)),
            child: child!,
          ),
          home: const ChantView(),
        ),
      ),
    );
    await tester.pump();

    expect(tester.takeException(), isNull);
    expect(find.text('Tap the ring to begin.'), findsOneWidget);

    // The summary above the ring is tall at this text size; scroll to it.
    await tester.ensureVisible(find.byType(ChantDisc));
    await tester.pump();

    for (var i = 0; i < 5; i++) {
      await tester.tap(find.byType(ChantDisc));
      await tester.pump(const Duration(seconds: 1));
    }

    expect(tester.takeException(), isNull);
    // Four beads to the round: one finished, one into the second. The ring
    // shows the day's rounds, 2 before this sitting plus the 1 just chanted.
    expect(find.text('3'), findsWidgets);
    expect(find.text('1/4'), findsOneWidget);
    expect(find.text('#5'), findsOneWidget);

    expect(find.byIcon(Icons.insights_rounded), findsOneWidget);

    // Leave the screen so its timers are cancelled.
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 3));
  });
}
