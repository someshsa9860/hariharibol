// The counter's summary and analytics, drawn on a narrow phone at a large text
// size in both themes. What is being guarded is layout: six figures in a row of
// three, and a mala's three facts side by side, are exactly where a long
// number or a big font turns into a render overflow.
//
// The controls that change while a recording plays (the switches that rest, the
// line under the opening prayer) and the button that finishes a round early are
// tested here too, widget by widget; the screen around them is in
// chant_along_prayer_test.dart.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/chant_log.dart';
import 'package:hariharibol/models/mantra.dart';
import 'package:hariharibol/services/chant_recorder.dart';
import 'package:hariharibol/services/mantra_auto_chant_session.dart';
import 'package:hariharibol/services/mantra_repetition_counter.dart';
import 'package:hariharibol/widgets/chant/auto_chant_switch.dart';
import 'package:hariharibol/widgets/chant/chant_auto_card.dart';
import 'package:hariharibol/widgets/chant/chant_disc.dart';
import 'package:hariharibol/widgets/chant/chant_mala_report.dart';
import 'package:hariharibol/widgets/chant/chant_mantra_text.dart';
import 'package:hariharibol/widgets/chant/chant_recent_taps.dart';
import 'package:hariharibol/widgets/chant/chant_round_actions.dart';
import 'package:hariharibol/widgets/chant/chant_summary_header.dart';
import 'package:hariharibol/widgets/chant/chant_toggle_row.dart';

ChantRecorder sitting() {
  var now = DateTime(2026, 10, 6, 6);
  final recorder = ChantRecorder(beadsPerRound: 4, now: () => now);
  for (var i = 0; i < 6; i++) {
    recorder.tap(auto: i.isEven);
    now = now.add(const Duration(milliseconds: 1800));
  }
  recorder.attachHeard(
    ChantHeard(seq: 3, malaIndex: 1, text: 'hare krishna hare krishna', heardAt: now),
  );
  return recorder;
}

/// The auto-count card as the counter draws it; [paceSteps] collects the presses
/// of the chant-time buttons (`true` is "longer").
Widget autoCard({required bool resting, List<bool>? paceSteps}) => ChantAutoCard(
  status: const AutoChantStatus(enabled: true, phase: AutoChantPhase.listening),
  useMicrophone: true,
  pace: const Duration(seconds: 4),
  standard: const Duration(seconds: 4),
  beadsPerRound: 108,
  onAutoChanged: (_) {},
  onMicrophoneChanged: (_) {},
  onPaceChange: ({required bool longer}) => paceSteps?.add(longer),
  resting: resting,
);

const Mantra _mantra = Mantra(
  id: 'm',
  slug: 'm',
  name: 'Maha Mantra',
  text: 'Hare Krishna Hare Krishna',
  textLanguage: 'en',
  durationMs: 4000,
);

const Mantra _prayer = Mantra(
  id: 'p',
  slug: 'p',
  name: 'Panchatattva',
  text: 'sri krishna chaitanya prabhu nityananda',
  textLanguage: 'en',
  durationMs: 7000,
);

