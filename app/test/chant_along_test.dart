// The "Chant along" card on its own, and the counter screen around it: that the
// card plays, seeks and recovers from a dead link; that it fits a narrow phone at
// a large text size in both themes; and that a recording on the screen counts
// the ring, rests the microphone features, and stops with the app.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/mantra.dart';
import 'package:hariharibol/models/sadhana.dart';
import 'package:hariharibol/providers/chant_audio_provider.dart';
import 'package:hariharibol/providers/sadhana_provider.dart';
import 'package:hariharibol/services/chant_mala_player.dart';
import 'package:hariharibol/services/chant_mala_timing.dart';
import 'package:hariharibol/views/chant/chant_view.dart';
import 'package:hariharibol/widgets/chant/chant_along_card.dart';
import 'package:hariharibol/widgets/chant/chant_disc.dart';
import 'package:hariharibol/widgets/chant/word_detect_switch.dart';

import 'fake_audio_player.dart';

const String link = 'https://media.test/mala.mp3';

/// A ten second prayer, then four chants of ten seconds each, on a one minute
/// recording: the chants end at 20, 30, 40 and 50 seconds.
final ChantMalaTiming timing = ChantMalaTiming(
  start: const Duration(seconds: 10),
  end: const Duration(seconds: 50),
  chants: 4,
);

const Mantra withRecording = Mantra(
  id: 'm1',
  slug: 'chant-along-test',
  name: 'Hare Krishna',
  text: 'Hare Krishna Hare Krishna',
  textLanguage: 'en',
  malaAudioUrl: link,
  malaAudioStartMs: 10000,
  malaAudioEndMs: 50000,
);

const Mantra withoutRecording = Mantra(
  id: 'm2',
  slug: 'chant-along-test',
  name: 'Hare Krishna',
  text: 'Hare Krishna Hare Krishna',
  textLanguage: 'en',
);

/// A day with 4 beads to the round, so a whole mala is a handful of chants.
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

Widget app(Widget home, {Brightness brightness = Brightness.light, double textScale = 1.0}) {
  return MaterialApp(
    theme: brightness == Brightness.light ? AppTheme.light : AppTheme.dark,
    localizationsDelegates: const [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    supportedLocales: AppLocalizations.supportedLocales,
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)),
      child: child!,
    ),
    home: home,
  );
}

void narrowPhone(WidgetTester tester) {
  tester.view.physicalSize = const Size(320 * 3, 640 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
}

/// The card with a real [ChantMalaPlayer] on a fake audio player.
Future<(ChantMalaPlayer, FakeAudioPlayer)> pumpCard(
  WidgetTester tester, {
  bool load = true,
  bool deadLink = false,
  Brightness brightness = Brightness.light,
  double textScale = 1.0,
}) async {
  narrowPhone(tester);
  final fake = FakeAudioPlayer(length: const Duration(minutes: 1));
  if (deadLink) fake.brokenUrls.add(link);
  final player = ChantMalaPlayer(url: link, timing: timing, player: fake);
  addTearDown(player.dispose);

  await tester.pumpWidget(
    app(
      Scaffold(
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: ChantAlongCard(player: player),
        ),
      ),
      brightness: brightness,
      textScale: textScale,
    ),
  );
  if (load) {
    unawaited(player.load());
    await tester.pump();
    await tester.pump();
  }
  return (player, fake);
}

