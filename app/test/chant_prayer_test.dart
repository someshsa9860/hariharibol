// The counter screen around a mantra that has an opening prayer, and around a
// round left part-way: that the prayer is shown first and again before every
// round, that the tap which ends it is neither early nor counted, that a round
// picked up again carries on from its beads without the prayer, and that the
// beads are kept on the phone for each mantra.

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/mantra.dart';
import 'package:hariharibol/models/sadhana.dart';
import 'package:hariharibol/providers/sadhana_provider.dart';
import 'package:hariharibol/services/chant_progress_store.dart';
import 'package:hariharibol/services/local_store.dart';
import 'package:hariharibol/views/chant/chant_view.dart';
import 'package:hariharibol/widgets/chant/chant_disc.dart';

import 'fake_audio_player.dart';

const Mantra panchatattva = Mantra(
  id: 'prayer',
  slug: 'panchatattva',
  name: 'Panchatattva',
  text: 'sri krishna chaitanya prabhu nityananda',
  textLanguage: 'en',
  durationMs: 7000,
);

/// Four seconds a chant, so a hand tap must wait two; the prayer takes seven.
const Mantra mahamantra = Mantra(
  id: 'maha',
  slug: 'mahamantra',
  name: 'Maha Mantra',
  text: 'Hare Krishna Hare Krishna',
  textLanguage: 'en',
  durationMs: 4000,
  prayer: panchatattva,
);

const Mantra plain = Mantra(
  id: 'plain',
  slug: 'plain',
  name: 'Plain Mantra',
  text: 'Om namo narayanaya',
  textLanguage: 'en',
  durationMs: 4000,
);

const String hint = 'Chant this prayer first, then tap the ring to begin counting.';

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

/// A clock the test moves by hand.
class TestClock {
  DateTime now = DateTime(2026, 10, 6, 6);

  void advance(int milliseconds) => now = now.add(Duration(milliseconds: milliseconds));
}

Future<void> pumpView(WidgetTester tester, Mantra mantra, TestClock clock) async {
  tester.view.physicalSize = const Size(320 * 3, 640 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

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
        home: ChantView(mantra: mantra, clock: () => clock.now),
      ),
    ),
  );
  await tester.pump();
  await tester.pump();
}

/// Leaves the screen so its timers are cancelled.
Future<void> leave(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  await tester.pump(const Duration(seconds: 3));
}

