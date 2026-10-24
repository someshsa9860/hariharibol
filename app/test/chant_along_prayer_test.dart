// What playing a recording does to the opening prayer, what it does to the auto
// count and microphone switches, and the early finish of a round, each walked on
// the real counter screen. The recording's own arithmetic is in
// chant_mala_timing_test.dart, and the pieces on their own in
// chant_widgets_test.dart.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/mantra.dart';
import 'package:hariharibol/models/sadhana.dart';
import 'package:hariharibol/providers/chant_audio_provider.dart';
import 'package:hariharibol/providers/language_chain_provider.dart';
import 'package:hariharibol/providers/sadhana_provider.dart';
import 'package:hariharibol/services/chant_pace.dart';
import 'package:hariharibol/views/chant/chant_view.dart';
import 'package:hariharibol/widgets/chant/chant_along_card.dart';
import 'package:hariharibol/widgets/chant/chant_disc.dart';

import 'fake_audio_player.dart';
import 'support/chant_stores.dart';

const String link = 'https://media.test/mala.mp3';

const String hint = 'Chant this prayer first, then tap the ring to begin counting.';
const String hintAlong =
    'The recording begins with this prayer. Press play and chant it with the recording.';
const String hintNoPrayer = 'Chant this prayer, then press play — the recording starts with the mantra.';

const Mantra panchatattva = Mantra(
  id: 'prayer',
  slug: 'panchatattva',
  name: 'Panchatattva',
  text: 'sri krishna chaitanya prabhu nityananda',
  textLanguage: 'en',
  durationMs: 7000,
);

/// A mantra with a prayer of its own and no recording.
const Mantra mahamantra = Mantra(
  id: 'maha',
  slug: 'mahamantra',
  name: 'Maha Mantra',
  text: 'Hare Krishna Hare Krishna',
  textLanguage: 'en',
  durationMs: 4000,
  prayer: panchatattva,
);

/// The same, with a recording that opens on the chanting: the prayer on the
/// screen is the only prayer there is.
const Mantra recordedFromStart = Mantra(
  id: 'maha',
  slug: 'mahamantra',
  name: 'Maha Mantra',
  text: 'Hare Krishna Hare Krishna',
  textLanguage: 'en',
  durationMs: 4000,
  prayer: panchatattva,
  malaAudioUrl: link,
  malaAudioStartMs: 0,
  malaAudioEndMs: 50000,
);

/// The same, with a recording whose first five seconds are the prayer.
const Mantra recordedWithPrayer = Mantra(
  id: 'maha',
  slug: 'mahamantra',
  name: 'Maha Mantra',
  text: 'Hare Krishna Hare Krishna',
  textLanguage: 'en',
  durationMs: 4000,
  prayer: panchatattva,
  malaAudioUrl: link,
  malaAudioStartMs: 5000,
  malaAudioEndMs: 50000,
);

/// A day with [beads] beads to the round, 2 of 16 rounds done.
class _FakeToday extends SadhanaTodayNotifier {
  _FakeToday(this.beads);

  final int beads;

  @override
  Future<SadhanaToday> build() async => SadhanaToday(
    date: '2026-10-06',
    day: const SadhanaDay(roundTarget: 16, roundsCompleted: 2, tasksTotal: 0, tasksDone: 0),
    tasks: const [],
    sessions: const [],
    streak: 0,
    beadsPerRound: beads,
  );
}

/// The time the counter reads, moved by hand.
class TestClock {
  DateTime now = DateTime(2026, 10, 6, 6);

  void advance(int milliseconds) => now = now.add(Duration(milliseconds: milliseconds));
}

Widget app(Widget home) {
  return MaterialApp(
    theme: AppTheme.light,
    localizationsDelegates: const [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    supportedLocales: AppLocalizations.supportedLocales,
    home: home,
  );
}

void narrowPhone(WidgetTester tester) {
  tester.view.physicalSize = const Size(320 * 3, 640 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
}

/// The counter screen on a day of [beads] beads, with a fake audio player.
Future<FakeAudioPlayer> pumpView(
  WidgetTester tester,
  Mantra mantra,
  TestClock clock, {
  int beads = 4,
}) async {
  narrowPhone(tester);
  final fake = FakeAudioPlayer(length: const Duration(minutes: 1));
  final container = ProviderContainer(
    overrides: [
      sadhanaTodayProvider.overrideWith(() => _FakeToday(beads)),
      readingChainProvider.overrideWithValue(const ['en']),
      malaAudioPlayerProvider.overrideWithValue(() => fake),
    ],
  );
  addTearDown(container.dispose);
  await container.read(sadhanaTodayProvider.future);

  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: app(ChantView(mantra: mantra, clock: () => clock.now)),
    ),
  );
  await tester.pump();
  await tester.pump();
  return fake;
}

