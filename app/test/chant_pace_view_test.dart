// The counter screen around how long one chant takes: the prayer every mantra
// ends a round with (its own, or kṛṣṇārpaṇamastu), the pace a finished round
// teaches, the shorter / longer buttons, and the switch that counts by time
// instead of by the microphone.
//
// No LocalStore here on purpose: a store write under the test's fake clock never
// finishes, and the screen treats a store that is not open as "nothing kept".

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/format/chant_format.dart';
import 'package:hariharibol/core/format/indic_script.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/mantra.dart';
import 'package:hariharibol/models/sadhana.dart';
import 'package:hariharibol/providers/language_chain_provider.dart';
import 'package:hariharibol/providers/sadhana_provider.dart';
import 'package:hariharibol/services/chant_pace.dart';
import 'package:hariharibol/services/fallback_prayer.dart';
import 'package:hariharibol/views/chant/chant_view.dart';
import 'package:hariharibol/widgets/chant/chant_disc.dart';

import 'fake_audio_player.dart';
import 'support/chant_stores.dart';

const Mantra panchatattva = Mantra(
  id: 'prayer',
  slug: 'panchatattva',
  name: 'Panchatattva',
  text: 'sri krishna chaitanya prabhu nityananda',
  textLanguage: 'en',
  durationMs: 7000,
);

const Mantra mahamantra = Mantra(
  id: 'maha',
  slug: 'mahamantra',
  name: 'Maha Mantra',
  text: 'Hare Krishna Hare Krishna',
  textLanguage: 'en',
  durationMs: 4000,
  prayer: panchatattva,
);

/// Four seconds a chant and no prayer of its own.
const Mantra plain = Mantra(
  id: 'plain',
  slug: 'plain',
  name: 'Plain Mantra',
  text: 'Om namo narayanaya',
  textLanguage: 'en',
  durationMs: 4000,
);

const Duration standard = Duration(seconds: 4);
const String prayerHint = 'Chant this prayer first, then tap the ring to begin counting.';
const String fallbackName = 'Offering to Krishna';
const String shorter = 'Shorter chant time';
const String longer = 'Longer chant time';

/// A day with 4 beads to the round, so a whole mala is four taps.
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

class TestClock {
  DateTime now = DateTime(2026, 10, 6, 6);

  void advance(int milliseconds) => now = now.add(Duration(milliseconds: milliseconds));
}

Future<void> pumpView(
  WidgetTester tester,
  Mantra mantra,
  TestClock clock, {
  List<String> readingChain = const ['en'],
}) async {
  tester.view.physicalSize = const Size(320 * 3, 640 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  final container = ProviderContainer(
    overrides: [
      sadhanaTodayProvider.overrideWith(_FakeToday.new),
      readingChainProvider.overrideWithValue(readingChain),
    ],
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
        home: ChantView(mantra: mantra, clock: () => clock.now),
      ),
    ),
  );
  await tester.pump();
  await tester.pump();
}

Future<void> leave(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  await tester.pump(const Duration(seconds: 3));
}

Future<void> tapRing(WidgetTester tester) async {
  await tester.ensureVisible(find.byType(ChantDisc));
  await tester.tap(find.byType(ChantDisc));
  await tester.pump();
}

/// The four taps of a round, [gap] milliseconds apart.
Future<void> chantRound(WidgetTester tester, TestClock clock, {required int gap}) async {
  for (var i = 0; i < 4; i++) {
    clock.advance(gap);
    await tapRing(tester);
  }
}

/// The tap that ends a prayer of [prayerMs], made as soon as it is allowed.
Future<void> endPrayer(WidgetTester tester, TestClock clock, {int prayerMs = 3000}) async {
  clock.advance(prayerMs);
  await tapRing(tester);
}

Future<void> press(WidgetTester tester, String tooltip) async {
  await tester.ensureVisible(find.byTooltip(tooltip));
  await tester.tap(find.byTooltip(tooltip));
  await tester.pump();
}

/// The pace the screen has kept for [mantra].
Duration kept(Mantra mantra) => ChantPaceStore.read(mantra.id, standard);

