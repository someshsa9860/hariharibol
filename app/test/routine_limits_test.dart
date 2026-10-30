// The bedtime limit: nobody goes to bed before noon. Judged for a preset in the
// setup, and for a task by its name in any of the app's languages. Wake-up has
// no limit.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/constants/routine_presets.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/widgets/routine/routine_limits.dart';

late BuildContext context;

Future<void> pumpApp(WidgetTester tester) async {
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('en'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Builder(
        builder: (built) {
          context = built;
          return const SizedBox();
        },
      ),
    ),
  );
}

int _at(int hour, [int minute = 0]) => hour * 60 + minute;

void main() {
  group('the bedtime limit', () {
    testWidgets('noon is the earliest allowed', (tester) async {
      await pumpApp(tester);
      expect(routinePresetLimitMessage(context, RoutinePreset.sleep, _at(12)), isNull);
    });

    testWidgets('there is no latest: 10:45 PM and 11:30 PM are allowed', (tester) async {
      await pumpApp(tester);
      expect(routinePresetLimitMessage(context, RoutinePreset.sleep, _at(22, 45)), isNull);
      expect(routinePresetLimitMessage(context, RoutinePreset.sleep, _at(23, 30)), isNull);
    });

    testWidgets('11:59 AM is refused, and the message names noon', (tester) async {
      await pumpApp(tester);
      expect(
        routinePresetLimitMessage(context, RoutinePreset.sleep, _at(11, 59)),
        "Bedtime can't be before 12:00 PM.",
      );
    });

    testWidgets('8:00 AM is refused the same way', (tester) async {
      await pumpApp(tester);
      expect(
        routinePresetLimitMessage(context, RoutinePreset.sleep, _at(8)),
        "Bedtime can't be before 12:00 PM.",
      );
    });
  });

  group('wake-up has no limit', () {
    testWidgets('1:00 AM, 4:15 AM, 5:00 AM and 11:59 PM are all allowed', (tester) async {
      await pumpApp(tester);
      for (final start in [_at(1), _at(4, 15), _at(5), _at(23, 59)]) {
        expect(
          routinePresetLimitMessage(context, RoutinePreset.wakeUp, start),
          isNull,
          reason: '$start',
        );
      }
    });

    testWidgets('no other routine is limited', (tester) async {
      await pumpApp(tester);
      final others = RoutinePreset.values.where((preset) => preset != RoutinePreset.sleep);
      for (final preset in others) {
        expect(routinePresetLimitMessage(context, preset, _at(1)), isNull, reason: preset.name);
        expect(routinePresetLimitMessage(context, preset, _at(23, 59)), isNull, reason: preset.name);
      }
    });
  });

  group('a task is held to the limit by its name', () {
    test('the bedtime name of every supported language is recognised', () {
      for (final locale in AppLocalizations.supportedLocales) {
        final text = lookupAppLocalizations(locale);
        expect(
          routineLimitedPresetOf(text.routinePresetSleep),
          RoutinePreset.sleep,
          reason: '${locale.languageCode}: ${text.routinePresetSleep}',
        );
      }
    });

    test('wake-up names are not limited, in any supported language', () {
      for (final locale in AppLocalizations.supportedLocales) {
        final text = lookupAppLocalizations(locale);
        expect(
          routineLimitedPresetOf(text.routinePresetWakeUp),
          isNull,
          reason: '${locale.languageCode}: ${text.routinePresetWakeUp}',
        );
      }
    });

    test('the name is matched without case or surrounding spaces', () {
      expect(routineLimitedPresetOf('sleep'), RoutinePreset.sleep);
      expect(routineLimitedPresetOf('  SLEEP  '), RoutinePreset.sleep);
    });

    test('any other name, or an empty one, is not limited', () {
      expect(routineLimitedPresetOf('Morning chanting'), isNull);
      expect(routineLimitedPresetOf('   '), isNull);
    });

    testWidgets('a task with no range is not checked', (tester) async {
      await pumpApp(tester);
      expect(routineLimitMessage(context, 'Sleep', null), isNull);
    });

    testWidgets('the limit applies to where the range starts', (tester) async {
      await pumpApp(tester);
      expect(
        routineLimitMessage(context, 'Sleep', (start: _at(11, 30), end: _at(23))),
        "Bedtime can't be before 12:00 PM.",
      );
      expect(
        routineLimitMessage(context, 'Sleep', (start: _at(12), end: _at(12, 30))),
        isNull,
      );
    });

    testWidgets('a task that is not limited is never refused', (tester) async {
      await pumpApp(tester);
      expect(
        routineLimitMessage(context, 'Exercise', (start: _at(0, 30), end: _at(1))),
        isNull,
      );
      expect(
        routineLimitMessage(context, 'Wake up', (start: _at(4, 15), end: _at(4, 45))),
        isNull,
      );
    });
  });
}
