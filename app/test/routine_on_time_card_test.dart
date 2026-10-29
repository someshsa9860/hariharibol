// The routine screen's card asking for alerts right on time ("Alarms and
// reminders" on Android): shown only where it would change something, while
// an alert is coming, and not again for a while after "Not now".

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/constants/routine_config.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/routine_data.dart';
import 'package:hariharibol/models/routine_task.dart';
import 'package:hariharibol/providers/routine_alert_provider.dart';
import 'package:hariharibol/providers/routine_provider.dart';
import 'package:hariharibol/services/routine_alert_service.dart';
import 'package:hariharibol/widgets/routine/routine_on_time_card.dart';

/// The system's side: whether asking would change anything, and what the
/// reader does on the settings page.
class _FakeAccess implements RoutineOnTimeAccess {
  _FakeAccess({required this.needs, this.allows = true});

  bool needs;
  final bool allows;
  int asked = 0;

  @override
  Future<bool> needed() async => needs;

  @override
  Future<bool> ask() async {
    asked++;
    if (allows) needs = false;
    return allows;
  }
}

/// "Not now" kept in memory: a store write under the test's clock would hang
/// the next test.
class _Dismissed extends RoutineOnTimeDismissedNotifier {
  _Dismissed(this.initial);

  final DateTime? initial;

  @override
  DateTime? build() => initial;

  @override
  Future<void> dismiss(DateTime at) async => state = at;
}

class _Routine extends RoutineNotifier {
  _Routine(this.data);

  final RoutineData data;

  @override
  RoutineData build() => data;
}

/// A task with a time range tomorrow evening: an alert is coming.
RoutineData _alertComing() {
  final now = DateTime.now();
  return RoutineData(
    tasks: [
      RoutineTask(
        id: 't1',
        title: 'Evening chanting',
        day: routineDayKey(DateTime(now.year, now.month, now.day + 1)),
        window: const RoutineWindow(start: 18 * 60, end: 19 * 60),
      ),
    ],
  );
}

void main() {
  late _FakeAccess access;
  late ProviderContainer container;

  Future<void> show(
    WidgetTester tester, {
    DateTime? dismissed,
    RoutineData? routine,
  }) async {
    await tester.pumpWidget(
      ProviderScope(
        // A fresh scope each time: a scope that is kept keeps its first overrides.
        key: UniqueKey(),
        overrides: [
          routineOnTimeAccessProvider.overrideWithValue(access),
          routineOnTimeDismissedProvider.overrideWith(() => _Dismissed(dismissed)),
          routineProvider.overrideWith(() => _Routine(routine ?? _alertComing())),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const Scaffold(body: Column(children: [RoutineOnTimeCard()])),
        ),
      ),
    );
    container = ProviderScope.containerOf(tester.element(find.byType(RoutineOnTimeCard)));
    // The system is asked after the first frame.
    await tester.pumpAndSettle();
  }

  final title = find.text('Alerts right on time');

  testWidgets('is shown where alerts can be held back and one is coming', (tester) async {
    access = _FakeAccess(needs: true);
    await show(tester);

    expect(title, findsOneWidget);
    expect(find.text('Allow'), findsOneWidget);
    expect(find.text('Not now'), findsOneWidget);
  });

  testWidgets('is not shown where alerts already come on time', (tester) async {
    access = _FakeAccess(needs: false);
    await show(tester);

    expect(title, findsNothing);
  });

  testWidgets('is not shown when no task has an alert coming', (tester) async {
    access = _FakeAccess(needs: true);
    await show(tester, routine: const RoutineData());

    expect(title, findsNothing);
  });

  testWidgets('rests after "Not now", and asks again once that has passed', (tester) async {
    access = _FakeAccess(needs: true);
    await show(tester, dismissed: DateTime.now().subtract(const Duration(days: 1)));
    expect(title, findsNothing);

    final longAgo = DateTime.now().subtract(RoutineConfig.onTimeAskAgain + const Duration(days: 1));
    await show(tester, dismissed: longAgo);
    expect(title, findsOneWidget);
  });

  testWidgets('"Not now" puts it away and notes when', (tester) async {
    access = _FakeAccess(needs: true);
    await show(tester);

    await tester.tap(find.text('Not now'));
    await tester.pumpAndSettle();

    expect(title, findsNothing);
    expect(container.read(routineOnTimeDismissedProvider), isNotNull);
    expect(access.asked, 0);
  });

  testWidgets('"Allow" opens the system page; allowed there, the card goes', (tester) async {
    access = _FakeAccess(needs: true);
    await show(tester);

    await tester.tap(find.text('Allow'));
    await tester.pumpAndSettle();

    expect(access.asked, 1);
    expect(title, findsNothing);
  });

  testWidgets('not allowed there, the card stays and can be asked again', (tester) async {
    access = _FakeAccess(needs: true, allows: false);
    await show(tester);

    await tester.tap(find.text('Allow'));
    await tester.pumpAndSettle();
    expect(title, findsOneWidget);

    await tester.tap(find.text('Allow'));
    await tester.pumpAndSettle();
    expect(access.asked, 2);
  });

  testWidgets('allowed by hand in the settings, it goes when the app comes back', (tester) async {
    access = _FakeAccess(needs: true);
    await show(tester);
    expect(title, findsOneWidget);

    access.needs = false;
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();

    expect(title, findsNothing);
  });
}