/// Leaves the screen so its timers are cancelled.
Future<void> leave(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  await tester.pump(const Duration(seconds: 3));
}

Future<void> tapPlay(WidgetTester tester) async {
  await tester.ensureVisible(find.byTooltip('Play recording'));
  await tester.tap(find.byTooltip('Play recording'));
  await tester.pump();
  // The state the player reports reaches the screen one frame later.
  await tester.pump();
}

Future<void> tapPause(WidgetTester tester) async {
  await tester.ensureVisible(find.byTooltip('Pause recording'));
  await tester.tap(find.byTooltip('Pause recording'));
  await tester.pump();
}

Future<void> tapRing(WidgetTester tester) async {
  await tester.ensureVisible(find.byType(ChantDisc));
  await tester.tap(find.byType(ChantDisc));
  await tester.pump();
}

Future<void> tapFinish(WidgetTester tester) async {
  await tester.ensureVisible(find.text('Finish round'));
  await tester.tap(find.text('Finish round'));
  await tester.pump();
}

/// Waits out the prayer, taps it, and counts [beads] beads by hand, each after
/// the shortest wait a tap is taken after (half of 4 s).
Future<void> chantBeads(WidgetTester tester, TestClock clock, int beads) async {
  clock.advance(7000);
  await tapRing(tester);
  for (var i = 0; i < beads; i++) {
    clock.advance(2000);
    await tapRing(tester);
  }
}