Future<void> tapRing(WidgetTester tester) async {
  await tester.ensureVisible(find.byType(ChantDisc));
  await tester.tap(find.byType(ChantDisc));
  await tester.pump();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory dir;
  late TestClock clock;

  setUpAll(() async {
    dir = await Directory.systemTemp.createTemp('hariharibol_chant_progress');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/path_provider'),
      (call) async => dir.path,
    );
    await LocalStore.instance.init();
  });

  // Not `Hive.close()`: see routine_sheet_test.dart.
  tearDownAll(() {
    if (dir.existsSync()) dir.deleteSync(recursive: true);
  });

  setUp(() {
    installFakeWakelock();
    clock = TestClock();
  });

  // A widget test must not write the real store: see ChantProgressStore.
  group('the opening prayer', () {
    setUp(ChantProgressStore.keepInMemory);
    tearDown(ChantProgressStore.keepInStore);

    testWidgets('comes first, with the mantra held back', (tester) async {
      await pumpView(tester, mahamantra, clock);

      expect(find.text('Panchatattva'), findsOneWidget);
      expect(find.text(panchatattva.text), findsOneWidget);
      expect(find.text(hint), findsOneWidget);
      expect(find.text(mahamantra.text), findsNothing);

      await leave(tester);
    });

    testWidgets('a mantra with none opens on the mantra', (tester) async {
      await pumpView(tester, plain, clock);

      expect(find.text(hint), findsNothing);
      expect(find.text(plain.text), findsOneWidget);

      await leave(tester);
    });

    testWidgets('a tap before its time is up does nothing', (tester) async {
      await pumpView(tester, mahamantra, clock);

      clock.advance(6999);
      await tapRing(tester);

      expect(find.text(hint), findsOneWidget);
      expect(find.text(mahamantra.text), findsNothing);

      await leave(tester);
    });

    testWidgets('the tap after its time shows the mantra, and counts nothing', (tester) async {
      await pumpView(tester, mahamantra, clock);

      clock.advance(7000);
      await tapRing(tester);

      expect(find.text(hint), findsNothing);
      expect(find.text(mahamantra.text), findsOneWidget);
      expect(find.text('0/4'), findsOneWidget, reason: 'the tap that ends the prayer is not a chant');
      expect(ChantProgressStore.read(mahamantra.id), 0);

      await leave(tester);
    });

    testWidgets('counting starts after it, a chant at a time', (tester) async {
      await pumpView(tester, mahamantra, clock);
      clock.advance(7000);
      await tapRing(tester);

      // Half of a four second chant must pass first, measured from the tap that
      // ended the prayer.
      clock.advance(1999);
      await tapRing(tester);
      expect(find.text('0/4'), findsOneWidget);

      clock.advance(1);
      await tapRing(tester);
      expect(find.text('1/4'), findsOneWidget);

      await leave(tester);
    });

    testWidgets('comes again before the next round', (tester) async {
      await pumpView(tester, mahamantra, clock);
      clock.advance(7000);
      await tapRing(tester);

      for (var i = 0; i < 4; i++) {
        clock.advance(2000);
        await tapRing(tester);
      }

      expect(find.text(hint), findsOneWidget);
      expect(find.text(mahamantra.text), findsNothing);
      expect(ChantProgressStore.read(mahamantra.id), 0, reason: 'a finished round leaves nothing to carry');

      // And a tap straight away does not skip it.
      clock.advance(1000);
      await tapRing(tester);
      expect(find.text(hint), findsOneWidget);

      clock.advance(6000);
      await tapRing(tester);
      expect(find.text(hint), findsNothing);
      expect(find.text(mahamantra.text), findsOneWidget);
      expect(find.text('0/4'), findsOneWidget);

      await leave(tester);
    });
  });

  group('a round left part-way', () {
    setUp(ChantProgressStore.keepInMemory);
    tearDown(ChantProgressStore.keepInStore);

    testWidgets('carries on from its beads when the mantra is opened again', (tester) async {
      await pumpView(tester, plain, clock);
      await tapRing(tester);
      clock.advance(2000);
      await tapRing(tester);
      expect(find.text('2/4'), findsOneWidget);
      expect(ChantProgressStore.read(plain.id), 2);
      await leave(tester);

      // Some time later, the app opened afresh on the same mantra.
      clock.advance(6 * 60 * 60 * 1000);
      await pumpView(tester, plain, clock);

      expect(find.text('2/4'), findsOneWidget);

      await leave(tester);
    });

    testWidgets('is kept for each mantra on its own', (tester) async {
      await pumpView(tester, plain, clock);
      await tapRing(tester);
      await leave(tester);

      await pumpView(
        tester,
        const Mantra(id: 'other', slug: 'other', name: 'Other', text: 'Om', textLanguage: 'en', durationMs: 4000),
        clock,
      );

      expect(find.text('0/4'), findsOneWidget);
      expect(ChantProgressStore.read(plain.id), 1);

      await leave(tester);
    });

    testWidgets('the round that follows is the rest of it, and nothing more', (tester) async {
      await pumpView(tester, plain, clock);
      await tapRing(tester);
      clock.advance(2000);
      await tapRing(tester);
      await leave(tester);

      await pumpView(tester, plain, clock);
      for (var i = 0; i < 2; i++) {
        clock.advance(2000);
        await tapRing(tester);
      }

      expect(find.text('0/4'), findsOneWidget);
      expect(ChantProgressStore.read(plain.id), 0);

      await leave(tester);
    });

    testWidgets('skips the prayer, which was said when the round began', (tester) async {
      ChantProgressStore.write(mahamantra.id, 3);
      await pumpView(tester, mahamantra, clock);

      expect(find.text(hint), findsNothing);
      expect(find.text(mahamantra.text), findsOneWidget);
      expect(find.text('3/4'), findsOneWidget);

      await leave(tester);
    });

    testWidgets('taking a bead back is kept too', (tester) async {
      await pumpView(tester, plain, clock);
      await tapRing(tester);
      clock.advance(2000);
      await tapRing(tester);
      expect(ChantProgressStore.read(plain.id), 2);

      await tester.tap(find.byTooltip('Undo last bead'));
      await tester.pump();

      expect(ChantProgressStore.read(plain.id), 1);

      await leave(tester);
    });
  });

  group('the store', () {
    setUp(() => LocalStore.instance.clear());

    test('keeps one number for each mantra, and forgets it at 0', () {
      ChantProgressStore.write('a', 5);
      ChantProgressStore.write('b', 9);
      expect(ChantProgressStore.read('a'), 5);
      expect(ChantProgressStore.read('b'), 9);

      ChantProgressStore.write('a', 0);
      expect(ChantProgressStore.read('a'), 0);
      expect(ChantProgressStore.read('b'), 9);
    });

    test('a count with no mantra has its own place', () {
      ChantProgressStore.write(null, 7);

      expect(ChantProgressStore.read(null), 7);
      expect(ChantProgressStore.read('a'), 0);
    });
  });
}
