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
import 'package:hariharibol/services/ekadashi_calendar.dart';
import 'package:hariharibol/services/local_store.dart';
import 'package:hariharibol/views/dashboard/routine_tab.dart';
import 'package:hariharibol/widgets/common/vaishnava_tilak_icon.dart';
import 'package:hariharibol/widgets/routine/routine_day_chip.dart';
import 'package:hive_ce_flutter/hive_flutter.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Ekadashi', () {
    // Sunrise in India, whatever zone the test machine is in.
    final calendar = EkadashiCalendar(
      momentOf: (y, m, d, h) =>
          DateTime.utc(y, m, d, h).subtract(const Duration(hours: 5, minutes: 30)),
    );

    List<int> inMonth(int year, int month) => [
      for (var d = 1; d <= 31; d++)
        if (DateTime(year, month, d).month == month &&
            calendar.isEkadashi(DateTime(year, month, d)))
          d,
    ];

    // The dates printed almanacs gave for 2025, except where they disagree
    // among themselves about the day (1–2 November).
    test('finds the dates of 2025', () {
      const expected = {
        1: [10, 25],
        2: [8, 24],
        3: [10, 25],
        4: [8, 24],
        5: [8, 23],
        6: [6, 21],
        7: [6, 21],
        8: [5, 19],
        9: [3, 17],
        10: [3, 17],
        12: [1, 15, 30],
      };
      expected.forEach((month, days) {
        expect(inMonth(2025, month), days, reason: 'month $month');
      });
      expect(inMonth(2025, 11), contains(15));
    });

    test('is twice a month, about 24 or 25 a year', () {
      var total = 0;
      for (var m = 1; m <= 12; m++) {
        final days = inMonth(2026, m);
        expect(days.length, inInclusiveRange(1, 3), reason: 'month $m');
        total += days.length;
      }
      expect(total, inInclusiveRange(23, 26));
    });

    test('a tithi is 1–30', () {
      final tithi = EkadashiCalendar.tithiAt(DateTime(2026, 1, 1, 6));
      expect(tithi, inInclusiveRange(1, 30));
    });
  });

  group('a daily item', () {
    final item = DailyRoutineItem(
      id: 'a',
      title: 'Japa',
      since: '2026-10-05',
    );

    test('applies from the day it began', () {
      expect(item.appliesOn('2026-10-04'), isFalse);
      expect(item.appliesOn('2026-10-05'), isTrue);
      expect(item.appliesOn('2027-01-01'), isTrue);
    });

    test('once removed, the days already lived keep it', () {
      final ended = item.endedOn('2026-10-09');
      expect(ended.isActive, isFalse);
      expect(ended.appliesOn('2026-10-07'), isTrue);
      expect(ended.appliesOn('2026-10-10'), isFalse);
    });
  });

  group('the routine', () {
    late Directory dir;

    setUpAll(() async {
      dir = await Directory.systemTemp.createTemp('hariharibol_routine');
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
            const MethodChannel('plugins.flutter.io/path_provider'),
            (call) async => dir.path,
          );
      await LocalStore.instance.init();
    });

    tearDownAll(() async {
      await Hive.close();
      if (dir.existsSync()) dir.deleteSync(recursive: true);
    });

    setUp(() => LocalStore.instance.clear());

    ProviderContainer container() {
      final c = ProviderContainer();
      addTearDown(c.dispose);
      return c;
    }

    final today = DateTime.now();
    final yesterday = today.subtract(const Duration(days: 1));
    final tomorrow = today.add(const Duration(days: 1));

    test('a task stays on the day it was added for', () async {
      final c = container();
      await c
          .read(routineProvider.notifier)
          .addTask(
            day: tomorrow,
            title: 'Temple visit',
            category: RoutineCategory.devotion,
            slot: RoutineSlot.morning,
          );

      expect(c.read(routineDayProvider(routineDayKey(tomorrow))), hasLength(1));
      expect(c.read(routineDayProvider(routineDayKey(today))), isEmpty);
    });

    test('the daily routine shows on today but not on days before it', () async {
      final c = container();
      final notifier = c.read(routineProvider.notifier);
      await notifier.addDaily(
        title: 'Japa',
        category: RoutineCategory.devotion,
        slot: RoutineSlot.morning,
      );

      expect(c.read(routineDayProvider(routineDayKey(today))), hasLength(1));
      expect(c.read(routineDayProvider(routineDayKey(tomorrow))), hasLength(1));
      expect(c.read(routineDayProvider(routineDayKey(yesterday))), isEmpty);
    });

    test('each day keeps its own check on a daily item', () async {
      final c = container();
      final notifier = c.read(routineProvider.notifier);
      await notifier.addDaily(
        title: 'Japa',
        category: RoutineCategory.devotion,
        slot: RoutineSlot.morning,
      );
      final onToday = c.read(routineDayProvider(routineDayKey(today))).single;
      await notifier.toggle(onToday);

      expect(c.read(routineDayProvider(routineDayKey(today))).single.isDone, isTrue);
      expect(
        c.read(routineDayProvider(routineDayKey(tomorrow))).single.isDone,
        isFalse,
      );

      await notifier.toggle(c.read(routineDayProvider(routineDayKey(today))).single);
      expect(c.read(routineDayProvider(routineDayKey(today))).single.isDone, isFalse);
    });

    test('removing a daily item takes it off today and keeps the checked past', () async {
      final c = container();
      final notifier = c.read(routineProvider.notifier);
      await notifier.addDaily(
        title: 'Japa',
        category: RoutineCategory.devotion,
        slot: RoutineSlot.morning,
      );
      await notifier.removeDaily(c.read(routineProvider).daily.single.id);

      expect(c.read(routineDayProvider(routineDayKey(today))), isEmpty);
    });

    test('it survives a restart', () async {
      final first = container();
      await first
          .read(routineProvider.notifier)
          .addDaily(
            title: 'Japa',
            category: RoutineCategory.devotion,
            slot: RoutineSlot.morning,
          );
      await first
          .read(routineProvider.notifier)
          .toggle(first.read(routineDayProvider(routineDayKey(today))).single);

      final second = container();
      final back = second.read(routineDayProvider(routineDayKey(today)));
      expect(back.single.title, 'Japa');
      expect(back.single.isDone, isTrue);
    });

    test('tasks saved before they had a day land on the day they were last open', () async {
      await LocalStore.instance.write(BoxKeys.routineDate, '2026-03-02');
      await LocalStore.instance.write(BoxKeys.routineTasks, [
        {'id': '1', 'title': 'Old task', 'category': 'work', 'slot': 'anytime', 'isDone': true},
      ]);

      final tasks = container().read(routineDayProvider('2026-03-02'));
      expect(tasks.single.title, 'Old task');
      expect(tasks.single.isDone, isTrue);
    });
  });

  group('the tab', () {
    late Directory dir;

    setUpAll(() async {
      dir = await Directory.systemTemp.createTemp('hariharibol_routine_ui');
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
            const MethodChannel('plugins.flutter.io/path_provider'),
            (call) async => dir.path,
          );
      await LocalStore.instance.init();
    });

    // Not `Hive.close()`: a save started inside a widget test's fake clock can
    // still be waiting there when the group ends, and close waits for it.
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

    testWidgets('shows a strip of days with a tilak on Ekadashi', (tester) async {
      tester.view.physicalSize = const Size(1080, 2200);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(app());
      await tester.pumpAndSettle();

      expect(find.byType(RoutineDayChip), findsWidgets);
      // Seven or so days are on screen; a fortnight has at most one Ekadashi
      // among them... and across the visible strip the tilak is a small icon.
      final visibleEkadashi = tester
          .widgetList<RoutineDayChip>(find.byType(RoutineDayChip))
          .where((chip) => chip.isEkadashi)
          .length;
      expect(find.byType(VaishnavaTilakIcon), findsNWidgets(visibleEkadashi));
    });

    testWidgets('the weekday initials are coloured by weekday', (tester) async {
      tester.view.physicalSize = const Size(1080, 2200);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(app());
      await tester.pumpAndSettle();

      for (final chip in tester.widgetList<RoutineDayChip>(find.byType(RoutineDayChip))) {
        final letter = tester.widget<Text>(
          find
              .descendant(of: find.byWidget(chip), matching: find.byType(Text))
              .first,
        );
        expect(
          letter.style?.color,
          AppColors.forWeekday(chip.day.weekday, isLight: true),
        );
      }
      expect(AppColors.forWeekday(DateTime.thursday, isLight: true), const Color(0xFFCA8A04));
      expect(AppColors.forWeekday(DateTime.saturday, isLight: false), AppColors.white);
    });

    testWidgets('opening an earlier day shows its own list', (tester) async {
      tester.view.physicalSize = const Size(1080, 2200);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);

      final yesterday = DateTime.now().subtract(const Duration(days: 1));
      await tester.runAsync(
        () => LocalStore.instance.write(BoxKeys.routineTasks, [
          {
            'id': '1',
            'title': 'Yesterday errand',
            'category': 'errand',
            'slot': 'anytime',
            'isDone': true,
            'day': routineDayKey(yesterday),
          },
        ]),
      );

      await tester.pumpWidget(app());
      await tester.pumpAndSettle();
      expect(find.text('Yesterday errand'), findsNothing);

      await tester.tap(
        find.byWidgetPredicate(
          (w) => w is RoutineDayChip && w.day == routineDay(yesterday),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Yesterday errand'), findsOneWidget);
      expect(find.text('Jump to today'), findsOneWidget);
    });

    // Last, on purpose: it saves in the background, and a save that is still
    // finishing when the next test clears the store would wait on it.
    testWidgets('a daily item added in the sheet shows on the day and can be checked', (tester) async {
      tester.view.physicalSize = const Size(1080, 2200);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(app());
      await tester.pumpAndSettle();

      await tester.tap(find.byTooltip('Daily routine'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Add to daily routine'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'Morning japa');
      await tester.tap(find.text('Add to every day'));
      await tester.pumpAndSettle();
      // Close the daily sheet.
      await tester.tapAt(const Offset(10, 10));
      await tester.pumpAndSettle();

      expect(find.text('Morning japa'), findsOneWidget);
      expect(find.text('0 of 1 done'), findsOneWidget);
      await tester.tap(find.text('Morning japa'));
      await tester.pumpAndSettle();
      expect(find.text('1 of 1 done'), findsOneWidget);

      // The taps saved to disk in the background; let that finish before the
      // next test clears the store, or the clear waits behind it forever. The
      // pump runs the completions the save left waiting in the test's clock.
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 200)),
      );
      await tester.pump();
    });
  });
}
