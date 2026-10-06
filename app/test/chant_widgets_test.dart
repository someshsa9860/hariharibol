// The counter's summary and analytics, drawn on a narrow phone at a large text
// size in both themes. What is being guarded is layout: six figures in a row of
// three, and a mala's three facts side by side, are exactly where a long
// number or a big font turns into a render overflow.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/chant_log.dart';
import 'package:hariharibol/services/chant_recorder.dart';
import 'package:hariharibol/widgets/chant/chant_disc.dart';
import 'package:hariharibol/widgets/chant/chant_mala_report.dart';
import 'package:hariharibol/widgets/chant/chant_recent_taps.dart';
import 'package:hariharibol/widgets/chant/chant_summary_header.dart';

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

Future<void> pump(WidgetTester tester, Widget child, {Brightness brightness = Brightness.light}) {
  tester.view.physicalSize = const Size(320 * 3, 640 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  return tester.pumpWidget(
    MaterialApp(
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

      testWidgets('the report lists each mala, opens it, and shows what was heard', (tester) async {
        await pump(
          tester,
          ChantMalaReport(malas: sitting().malas, totalTime: const Duration(minutes: 2)),
          brightness: brightness,
        );

        expect(tester.takeException(), isNull);
        expect(find.text('Mala 1'), findsOneWidget);
        expect(find.text('Mala 2'), findsOneWidget);
        expect(find.text('hare krishna hare krishna'), findsNothing);

        await tester.ensureVisible(find.text('Mala 1'));
        await tester.tap(find.text('Mala 1'));
        await tester.pumpAndSettle();

        expect(tester.takeException(), isNull);
        expect(find.text('hare krishna hare krishna'), findsOneWidget);
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
}