void main() {
  late TestClock clock;

  setUp(() {
    installFakeWakelock();
    clock = TestClock();
    keepStoresInMemory();
  });

  tearDown(() {
    keepStoresInStore();
    TestWidgetsFlutterBinding.instance.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
  });

  group('a recording that carries the prayer', () {
    testWidgets('from 0:00, play is the prayer: nothing to tap, nothing said twice', (tester) async {
      final fake = await pumpView(tester, recordedFromStart, clock);

      // The prayer and the player are on the screen together, the line under the
      // prayer says what to do, and the mantra waits behind it.
      expect(find.text('Panchatattva'), findsOneWidget);
      expect(find.text('sri krishna chaitanya prabhu nityananda'), findsOneWidget);
      expect(find.text(hintNoPrayer), findsOneWidget);
      expect(find.text('Hare Krishna Hare Krishna'), findsNothing);
      expect(find.byType(ChantAlongCard), findsOneWidget);

      await tapPlay(tester);

      expect(fake.plays, 1);
      expect(find.text('Panchatattva'), findsNothing);
      expect(find.text(hintNoPrayer), findsNothing);
      expect(find.text('Hare Krishna Hare Krishna'), findsOneWidget);
      expect(find.text('0/4'), findsOneWidget);
      expect(tester.takeException(), isNull);

      await leave(tester);
    });

    testWidgets('from 0:05, the recording says the prayer, and the count starts after it', (
      tester,
    ) async {
      final fake = await pumpView(tester, recordedWithPrayer, clock);
      expect(find.text(hintAlong), findsOneWidget);

      await tapPlay(tester);
      fake.playTo(const Duration(milliseconds: 4900));
      await tester.pump();
      expect(find.text('Panchatattva'), findsOneWidget);

      fake.playTo(const Duration(seconds: 5));
      await tester.pump();
      expect(find.text('Panchatattva'), findsNothing);
      expect(find.text('0/4'), findsOneWidget);

      // Four chants share the 45 s after the prayer, 11.25 s each, so the first
      // is not over until 16.25 s: the stretch between start and end, not the file.
      fake.playTo(const Duration(milliseconds: 16200));
      await tester.pump();
      expect(find.text('0/4'), findsOneWidget);
      fake.playTo(const Duration(milliseconds: 16300));
      await tester.pump();
      expect(find.text('1/4'), findsOneWidget);

      await leave(tester);
    });

    testWidgets('pausing before the chanting starts keeps the prayer up', (tester) async {
      final fake = await pumpView(tester, recordedWithPrayer, clock);
      await tapPlay(tester);
      fake.playTo(const Duration(seconds: 3));
      await tester.pump();

      await tapPause(tester);
      expect(find.text('Panchatattva'), findsOneWidget);

      // Played again it goes on from there, and the prayer ends at 0:05.
      await tapPlay(tester);
      fake.playTo(const Duration(seconds: 5));
      await tester.pump();
      expect(find.text('Panchatattva'), findsNothing);
      expect(find.text('0/4'), findsOneWidget);

      await leave(tester);
    });

    testWidgets('a round ends in the prayer again, and playing again is the next round', (
      tester,
    ) async {
      final fake = await pumpView(tester, recordedFromStart, clock);
      await tapPlay(tester);
      fake.playTo(const Duration(seconds: 50));
      await tester.pump();

      // The recording is stopped and back at its start, so it does not count the
      // prayer, and a late reading of where it was changes nothing.
      expect(find.text('Panchatattva'), findsOneWidget);
      expect(find.text(hintNoPrayer), findsOneWidget);
      expect(fake.seeks.last, Duration.zero);
      expect(find.byTooltip('Play recording'), findsOneWidget);
      fake.reportStale(const Duration(milliseconds: 49900));
      await tester.pump();
      expect(find.text('Panchatattva'), findsOneWidget);

      await tapPlay(tester);
      expect(fake.plays, 2);
      expect(find.text('Panchatattva'), findsNothing);
      expect(find.text('0/4'), findsOneWidget);

      await leave(tester);
    });
  });

  group('while the recording plays', () {
    testWidgets('the auto count and the microphone rest, and wake when it is paused', (
      tester,
    ) async {
      await pumpView(tester, recordedFromStart, clock);
      await tapPlay(tester);

      // Off, said so, and not to be switched on from the screen.
      expect(find.text('Resting while the recording plays'), findsOneWidget);
      expect(tester.widget<Switch>(find.byType(Switch).at(0)).onChanged, isNull);
      expect(tester.widget<Switch>(find.byType(Switch).at(1)).onChanged, isNull);

      await tapPause(tester);

      // Both can be switched again, and auto count is left off for the reader to
      // turn on.
      expect(find.text('Resting while the recording plays'), findsNothing);
      expect(tester.widget<Switch>(find.byType(Switch).at(0)).onChanged, isNotNull);
      expect(tester.widget<Switch>(find.byType(Switch).at(1)).onChanged, isNotNull);
      expect(tester.widget<Switch>(find.byType(Switch).at(0)).value, isFalse);

      await leave(tester);
    });
  });

  group('finishing a round early', () {
    testWidgets('is offered once the round is past 90 of 108, here 11 of 12', (tester) async {
      await pumpView(tester, mahamantra, clock, beads: 12);
      await chantBeads(tester, clock, 10);

      expect(find.text('10/12'), findsOneWidget);
      expect(find.text('Finish round'), findsNothing);

      clock.advance(2000);
      await tapRing(tester);
      expect(find.text('11/12'), findsOneWidget);
      expect(find.text('Finish round'), findsOneWidget);

      await leave(tester);
    });

    testWidgets('ends the round and opens the next one with its prayer', (tester) async {
      await pumpView(tester, mahamantra, clock, beads: 12);
      await chantBeads(tester, clock, 11);
      expect(find.text('2 of 16 rounds'), findsOneWidget);

      await tapFinish(tester);

      expect(find.text('Panchatattva'), findsOneWidget);
      expect(find.text(hint), findsOneWidget);
      expect(find.text('0/12'), findsOneWidget);
      expect(find.text('Finish round'), findsNothing);
      expect(find.text('3 of 16 rounds'), findsOneWidget);
      // Nothing left in the new round to undo, and the beads that were not
      // chanted are not shown among the taps.
      final undo = find.widgetWithIcon(IconButton, Icons.undo_rounded);
      expect(tester.widget<IconButton>(undo).onPressed, isNull);
      expect(find.text('#11'), findsOneWidget);
      expect(find.text('#12'), findsNothing);

      await leave(tester);
    });

    testWidgets('teaches no pace: the round was not chanted in full', (tester) async {
      await pumpView(tester, mahamantra, clock, beads: 12);
      await chantBeads(tester, clock, 11);
      await tapFinish(tester);

      // The pace is learnt when the next prayer is tapped, from the round's time
      // over its beads. Eleven beads over twelve would make the reader look faster.
      clock.advance(7000);
      await tapRing(tester);

      expect(find.text('Panchatattva'), findsNothing);
      expect(ChantPaceStore.read('maha', const Duration(seconds: 4)), const Duration(seconds: 4));

      await leave(tester);
    });

    testWidgets('a round chanted in full still teaches the pace', (tester) async {
      await pumpView(tester, mahamantra, clock, beads: 12);
      await chantBeads(tester, clock, 12);
      expect(find.text('Panchatattva'), findsOneWidget);

      clock.advance(7000);
      await tapRing(tester);

      // 24 s of chanting over 12 beads.
      expect(ChantPaceStore.read('maha', const Duration(seconds: 4)), const Duration(seconds: 2));

      await leave(tester);
    });
  });
}
