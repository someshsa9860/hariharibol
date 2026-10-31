// The form a task is changed in: what it offers for a task of one day, a
// daily item on a day and an item on the daily list, and what it hands back.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/routine_task.dart';
import 'package:hariharibol/widgets/routine/add_routine_task_sheet.dart';

void main() {
  const window = RoutineWindow(start: 6 * 60, end: 7 * 60);
  const oneDay = RoutineTask(
    id: 't1',
    title: 'Temple visit',
    category: RoutineCategory.devotion,
    window: window,
    day: '2026-10-28',
  );
  const daily = RoutineTask(
    id: 'd1',
    title: 'Morning japa',
    category: RoutineCategory.devotion,
    window: window,
    day: '2026-10-28',
    isDaily: true,
  );

  RoutineTaskEdit? result;
  var closed = false;

  Future<void> open(WidgetTester tester, RoutineTask task, {bool fromDailyList = false}) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    result = null;
    closed = false;

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () async {
                result = await showEditRoutineTaskSheet(context, task, fromDailyList: fromDailyList);
                closed = true;
              },
              child: const Text('open'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
  }

  Future<void> tapVisible(WidgetTester tester, Finder finder) async {
    await tester.ensureVisible(finder);
    await tester.pumpAndSettle();
    await tester.tap(finder);
    await tester.pumpAndSettle();
  }

  testWidgets('a task of one day can be made to repeat every day', (tester) async {
    await open(tester, oneDay);

    expect(find.text('Edit task'), findsOneWidget);
    expect(find.text('Delete task'), findsOneWidget);
    await tapVisible(tester, find.text('Repeat every day'));
    expect(find.text('Shows on every day from this day on.'), findsOneWidget);

    await tapVisible(tester, find.text('Save changes'));

    expect(closed, isTrue);
    final draft = result!.draft!;
    expect(result!.delete, isFalse);
    expect(draft.daily, isTrue);
    expect(draft.title, 'Temple visit');
    expect(draft.category, RoutineCategory.devotion);
    expect(draft.window, window);
  });

  testWidgets('Delete hands back a deletion', (tester) async {
    await open(tester, oneDay);

    await tapVisible(tester, find.text('Delete task'));

    expect(closed, isTrue);
    expect(result!.delete, isTrue);
    expect(result!.draft, isNull);
  });

  testWidgets('a daily item on a day is removed from that day on, or made to stop repeating', (tester) async {
    await open(tester, daily);

    expect(find.text('Remove from this day on'), findsOneWidget);
    expect(find.text('Changes apply from this day on. Earlier days keep it as it was.'), findsOneWidget);

    await tapVisible(tester, find.text('Repeat every day'));
    expect(find.text('Stays on this day only and stops repeating after it.'), findsOneWidget);

    await tapVisible(tester, find.text('Save changes'));
    expect(result!.draft!.daily, isFalse);
  });

  testWidgets('from the daily list it changes from today on, with no switch and no delete', (tester) async {
    await open(tester, daily, fromDailyList: true);

    expect(find.text('Changes apply from today on. Earlier days keep it as it was.'), findsOneWidget);
    expect(find.text('Repeat every day'), findsNothing);
    expect(find.text('Remove from this day on'), findsNothing);
  });

  testWidgets('closed without saving hands back nothing', (tester) async {
    await open(tester, oneDay);

    // As the back button or a swipe down would.
    Navigator.of(tester.element(find.text('Edit task'))).pop();
    await tester.pumpAndSettle();

    expect(closed, isTrue);
    expect(result, isNull);
  });
}
