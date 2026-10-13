import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/constants/storage_keys.dart';
import 'package:hariharibol/core/theme/app_colors.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/routine_task.dart';
import 'package:hariharibol/providers/routine_provider.dart';
import 'package:hariharibol/services/local_store.dart';
import 'package:hariharibol/views/dashboard/routine_tab.dart';
import 'package:hariharibol/widgets/routine/routine_task_tile.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory dir;

  setUpAll(() async {
    dir = await Directory.systemTemp.createTemp('hariharibol_routine_check');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/path_provider'),
          (call) async => dir.path,
        );
    await LocalStore.instance.init();
  });

  // Not `Hive.close()`: see routine_sheet_test.dart.
  tearDownAll(() {
    if (dir.existsSync()) dir.deleteSync(recursive: true);
  });

  setUp(() => LocalStore.instance.clear());

  Widget app({Brightness brightness = Brightness.light}) => ProviderScope(
    child: MaterialApp(
      theme: brightness == Brightness.light ? AppTheme.light : AppTheme.dark,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: const RoutineTab(),
    ),
  );

  void phone(WidgetTester tester) {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
  }

  String todayKey() => routineDayKey(DateTime.now());

  Map<String, Object?> stored({
    required String id,
    required String title,
    int? start,
    int? end,
    int? doneAt,
    bool done = false,
    String category = 'devotion',
  }) => {
    'id': id,
    'title': title,
    'category': category,
    'slot': 'anytime',
    'isDone': done,
    'day': todayKey(),
    'windowStart': ?start,
    'windowEnd': ?end,
    'doneAt': ?doneAt,
  };

  Future<void> seed(WidgetTester tester, List<Map<String, Object?>> tasks) =>
      tester.runAsync(
        () => LocalStore.instance.write(BoxKeys.routineTasks, tasks),
      );

  ProviderContainer container(WidgetTester tester) =>
      ProviderScope.containerOf(tester.element(find.byType(RoutineTab)));

  RoutineTask taskNamed(WidgetTester tester, String title) => container(
    tester,
  ).read(routineDayProvider(todayKey())).firstWhere((t) => t.title == title);

  // A save writes three keys one after the other in the background of the
  // test's fake clock, and every step of every write needs a real moment and
  // then a pump to hand control on; a write queued behind them says when they
  // are done. See routine_sheet_test.dart.
  Future<void> settleSaves(WidgetTester tester) async {
    // A save's next write is only started when the one before it finishes, so
    // a single probe can land between two of them. Three writes need three
    // probes, one after the other, and a spare.
    for (var probe = 0; probe < 4; probe++) {
      var landed = false;
      LocalStore.instance
          .write('test.settled', probe)
          .then((_) => landed = true);
      for (var round = 0; round < 100 && !landed; round++) {
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 20)),
        );
        await tester.pump();
      }
      expect(landed, isTrue, reason: 'the saves did not finish');
    }
    // The store's write lock is a chain of futures, and the last one is now
    // made in this test's clock, which is gone by the next test's `setUp`; a
    // write that waits on it there never wakes. End the chain in real time.
    await tester.runAsync(() => LocalStore.instance.write('test.settled', -1));
  }

  Finder rowOf(String title) => find.ancestor(
    of: find.text(title),
    matching: find.byType(RoutineTaskTile),
  );

  Finder pillIn(String title, String word) => find.descendant(
    of: rowOf(title),
    matching: find.textContaining('$word · '),
  );

  /// Fills the open time picker through its keyboard entry.
  Future<void> enterTime(
    WidgetTester tester, {
    required int hour,
    required int minute,
  }) async {
    await tester.tap(find.byIcon(Icons.keyboard_outlined));
    await tester.pumpAndSettle();
    final fields = find.descendant(
      of: find.byType(TimePickerDialog),
      matching: find.byType(TextField),
    );
    await tester.enterText(fields.at(0), '$hour');
    await tester.enterText(fields.at(1), minute.toString().padLeft(2, '0'));
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();
  }

  group('ticking a task', () {
    testWidgets('notes the time it is now', (tester) async {
      phone(tester);
      await seed(tester, [stored(id: 'a', title: 'Errand')]);
      await tester.pumpWidget(app());
      await tester.pumpAndSettle();

      final before = routineMinuteOf(DateTime.now());
      await tester.tap(find.text('Errand'));
      await tester.pumpAndSettle();
      final after = routineMinuteOf(DateTime.now());

      final task = taskNamed(tester, 'Errand');
      expect(task.isDone, isTrue);
      expect(task.doneAt, anyOf(before, after));
      // No time range to be judged against: plain done, with its time.
      expect(task.status, RoutineStatus.done);
      expect(pillIn('Errand', 'Done'), findsOneWidget);
      await settleSaves(tester);
    });

    testWidgets('inside the range it is on time', (tester) async {
      phone(tester);
      // The whole day, so it is on time whenever the test runs.
      await seed(tester, [
        stored(id: 'a', title: 'All day', start: 0, end: 24 * 60 - 1),
      ]);
      await tester.pumpWidget(app());
      await tester.pumpAndSettle();

      await tester.tap(find.text('All day'));
      await tester.pumpAndSettle();

      expect(taskNamed(tester, 'All day').status, RoutineStatus.onTime);
      expect(pillIn('All day', 'On time'), findsOneWidget);
      await settleSaves(tester);
    });

    testWidgets('unticking it takes the time off', (tester) async {
      phone(tester);
      await seed(tester, [
        stored(
          id: 'a',
          title: 'Japa',
          start: 6 * 60,
          end: 7 * 60,
          done: true,
          doneAt: 6 * 60 + 30,
        ),
      ]);
      await tester.pumpWidget(app());
      await tester.pumpAndSettle();
      expect(pillIn('Japa', 'On time'), findsOneWidget);

      await tester.tap(find.text('Japa'));
      await tester.pumpAndSettle();

      final task = taskNamed(tester, 'Japa');
      expect(task.isDone, isFalse);
      expect(task.doneAt, isNull);
      expect(task.window, const RoutineWindow(start: 360, end: 420));
      expect(find.textContaining(' · '), findsNothing);
      await settleSaves(tester);
    });

    testWidgets('a daily item keeps its time for the day it was ticked', (
      tester,
    ) async {
      phone(tester);
      await tester.pumpWidget(app());
      await tester.pumpAndSettle();
      await tester.runAsync(
        () => container(tester)
            .read(routineProvider.notifier)
            .addDaily(
              title: 'Morning japa',
              category: RoutineCategory.devotion,
              window: const RoutineWindow(start: 0, end: 24 * 60 - 1),
            ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Morning japa'));
      await tester.pumpAndSettle();

      expect(taskNamed(tester, 'Morning japa').status, RoutineStatus.onTime);
      expect(find.text('1 of 1 done'), findsOneWidget);
      await settleSaves(tester);
    });
  });

  group('what a done task shows', () {
    // 10:00–11:00 done at 9:00 is early; 6:00–7:00 done at 6:30 is on time and
    // done at 9:00 is late.
    final seeded = [
      stored(id: 'e', title: 'Early one', start: 600, end: 660, done: true, doneAt: 540),
      stored(id: 'o', title: 'On time one', start: 360, end: 420, done: true, doneAt: 390),
      stored(id: 'l', title: 'Late one', start: 360, end: 420, done: true, doneAt: 540),
      stored(id: 'p', title: 'Pending one', start: 780, end: 840),
    ];

    for (final brightness in Brightness.values) {
      testWidgets('is worded and coloured by how on time it was in ${brightness.name}', (
        tester,
      ) async {
        phone(tester);
        await seed(tester, seeded);
        await tester.pumpWidget(app(brightness: brightness));
        await tester.pumpAndSettle();

        final isLight = brightness == Brightness.light;
        final scheme = (isLight ? AppTheme.light : AppTheme.dark).colorScheme;

        // The words.
        expect(pillIn('Early one', 'Early'), findsOneWidget);
        expect(pillIn('On time one', 'On time'), findsOneWidget);
        expect(pillIn('Late one', 'Late'), findsOneWidget);
        expect(find.descendant(of: rowOf('Pending one'), matching: find.textContaining(' · ')), findsNothing);

        // The colours, on the mark at the start of each row.
        Color? markOf(String title, IconData icon) => tester
            .widget<Icon>(
              find.descendant(of: rowOf(title), matching: find.byIcon(icon)),
            )
            .color;
        const done = Icons.check_circle_rounded;
        expect(markOf('Early one', done), AppColors.early(isLight: isLight));
        expect(markOf('On time one', done), AppColors.onTime(isLight: isLight));
        expect(markOf('Late one', done), AppColors.late(isLight: isLight));
        expect(
          markOf('Pending one', Icons.radio_button_unchecked_rounded),
          scheme.onSurfaceVariant,
        );
      });
    }

    testWidgets('shows the time range under the name', (tester) async {
      phone(tester);
      await seed(tester, seeded);
      await tester.pumpWidget(app());
      await tester.pumpAndSettle();

      expect(
        find.descendant(
          of: rowOf('Pending one'),
          matching: find.byIcon(Icons.schedule_rounded),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: rowOf('Pending one'),
          matching: find.textContaining('–'),
        ),
        findsOneWidget,
      );
    });

    testWidgets('speaks the status to a screen reader, not only shows it', (
      tester,
    ) async {
      phone(tester);
      final handle = tester.ensureSemantics();
      await seed(tester, seeded);
      await tester.pumpWidget(app());
      await tester.pumpAndSettle();

      expect(find.bySemanticsLabel(RegExp(r'^Late · ')), findsOneWidget);
      // The row reads as one: its mark, then its name and range.
      expect(find.bySemanticsLabel(RegExp('^Not done')), findsOneWidget);
      handle.dispose();
    });
  });

  group('changing the time', () {
    testWidgets('moves a late task to on time, and back', (tester) async {
      phone(tester);
      await seed(tester, [
        stored(
          id: 'a',
          title: 'Japa',
          start: 6 * 60,
          end: 7 * 60,
          done: true,
          doneAt: 9 * 60,
        ),
      ]);
      await tester.pumpWidget(app());
      await tester.pumpAndSettle();
      expect(pillIn('Japa', 'Late'), findsOneWidget);

      // The pill is its own button: it asks for a time, it does not untick.
      await tester.tap(find.descendant(of: rowOf('Japa'), matching: find.byIcon(Icons.edit_outlined)));
      await tester.pumpAndSettle();
      expect(find.text('When was this done?'), findsOneWidget);
      await enterTime(tester, hour: 6, minute: 45);

      var task = taskNamed(tester, 'Japa');
      expect(task.isDone, isTrue);
      expect(task.doneAt, 6 * 60 + 45);
      expect(task.status, RoutineStatus.onTime);
      expect(pillIn('Japa', 'On time'), findsOneWidget);

      await tester.tap(find.descendant(of: rowOf('Japa'), matching: find.byIcon(Icons.edit_outlined)));
      await tester.pumpAndSettle();
      await enterTime(tester, hour: 5, minute: 15);
      task = taskNamed(tester, 'Japa');
      expect(task.doneAt, 5 * 60 + 15);
      expect(task.status, RoutineStatus.early);
      expect(pillIn('Japa', 'Early'), findsOneWidget);
      await settleSaves(tester);
    });

    testWidgets('closing the picker changes nothing', (tester) async {
      phone(tester);
      await seed(tester, [
        stored(id: 'a', title: 'Japa', start: 360, end: 420, done: true, doneAt: 540),
      ]);
      await tester.pumpWidget(app());
      await tester.pumpAndSettle();

      await tester.tap(find.descendant(of: rowOf('Japa'), matching: find.byIcon(Icons.edit_outlined)));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();

      expect(taskNamed(tester, 'Japa').doneAt, 540);
      expect(pillIn('Japa', 'Late'), findsOneWidget);
    });

    testWidgets('a task from before times were kept can be given one', (
      tester,
    ) async {
      phone(tester);
      await seed(tester, [
        stored(id: 'a', title: 'Old', start: 360, end: 420, done: true),
      ]);
      await tester.pumpWidget(app());
      await tester.pumpAndSettle();
      expect(taskNamed(tester, 'Old').status, RoutineStatus.done);
      expect(find.text('Done'), findsOneWidget);

      await tester.tap(find.byIcon(Icons.edit_outlined));
      await tester.pumpAndSettle();
      await enterTime(tester, hour: 6, minute: 30);

      expect(taskNamed(tester, 'Old').status, RoutineStatus.onTime);
      await settleSaves(tester);
    });
  });
}