Future<void> pump(
  WidgetTester tester,
  Widget child, {
  Brightness brightness = Brightness.light,
  Locale? locale,
}) {
  tester.view.physicalSize = const Size(320 * 3, 640 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  return tester.pumpWidget(
    MaterialApp(
      locale: locale,
      theme: brightness == Brightness.light ? AppTheme.light : AppTheme.dark,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      home: MediaQuery(
        data: const MediaQueryData(textScaler: TextScaler.linear(1.4), size: Size(320, 640)),
        child: Scaffold(body: SingleChildScrollView(child: child)),
      ),
    ),
  );
}

void main() {
  for (final brightness in Brightness.values) {
    group('on a narrow phone, ${brightness.name}', () {
      testWidgets('the summary header fits and shows the sitting', (tester) async {
        final recorder = sitting();

        await pump(
          tester,
          ChantSummaryHeader(
            sittingTime: const Duration(hours: 1, minutes: 5, seconds: 9),
            malaTime: const Duration(seconds: 3),
            currentMala: recorder.currentMala,
            beadsInMala: recorder.beadsInMala,
            beadsPerRound: 108,
            stats: recorder.stats,
          ),
          brightness: brightness,
        );

        expect(tester.takeException(), isNull);
        expect(find.text('1:05:09'), findsOneWidget);
        expect(find.text('2/108'), findsOneWidget);
      });

      testWidgets('recent chants show their time and seconds', (tester) async {
        await pump(tester, ChantRecentTaps(taps: sitting().taps), brightness: brightness);

        expect(tester.takeException(), isNull);
        expect(find.text('#6'), findsOneWidget);
        expect(find.text('1.8s'), findsWidgets);
      });

      testWidgets('the round actions fit with finish beside undo', (tester) async {
        await pump(
          tester,
          ChantRoundActions(onUndo: () {}, onFinish: () {}),
          brightness: brightness,
        );

        expect(tester.takeException(), isNull);
        expect(find.text('Finish round'), findsOneWidget);
        expect(find.byTooltip('Undo last bead'), findsOneWidget);
      });

      testWidgets('the auto count card fits while a recording plays', (tester) async {
        await pump(tester, autoCard(resting: true), brightness: brightness);

        expect(tester.takeException(), isNull);
        expect(find.text('Resting while the recording plays'), findsOneWidget);
      });

      testWidgets('the report lists each round, and only the round', (tester) async {
        await pump(
          tester,
          ChantMalaReport(malas: sitting().malas, totalTime: const Duration(minutes: 2)),
          brightness: brightness,
        );

        expect(tester.takeException(), isNull);
        expect(find.text('Mala 1'), findsOneWidget);
        expect(find.text('Mala 2'), findsOneWidget);

        await tester.ensureVisible(find.text('Mala 1'));
        await tester.tap(find.text('Mala 1'));
        await tester.pumpAndSettle();

        expect(tester.takeException(), isNull);
        expect(find.text('Mala 1'), findsOneWidget, reason: 'a round does not open into its chants');
        expect(find.text('hare krishna hare krishna'), findsNothing);
      });
    });
  }

  testWidgets('with nothing chanted the report says so instead of drawing zeroes', (tester) async {
    await pump(tester, const ChantMalaReport(malas: [], totalTime: Duration.zero));

    expect(find.textContaining('No chants yet'), findsOneWidget);
  });

  testWidgets('tapping the ring reports a tap', (tester) async {
    var taps = 0;
    await pump(
      tester,
      ChantDisc(
        beadsInRound: 3,
        roundsCompleted: 1,
        roundsLabel: 'Rounds',
        beadsPerRound: 108,
        pulse: 0,
        onTap: () => taps += 1,
      ),
    );

    await tester.tap(find.byType(ChantDisc));
    expect(taps, 1);
  });

  group('finishing a round early', () {
    testWidgets('the button is there only when it is offered, and reports a press', (tester) async {
      var finished = 0;

      await pump(tester, ChantRoundActions(onUndo: () {}, onFinish: null));
      expect(find.text('Finish round'), findsNothing);
      expect(find.byTooltip('Undo last bead'), findsOneWidget);

      await pump(tester, ChantRoundActions(onUndo: () {}, onFinish: () => finished += 1));
      await tester.tap(find.text('Finish round'));
      expect(finished, 1);
    });

    testWidgets('undo is dimmed, not removed, when there is nothing to take back', (tester) async {
      await pump(tester, ChantRoundActions(onUndo: null, onFinish: () {}));

      final undo = tester.widget<IconButton>(find.widgetWithIcon(IconButton, Icons.undo_rounded));
      expect(undo.onPressed, isNull);
      expect(find.text('Finish round'), findsOneWidget);
    });

    testWidgets('the button fits a narrow phone in every language', (tester) async {
      for (final locale in AppLocalizations.supportedLocales) {
        await pump(tester, ChantRoundActions(onUndo: () {}, onFinish: () {}), locale: locale);
        await tester.pumpAndSettle();

        expect(tester.takeException(), isNull, reason: '${locale.languageCode} overflows');
        expect(
          find.text(lookupAppLocalizations(locale).chantFinishRound),
          findsOneWidget,
          reason: '${locale.languageCode} does not show its own word for it',
        );
      }
    });

    testWidgets('the beads it adds are not listed among the recent chants', (tester) async {
      var now = DateTime(2026, 10, 6, 6);
      final recorder = ChantRecorder(beadsPerRound: 4, now: () => now);
      recorder.tap();
      now = now.add(const Duration(seconds: 2));
      recorder.tap();
      recorder.finishRound();

      await pump(tester, ChantRecentTaps(taps: recorder.taps));

      expect(find.text('#2'), findsOneWidget);
      expect(find.text('#1'), findsOneWidget);
      expect(find.text('#3'), findsNothing);
      expect(find.text('#4'), findsNothing);
    });

    testWidgets('a round that was only finished, with no chant of its own, lists none', (tester) async {
      final recorder = ChantRecorder(beadsPerRound: 4)..carry(2);
      recorder.finishRound();

      await pump(tester, ChantRecentTaps(taps: recorder.taps));

      expect(find.text('Tap the ring to begin.'), findsOneWidget);
      expect(find.text('#1'), findsNothing);
    });
  });

  group('while a recording plays', () {
    testWidgets('a toggle row that is not enabled cannot be turned', (tester) async {
      final changes = <bool>[];
      Widget row({required bool enabled}) => ChantToggleRow(
        icon: Icons.mic_rounded,
        title: 'Use the microphone',
        status: 'Listens to your chanting',
        value: true,
        onChanged: changes.add,
        enabled: enabled,
      );

      await pump(tester, row(enabled: false));
      expect(tester.widget<Switch>(find.byType(Switch)).onChanged, isNull);
      await tester.tap(find.byType(Switch), warnIfMissed: false);
      expect(changes, isEmpty);

      await pump(tester, row(enabled: true));
      expect(tester.widget<Switch>(find.byType(Switch)).onChanged, isNotNull);
      await tester.tap(find.byType(Switch));
      expect(changes, [false]);
    });

    testWidgets('auto count rests: shown off, saying why, and it cannot be turned', (tester) async {
      final changes = <bool>[];
      const listening = AutoChantStatus(enabled: true, phase: AutoChantPhase.listening);

      await pump(tester, AutoChantSwitch(status: listening, onChanged: changes.add, resting: true));
      expect(find.text('Resting while the recording plays'), findsOneWidget);
      final resting = tester.widget<Switch>(find.byType(Switch));
      expect(resting.value, isFalse);
      expect(resting.onChanged, isNull);

      // The recording is paused: it is what it was, and can be turned again.
      await pump(tester, AutoChantSwitch(status: listening, onChanged: changes.add));
      expect(find.text('Resting while the recording plays'), findsNothing);
      expect(find.text('Listening…'), findsOneWidget);
      final live = tester.widget<Switch>(find.byType(Switch));
      expect(live.value, isTrue);
      expect(live.onChanged, isNotNull);

      await tester.tap(find.byType(Switch));
      expect(changes, [false]);
    });

    testWidgets('auto count that is off says so, not that it is resting', (tester) async {
      await pump(tester, AutoChantSwitch(status: AutoChantStatus.off, onChanged: (_) {}));

      expect(find.text('Off — tap a bead yourself'), findsOneWidget);
      expect(find.text('Resting while the recording plays'), findsNothing);
      expect(tester.widget<Switch>(find.byType(Switch)).onChanged, isNotNull);
    });

    testWidgets('the card rests both switches and leaves the chant time alone', (tester) async {
      final paceSteps = <bool>[];

      await pump(tester, autoCard(resting: true, paceSteps: paceSteps));
      final switches = tester.widgetList<Switch>(find.byType(Switch)).toList();
      expect(switches, hasLength(2));
      expect(switches.map((toggle) => toggle.onChanged), everyElement(isNull));
      expect(switches.first.value, isFalse, reason: 'auto count is shown off while it rests');
      expect(switches.last.value, isTrue, reason: 'the microphone choice is not changed');

      await tester.tap(find.byTooltip('Longer chant time'));
      expect(paceSteps, [true]);

      await pump(tester, autoCard(resting: false, paceSteps: paceSteps));
      final live = tester.widgetList<Switch>(find.byType(Switch)).toList();
      expect(live.map((toggle) => toggle.onChanged), everyElement(isNotNull));
      expect(live.first.value, isTrue);
    });
  });

  group('the line under the opening prayer', () {
    testWidgets('says to tap the ring unless the recording carries the prayer', (tester) async {
      const tapRing = 'Chant this prayer first, then tap the ring to begin counting.';

      await pump(tester, const ChantMantraText(mantra: _mantra, prayer: _prayer));
      expect(find.text('Panchatattva'), findsOneWidget);
      expect(find.text(tapRing), findsOneWidget);

      await pump(
        tester,
        const ChantMantraText(mantra: _mantra, prayer: _prayer, prayerHint: 'Press play.'),
      );
      expect(find.text('Press play.'), findsOneWidget);
      expect(find.text(tapRing), findsNothing);
    });

    testWidgets('belongs to the prayer: the mantra on its own shows no hint', (tester) async {
      await pump(tester, const ChantMantraText(mantra: _mantra, prayerHint: 'Press play.'));

      expect(find.text('Hare Krishna Hare Krishna'), findsOneWidget);
      expect(find.text('Press play.'), findsNothing);
    });
  });
}