Finder summaryFor(int milliseconds) =>
    find.textContaining('${formatMillisAsSeconds(milliseconds)}s each', skipOffstage: false);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late TestClock clock;

  setUp(() {
    installFakeWakelock();
    keepStoresInMemory();
    clock = TestClock();
  });

  tearDown(keepStoresInStore);

  group('the prayer at the end of a round', () {
    testWidgets('a mantra with none of its own ends with kṛṣṇārpaṇamastu', (tester) async {
      await pumpView(tester, plain, clock);
      expect(find.text(prayerHint), findsNothing, reason: 'it opens on the mantra, not the prayer');

      await chantRound(tester, clock, gap: 2000);

      expect(find.text(fallbackName), findsOneWidget);
      expect(find.text(FallbackPrayer.roman), findsOneWidget);
      expect(find.text(prayerHint), findsOneWidget);
      expect(find.text(plain.text), findsNothing);

      await leave(tester);
    });

    testWidgets('is written in the reading language: Devanagari for Hindi', (tester) async {
      await pumpView(tester, plain, clock, readingChain: const ['hi']);
      await chantRound(tester, clock, gap: 2000);

      expect(find.text(FallbackPrayer.devanagari), findsOneWidget);

      await leave(tester);
    });

    testWidgets('is written in the reading language: its own script for Tamil', (tester) async {
      await pumpView(tester, plain, clock, readingChain: const ['ta']);
      await chantRound(tester, clock, gap: 2000);

      expect(find.text(fromDevanagari(FallbackPrayer.devanagari, 'ta')), findsOneWidget);

      await leave(tester);
    });

    testWidgets('waits three seconds, counts nothing and brings the mantra back', (tester) async {
      await pumpView(tester, plain, clock);
      await chantRound(tester, clock, gap: 2000);

      clock.advance(2999);
      await tapRing(tester);
      expect(find.text(prayerHint), findsOneWidget, reason: 'three seconds is its standard time');

      clock.advance(1);
      await tapRing(tester);
      expect(find.text(prayerHint), findsNothing);
      expect(find.text(plain.text), findsOneWidget);
      expect(find.text('0/4'), findsOneWidget, reason: 'the tap that ends a prayer is not a chant');

      await leave(tester);
    });

    testWidgets('is not used by a mantra that has a prayer of its own', (tester) async {
      await pumpView(tester, mahamantra, clock);
      await endPrayer(tester, clock, prayerMs: 7000);
      await chantRound(tester, clock, gap: 2000);

      expect(find.text('Panchatattva'), findsOneWidget);
      expect(find.text(fallbackName), findsNothing);

      await leave(tester);
    });

    testWidgets('the settings card is out of the way while it is said', (tester) async {
      await pumpView(tester, plain, clock);
      expect(find.text('Time for one chant', skipOffstage: false), findsOneWidget);

      await chantRound(tester, clock, gap: 2000);
      expect(find.text('Time for one chant', skipOffstage: false), findsNothing);

      await endPrayer(tester, clock);
      expect(find.text('Time for one chant', skipOffstage: false), findsOneWidget);

      await leave(tester);
    });
  });

  group('a round teaches the pace', () {
    testWidgets('from the tap that began it to the tap that ended the prayer after it', (tester) async {
      await pumpView(tester, plain, clock);

      // Opened on the mantra with no prayer before it: nothing to measure from.
      await chantRound(tester, clock, gap: 2000);
      await endPrayer(tester, clock);
      expect(kept(plain), standard);

      // Began at the prayer tap; four chants three seconds apart, then the prayer.
      await chantRound(tester, clock, gap: 3000);
      await endPrayer(tester, clock);

      expect(kept(plain), const Duration(milliseconds: 3000));
      expect(summaryFor(3000), findsOneWidget);

      await leave(tester);
    });

    testWidgets('a slower round makes a slower pace, and the hand tap waits for it', (tester) async {
      await pumpView(tester, plain, clock);
      await chantRound(tester, clock, gap: 2000);
      await endPrayer(tester, clock);

      await chantRound(tester, clock, gap: 5000);
      await endPrayer(tester, clock);
      expect(kept(plain), const Duration(milliseconds: 5000));

      // Half of five seconds: a tap at 2.4 s does nothing, one at 2.5 s counts.
      clock.advance(2499);
      await tapRing(tester);
      expect(find.text('0/4'), findsOneWidget);
      clock.advance(1);
      await tapRing(tester);
      expect(find.text('1/4'), findsOneWidget);

      await leave(tester);
    });

    testWidgets('never goes under 45% of the standard time, however fast the taps', (tester) async {
      await pumpView(tester, plain, clock);
      await chantRound(tester, clock, gap: 2000);
      await endPrayer(tester, clock);

      // Each round can only be as quick as half the pace before it allows.
      await chantRound(tester, clock, gap: 2000);
      await endPrayer(tester, clock);
      expect(kept(plain), const Duration(milliseconds: 2000));

      await chantRound(tester, clock, gap: 1000);
      await endPrayer(tester, clock);
      expect(kept(plain), const Duration(milliseconds: 1800));

      await leave(tester);
    });

    testWidgets('a round the reader changed the pace in is not taken over their choice', (tester) async {
      await pumpView(tester, plain, clock);
      await chantRound(tester, clock, gap: 2000);
      await endPrayer(tester, clock);

      await press(tester, shorter);
      expect(kept(plain), const Duration(milliseconds: 3800));

      await chantRound(tester, clock, gap: 3000);
      await endPrayer(tester, clock);

      expect(kept(plain), const Duration(milliseconds: 3800));

      // The round after that is clean, so it teaches again.
      await chantRound(tester, clock, gap: 3000);
      await endPrayer(tester, clock);
      expect(kept(plain), const Duration(milliseconds: 3000));

      await leave(tester);
    });

    testWidgets('a round picked up part-way teaches nothing', (tester) async {
      await pumpView(tester, plain, clock);
      clock.advance(2000);
      await tapRing(tester);
      await leave(tester);

      await pumpView(tester, plain, clock);
      for (var i = 0; i < 3; i++) {
        clock.advance(7000);
        await tapRing(tester);
      }
      await endPrayer(tester, clock);

      expect(kept(plain), standard);

      await leave(tester);
    });
  });

  group('the shorter and longer buttons', () {
    testWidgets('start from the standard time and step by 5% of it', (tester) async {
      await pumpView(tester, plain, clock);
      expect(summaryFor(4000), findsOneWidget);

      await press(tester, longer);
      expect(kept(plain), const Duration(milliseconds: 4200));
      expect(summaryFor(4200), findsOneWidget);

      await press(tester, shorter);
      await press(tester, shorter);
      expect(kept(plain), const Duration(milliseconds: 3800));
      expect(summaryFor(3800), findsOneWidget);

      await leave(tester);
    });

    testWidgets('say what a round comes to', (tester) async {
      await pumpView(tester, plain, clock);

      // Four chants of four seconds.
      expect(find.textContaining(formatClock(const Duration(seconds: 16)), skipOffstage: false), findsOneWidget);

      await press(tester, longer);
      expect(find.textContaining(formatClock(const Duration(milliseconds: 16800)), skipOffstage: false), findsOneWidget);

      await leave(tester);
    });

    testWidgets('stop at 45% of the standard time', (tester) async {
      await pumpView(tester, plain, clock);

      // 4000 → 1800 in steps of 200.
      for (var i = 0; i < 11; i++) {
        await press(tester, shorter);
      }

      expect(kept(plain), const Duration(milliseconds: 1800));
      final button = tester.widget<IconButton>(find.widgetWithIcon(IconButton, Icons.remove_rounded));
      expect(button.onPressed, isNull);
      final other = tester.widget<IconButton>(find.widgetWithIcon(IconButton, Icons.add_rounded));
      expect(other.onPressed, isNotNull);

      await leave(tester);
    });

    testWidgets('stop at three times the standard time', (tester) async {
      await pumpView(tester, plain, clock);

      // 4000 → 12000 in steps of 200.
      for (var i = 0; i < 40; i++) {
        await press(tester, longer);
      }

      expect(kept(plain), const Duration(milliseconds: 12000));
      final button = tester.widget<IconButton>(find.widgetWithIcon(IconButton, Icons.add_rounded));
      expect(button.onPressed, isNull);

      await leave(tester);
    });

    testWidgets('set how long a hand tap must wait: half of one chant', (tester) async {
      await pumpView(tester, plain, clock);
      for (var i = 0; i < 5; i++) {
        await press(tester, longer);
      }
      expect(kept(plain), const Duration(milliseconds: 5000));

      clock.advance(1000);
      await tapRing(tester);
      expect(find.text('1/4'), findsOneWidget);

      clock.advance(2499);
      await tapRing(tester);
      expect(find.text('1/4'), findsOneWidget);

      clock.advance(1);
      await tapRing(tester);
      expect(find.text('2/4'), findsOneWidget);

      await leave(tester);
    });

    testWidgets('are remembered for the mantra, and for it alone', (tester) async {
      await pumpView(tester, plain, clock);
      await press(tester, longer);
      await leave(tester);

      await pumpView(tester, plain, clock);
      expect(summaryFor(4200), findsOneWidget);
      await leave(tester);

      await pumpView(
        tester,
        const Mantra(id: 'other', slug: 'other', name: 'Other', text: 'Om', textLanguage: 'en', durationMs: 4000),
        clock,
      );
      expect(summaryFor(4000), findsOneWidget);

      await leave(tester);
    });

    testWidgets('are measured from each mantra\'s own standard time', (tester) async {
      await pumpView(tester, panchatattva, clock);

      // 7 s: a step is 350 ms.
      await press(tester, longer);
      expect(ChantPaceStore.read(panchatattva.id, const Duration(seconds: 7)), const Duration(milliseconds: 7350));

      await leave(tester);
    });
  });

  group('the microphone switch', () {
    testWidgets('is on to begin with, and says it listens', (tester) async {
      await pumpView(tester, plain, clock);

      expect(find.text('Use the microphone', skipOffstage: false), findsOneWidget);
      expect(find.text('Listens to your chanting', skipOffstage: false), findsOneWidget);

      await leave(tester);
    });

    testWidgets('off says it counts by time, to save the battery', (tester) async {
      await pumpView(tester, plain, clock);

      await tester.ensureVisible(find.text('Use the microphone'));
      await tester.tap(find.byType(Switch).at(1));
      await tester.pump();

      expect(find.text('Counts by time instead — saves battery', skipOffstage: false), findsOneWidget);
      expect(find.text('Listens to your chanting', skipOffstage: false), findsNothing);
      expect(find.byIcon(Icons.mic_off_rounded), findsOneWidget);

      await leave(tester);
    });

    testWidgets('with auto count on, counting by time says no microphone is in use', (tester) async {
      await pumpView(tester, plain, clock);

      await tester.ensureVisible(find.text('Use the microphone'));
      await tester.tap(find.byType(Switch).at(1));
      await tester.pump();

      await tester.ensureVisible(find.byType(Switch).at(0));
      await tester.tap(find.byType(Switch).at(0));
      await tester.pump();
      await tester.pump();

      expect(find.text('Counting by time — no microphone', skipOffstage: false), findsOneWidget);
      expect(find.text('Listening…', skipOffstage: false), findsNothing);

      await leave(tester);
    });

    testWidgets('a count by time is switched off like any other', (tester) async {
      await pumpView(tester, plain, clock);
      await tester.ensureVisible(find.text('Use the microphone'));

      await tester.tap(find.byType(Switch).at(1));
      await tester.pump();
      await tester.ensureVisible(find.byType(Switch).at(0));
      await tester.tap(find.byType(Switch).at(0));
      await tester.pump();
      await tester.pump();
      expect(find.text('Counting by time — no microphone', skipOffstage: false), findsOneWidget);

      await tester.ensureVisible(find.byType(Switch).at(0));
      await tester.tap(find.byType(Switch).at(0));
      await tester.pump();
      await tester.pump();
      expect(find.text('Off — tap a bead yourself', skipOffstage: false), findsOneWidget);

      await leave(tester);
    });
  });

  group('auto count and the hand', () {
    testWidgets('a tap on the ring counts nothing while auto count runs, and counts once it is off', (
      tester,
    ) async {
      await pumpView(tester, plain, clock);
      await tester.ensureVisible(find.text('Use the microphone'));

      // Counting by time, so no microphone is needed.
      await tester.tap(find.byType(Switch).at(1));
      await tester.pump();
      await tester.ensureVisible(find.byType(Switch).at(0));
      await tester.tap(find.byType(Switch).at(0));
      await tester.pump();
      await tester.pump();
      expect(find.text('Counting by time — no microphone', skipOffstage: false), findsOneWidget);

      clock.advance(3000);
      await tapRing(tester);
      await tapRing(tester);
      expect(find.text('0/4'), findsOneWidget);

      await tester.ensureVisible(find.byType(Switch).at(0));
      await tester.tap(find.byType(Switch).at(0));
      await tester.pump();
      await tester.pump();
      expect(find.text('Off — tap a bead yourself', skipOffstage: false), findsOneWidget);

      clock.advance(3000);
      await tapRing(tester);
      expect(find.text('1/4'), findsOneWidget);

      await leave(tester);
    });
  });
}
