// The counter screen end to end, minus the network: tapping the ring counts,
// the figures follow, a mala that fills is listed in the analytics, and the
// screen fits a narrow phone at a large text size. Each mantra's rounds are its
// own: another mantra's rounds count towards the day, never towards the ring.

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

import 'support/chant_stores.dart';

/// A day with 4 beads to the round, so a whole mala is a handful of taps, and 2
/// rounds already chanted in [sessions].
class _FakeToday extends SadhanaTodayNotifier {
  _FakeToday(this.sessions);

  final List<ChantSession> sessions;

  @override
  Future<SadhanaToday> build() async => SadhanaToday(
        date: '2026-10-06',
        day: const SadhanaDay(roundTarget: 16, roundsCompleted: 2, tasksTotal: 0, tasksDone: 0),
        tasks: const [],
        sessions: sessions,
        streak: 0,
        beadsPerRound: 4,
      );
}

/// Two finished rounds of [mantraId] (null: the plain counter) from earlier today.
ChantSession _earlier(String? mantraId) => ChantSession(
      id: 'server-1',
      clientId: 'phone-1',
      source: 'IN_APP',
      rounds: 2,
      beads: 0,
      startedAt: DateTime(2026, 10, 6, 5),
      endedAt: DateTime(2026, 10, 6, 6),
      mantraId: mantraId,
    );

/// Opens the plain counter on the day above, taps the ring five times (one
/// finished round of four beads and one bead into the next) and leaves it there.
Future<void> _chantFiveBeads(WidgetTester tester, List<ChantSession> sessions) async {
  tester.view.physicalSize = const Size(320 * 3, 640 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  // The counter reads the day as it already is — it is opened from a tab
  // that has loaded it — so the day is loaded before the screen is.
  final container = ProviderContainer(
    overrides: [sadhanaTodayProvider.overrideWith(() => _FakeToday(sessions))],
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
}

/// Leave the screen so its timers are cancelled.
Future<void> _leave(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  await tester.pump(const Duration(seconds: 3));
}

void main() {
  setUp(keepStoresInMemory);
  tearDown(keepStoresInStore);

  testWidgets('taps are counted, timed and listed by mala', (tester) async {
    await _chantFiveBeads(tester, [_earlier(null)]);

    // Four beads to the round: one finished, one into the second. The ring
    // shows this counter's rounds, 2 before this sitting plus the 1 just chanted.
    expect(find.text('3'), findsWidgets);
    expect(find.text('1/4'), findsOneWidget);
    expect(find.text('#5'), findsOneWidget);

    expect(find.byIcon(Icons.insights_rounded), findsOneWidget);

    await _leave(tester);
  });

  testWidgets("another mantra's rounds are the day's, not the ring's", (tester) async {
    // Two rounds earlier today were of another mantra. This counter has none of
    // its own, so after one round the ring says 1 — while the day, which counts
    // them all, says 3 of 16.
    await _chantFiveBeads(tester, [_earlier('hare-krishna')]);

    expect(find.text('3'), findsNothing);
    expect(find.text('1'), findsWidgets);
    expect(find.text('3 of 16 rounds'), findsOneWidget);
    expect(find.text('1/4'), findsOneWidget);

    await _leave(tester);
  });
}