/// The counter screen, with [fake] standing in for the audio player.
Future<void> pumpView(
  WidgetTester tester, {
  required Mantra mantra,
  required FakeAudioPlayer fake,
  void Function()? onPlayerMade,
}) async {
  narrowPhone(tester);
  // The counter reads the day as it already is — it is opened from a tab that
  // has loaded it — so the day is loaded before the screen is.
  final container = ProviderContainer(
    overrides: [
      sadhanaTodayProvider.overrideWith(_FakeToday.new),
      malaAudioPlayerProvider.overrideWithValue(() {
        onPlayerMade?.call();
        return fake;
      }),
    ],
  );
  addTearDown(container.dispose);
  await container.read(sadhanaTodayProvider.future);

  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: app(ChantView(mantra: mantra)),
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

Future<void> tapPlay(WidgetTester tester) async {
  await tester.ensureVisible(find.byTooltip('Play recording'));
  await tester.tap(find.byTooltip('Play recording'));
  await tester.pump();
}

void main() {
  late FakeWakelock wakelock;

  setUp(() => wakelock = installFakeWakelock());

  group('the card', () {
    testWidgets('says the recording is loading before it has opened', (tester) async {
      await pumpCard(tester, load: false);

      expect(find.text('Chant along'), findsOneWidget);
      expect(find.text('Loading the recording…'), findsOneWidget);
      expect(find.byType(LinearProgressIndicator), findsOneWidget);
      expect(find.byType(Slider), findsNothing);
    });

    testWidgets('offers play, a bar, and where it is and how long, once open', (tester) async {
      await pumpCard(tester);

      expect(find.byTooltip('Play recording'), findsOneWidget);
      expect(find.byType(Slider), findsOneWidget);
      expect(find.text('0:00'), findsOneWidget);
      expect(find.text('1:00'), findsOneWidget);
      expect(find.text('Loading the recording…'), findsNothing);
    });

    testWidgets('play starts it, and the same button then pauses it', (tester) async {
      final (_, fake) = await pumpCard(tester);

      await tester.tap(find.byTooltip('Play recording'));
      await tester.pump();
      expect(fake.plays, 1);
      expect(find.byTooltip('Pause recording'), findsOneWidget);
      expect(find.byTooltip('Play recording'), findsNothing);

      await tester.tap(find.byTooltip('Pause recording'));
      await tester.pump();
      expect(fake.pauses, 1);
      expect(find.byTooltip('Play recording'), findsOneWidget);
    });

    testWidgets('the bar and the clock follow the recording', (tester) async {
      final (_, fake) = await pumpCard(tester);
      await tester.tap(find.byTooltip('Play recording'));
      await tester.pump();

      fake.playTo(const Duration(seconds: 30));
      await tester.pump();

      expect(find.text('0:30'), findsOneWidget);
      expect(tester.widget<Slider>(find.byType(Slider)).value, 30000);
    });

    testWidgets('dragging the bar seeks once, when the finger lifts', (tester) async {
      final (_, fake) = await pumpCard(tester);
      final bar = tester.getRect(find.byType(Slider));

      final gesture = await tester.startGesture(bar.centerLeft + const Offset(24, 0));
      await gesture.moveBy(const Offset(120, 0));
      await tester.pump();

      // The thumb and the clock are with the finger; the recording is not moved yet.
      expect(fake.seeks, isEmpty);
      expect(find.text('0:00'), findsNothing);

      await gesture.up();
      await tester.pump();
      expect(fake.seeks, hasLength(1));
      expect(fake.seeks.single, greaterThan(Duration.zero));
      expect(fake.seeks.single, lessThanOrEqualTo(const Duration(minutes: 1)));
    });

    testWidgets('a screen reader reaches the button and the bar on their own', (tester) async {
      final handle = tester.ensureSemantics();
      final (_, fake) = await pumpCard(tester);

      // The bar is one stop: its name, where it is, and that it can be adjusted.
      final bar = find.semantics.byLabel('Position in the recording');
      final barData = bar.evaluate().single.getSemanticsData();
      expect(barData.value, '0:00');
      expect(barData.hasAction(SemanticsAction.increase), isTrue);
      expect(barData.hasAction(SemanticsAction.decrease), isTrue);

      // Stepping it seeks, as dragging does.
      tester.semantics.increase(bar);
      await tester.pump();
      expect(fake.seeks, hasLength(1));
      expect(fake.seeks.single, greaterThan(Duration.zero));

      // The button is a stop of its own, not part of a block of the card's text.
      tester.semantics.tap(find.semantics.byPredicate((node) => node.tooltip == 'Play recording'));
      await tester.pump();
      expect(fake.plays, 1);
      handle.dispose();
    });

    testWidgets('a link that will not open can be tried again', (tester) async {
      final (_, fake) = await pumpCard(tester, deadLink: true);

      expect(find.text("The recording couldn't be loaded."), findsOneWidget);
      expect(find.byType(Slider), findsNothing);

      fake.brokenUrls.clear();
      await tester.tap(find.text('Try again'));
      await tester.pump();
      await tester.pump();

      expect(find.byTooltip('Play recording'), findsOneWidget);
      expect(find.text("The recording couldn't be loaded."), findsNothing);
    });
  });

  for (final brightness in Brightness.values) {
    group('on a narrow phone at a large text size, ${brightness.name}', () {
      for (final phase in ['loading', 'failed', 'ready', 'playing']) {
        testWidgets('the card fits while $phase', (tester) async {
          final (_, fake) = await pumpCard(
            tester,
            load: phase != 'loading',
            deadLink: phase == 'failed',
            brightness: brightness,
            textScale: 1.4,
          );
          if (phase == 'playing') {
            await tester.tap(find.byTooltip('Play recording'));
            fake.playTo(const Duration(seconds: 45));
            await tester.pump();
          }

          expect(tester.takeException(), isNull);
        });
      }
    });
  }

  group('on the counter screen', () {
    tearDown(() {
      TestWidgetsFlutterBinding.instance.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    });

    testWidgets('a mantra with no recording has no player and no card', (tester) async {
      final fake = FakeAudioPlayer();
      var made = 0;
      await pumpView(tester, mantra: withoutRecording, fake: fake, onPlayerMade: () => made += 1);

      expect(made, 0);
      expect(find.byType(ChantAlongCard), findsNothing);
      expect(tester.takeException(), isNull);

      await leave(tester);
    });

    testWidgets('a recording counts the ring as it plays, each chant marked auto', (tester) async {
      final fake = FakeAudioPlayer(length: const Duration(minutes: 1));
      await pumpView(tester, mantra: withRecording, fake: fake);

      expect(find.byType(ChantAlongCard), findsOneWidget);
      expect(fake.opened, [link]);
      expect(find.text('Tap the ring to begin.'), findsOneWidget);

      await tapPlay(tester);
      expect(fake.plays, 1);
      expect(wakelock.held, isTrue);

      // The prayer, and then the first chant, are not over yet.
      fake.playTo(const Duration(seconds: 19, milliseconds: 900));
      await tester.pump();
      expect(find.text('Tap the ring to begin.'), findsOneWidget);

      fake.playTo(const Duration(seconds: 30));
      await tester.pump();
      expect(find.text('2/4'), findsOneWidget);
      expect(find.text('#2'), findsOneWidget);
      expect(find.byIcon(Icons.mic_rounded), findsNWidgets(2));

      // Four chants fill the round the day is counted in.
      fake.playTo(const Duration(seconds: 50));
      await tester.pump();
      expect(find.text('#4'), findsOneWidget);
      expect(find.byIcon(Icons.insights_rounded), findsOneWidget);

      // The rest of the recording is silence: the count stops where the chanting does.
      fake.playTo(const Duration(seconds: 59, milliseconds: 900));
      fake.finish();
      await tester.pump();
      expect(find.text('#5'), findsNothing);
      expect(find.byTooltip('Play recording'), findsOneWidget);
      expect(wakelock.held, isFalse);
      expect(tester.takeException(), isNull);

      await leave(tester);
    });

    testWidgets('a tap on the ring still counts while the recording plays', (tester) async {
      final fake = FakeAudioPlayer(length: const Duration(minutes: 1));
      await pumpView(tester, mantra: withRecording, fake: fake);
      await tapPlay(tester);

      await tester.ensureVisible(find.byType(ChantDisc));
      await tester.tap(find.byType(ChantDisc));
      await tester.pump();

      expect(find.text('1/4'), findsOneWidget);
      expect(fake.pauses, 0);
      expect(find.byTooltip('Pause recording'), findsOneWidget);

      await leave(tester);
    });

    testWidgets('word detection and the recording take turns, so nothing is heard twice', (
      tester,
    ) async {
      final fake = FakeAudioPlayer(length: const Duration(minutes: 1));
      await pumpView(tester, mantra: withRecording, fake: fake);
      await tapPlay(tester);
      expect(fake.plays, 1);

      final words = find.descendant(
        of: find.byType(WordDetectSwitch),
        matching: find.byType(Switch),
      );
      await tester.ensureVisible(words);
      await tester.tap(words);
      await tester.pump();

      expect(fake.pauses, 1);
      expect(find.byTooltip('Play recording'), findsOneWidget);

      await leave(tester);
    });

    testWidgets('the recording pauses when the app leaves the foreground', (tester) async {
      final fake = FakeAudioPlayer(length: const Duration(minutes: 1));
      await pumpView(tester, mantra: withRecording, fake: fake);
      await tapPlay(tester);
      expect(wakelock.held, isTrue);

      TestWidgetsFlutterBinding.instance.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await tester.pump();

      expect(fake.pauses, 1);
      expect(find.byTooltip('Play recording'), findsOneWidget);
      expect(wakelock.held, isFalse);

      // No frames are drawn while the app is in the background, so it has to be
      // back before the screen can be left.
      TestWidgetsFlutterBinding.instance.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      await leave(tester);
    });

    testWidgets('closing the screen stops the recording before the sitting is sent', (
      tester,
    ) async {
      final fake = FakeAudioPlayer(length: const Duration(minutes: 1));
      await pumpView(tester, mantra: withRecording, fake: fake);
      await tapPlay(tester);
      expect(fake.plays, 1);

      await tester.tap(find.byIcon(Icons.close_rounded));
      await tester.pump();

      // Stopped at once: nothing is counted after the sitting's last sync, which
      // is still waiting on the network.
      expect(fake.pauses, 1);
      expect(find.byTooltip('Play recording'), findsOneWidget);

      await tester.pump(const Duration(seconds: 3));
      expect(tester.takeException(), isNull);

      await leave(tester);
    });

    testWidgets('leaving the screen releases the player and the screen', (tester) async {
      final fake = FakeAudioPlayer(length: const Duration(minutes: 1));
      await pumpView(tester, mantra: withRecording, fake: fake);
      await tapPlay(tester);
      expect(wakelock.held, isTrue);

      await leave(tester);

      expect(fake.disposed, isTrue);
      expect(wakelock.held, isFalse);
    });

    testWidgets('the screen fits a narrow phone with the card in both themes', (tester) async {
      for (final brightness in Brightness.values) {
        final fake = FakeAudioPlayer(length: const Duration(minutes: 1));
        narrowPhone(tester);
        final container = ProviderContainer(
          overrides: [
            sadhanaTodayProvider.overrideWith(_FakeToday.new),
            malaAudioPlayerProvider.overrideWithValue(() => fake),
          ],
        );
        addTearDown(container.dispose);
        await container.read(sadhanaTodayProvider.future);

        await tester.pumpWidget(
          UncontrolledProviderScope(
            container: container,
            child: app(ChantView(mantra: withRecording), brightness: brightness, textScale: 1.3),
          ),
        );
        await tester.pump();
        await tester.pump();

        expect(tester.takeException(), isNull, reason: brightness.name);
        expect(find.byType(ChantAlongCard), findsOneWidget);

        await leave(tester);
      }
    });
  });
}
