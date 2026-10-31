// Changing a task from the day it is shown on: its name and time range,
// making it repeat every day or stop repeating, and deleting it with an undo.

import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/models/routine_task.dart';
import 'package:hariharibol/providers/routine_provider.dart';
import 'package:hariharibol/services/local_store.dart';
import 'package:hive_ce_flutter/hive_flutter.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory dir;

  setUpAll(() async {
    dir = await Directory.systemTemp.createTemp('hariharibol_routine_edit');
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

  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final yesterday = DateTime(now.year, now.month, now.day - 1);
  final tomorrow = DateTime(now.year, now.month, now.day + 1);
  final later = DateTime(now.year, now.month, now.day + 2);

  const morning = RoutineWindow(start: 6 * 60, end: 7 * 60);
  const dawn = RoutineWindow(start: 5 * 60, end: 6 * 60);
  const evening = RoutineWindow(start: 18 * 60, end: 19 * 60);

  List<RoutineTask> onDay(ProviderContainer c, DateTime day) =>
      c.read(routineProvider).on(routineDayKey(day));

  Map<String, int?> checksOn(ProviderContainer c, DateTime day) =>
      c.read(routineProvider).checks[routineDayKey(day)] ?? const {};

  group('a task of one day', () {
    test('is changed in place, ticked as it was', () async {
      final c = container();
      final notifier = c.read(routineProvider.notifier);
      await notifier.addTask(
        day: today,
        title: 'Temple',
        category: RoutineCategory.devotion,
        window: morning,
      );
      final task = onDay(c, today).single;
      await notifier.markDone(task, minute: 370);

      await notifier.editTask(
        onDay(c, today).single,
        title: 'Temple visit',
        category: RoutineCategory.home,
        window: evening,
        daily: false,
      );

      final changed = onDay(c, today).single;
      expect(changed.id, task.id);
      expect(changed.title, 'Temple visit');
      expect(changed.category, RoutineCategory.home);
      expect(changed.window, evening);
      expect(changed.slot, evening.slot);
      expect(changed.isDone, isTrue);
      expect(changed.doneAt, 370);
      expect(c.read(routineProvider).daily, isEmpty);
    });

    test('made daily repeats from its day on, its tick carried', () async {
      final c = container();
      final notifier = c.read(routineProvider.notifier);
      await notifier.addTask(
        day: today,
        title: 'Japa',
        category: RoutineCategory.devotion,
        window: morning,
      );
      final task = onDay(c, today).single;
      await notifier.markDone(task, minute: 400);

      await notifier.editTask(
        onDay(c, today).single,
        title: 'Japa',
        category: RoutineCategory.devotion,
        window: morning,
        daily: true,
      );

      final data = c.read(routineProvider);
      expect(data.tasks, isEmpty);
      final item = data.daily.single;
      expect(item.id, isNot(task.id));
      expect(item.since, routineDayKey(today));
      expect(item.isActive, isTrue);

      final onToday = onDay(c, today).single;
      expect(onToday.isDaily, isTrue);
      expect(onToday.isDone, isTrue);
      expect(onToday.doneAt, 400);
      expect(onDay(c, tomorrow).single.isDone, isFalse);
      expect(onDay(c, yesterday), isEmpty);
    });

    test('made daily when not ticked carries no tick', () async {
      final c = container();
      final notifier = c.read(routineProvider.notifier);
      await notifier.addTask(day: tomorrow, title: 'Japa', category: RoutineCategory.devotion);

      await notifier.editTask(
        onDay(c, tomorrow).single,
        title: 'Japa',
        category: RoutineCategory.devotion,
        daily: true,
      );

      expect(c.read(routineProvider).daily.single.since, routineDayKey(tomorrow));
      expect(onDay(c, tomorrow).single.isDone, isFalse);
      expect(onDay(c, today), isEmpty);
    });
  });

  group('a daily item', () {
    test('that began that day is changed in place', () async {
      final c = container();
      final notifier = c.read(routineProvider.notifier);
      await notifier.addDaily(title: 'Japa', category: RoutineCategory.devotion, window: morning);
      final item = c.read(routineProvider).daily.single;
      await notifier.markDone(onDay(c, today).single, minute: 360);

      await notifier.editTask(
        onDay(c, today).single,
        title: 'Morning japa',
        category: RoutineCategory.devotion,
        window: dawn,
        daily: true,
      );

      final changed = c.read(routineProvider).daily.single;
      expect(changed.id, item.id);
      expect(changed.since, item.since);
      expect(changed.title, 'Morning japa');
      expect(changed.window, dawn);
      expect(onDay(c, today).single.doneAt, 360);
    });

    test('that began earlier changes from that day on; earlier days keep it as it was', () async {
      final c = container();
      final notifier = c.read(routineProvider.notifier);
      await notifier.addDaily(
        title: 'Japa',
        category: RoutineCategory.devotion,
        window: morning,
        from: yesterday,
      );
      final old = c.read(routineProvider).daily.single;
      await notifier.markDone(onDay(c, yesterday).single, minute: 400);
      await notifier.markDone(onDay(c, today).single, minute: 370);
      await notifier.markDone(onDay(c, tomorrow).single, minute: 365);

      await notifier.editTask(
        onDay(c, today).single,
        title: 'Japa',
        category: RoutineCategory.devotion,
        window: dawn,
        daily: true,
      );

      final daily = c.read(routineProvider).daily;
      expect(daily, hasLength(2));
      final ended = daily.firstWhere((each) => each.id == old.id);
      final next = daily.firstWhere((each) => each.id != old.id);
      expect(ended.until, routineDayKey(yesterday));
      expect(next.since, routineDayKey(today));
      expect(next.isActive, isTrue);

      // Yesterday was ticked against the old range, and stays so.
      final onYesterday = onDay(c, yesterday).single;
      expect(onYesterday.id, old.id);
      expect(onYesterday.window, morning);
      expect(onYesterday.doneAt, 400);
      // Today's and tomorrow's ticks moved to the item as it is now.
      expect(onDay(c, today).single.id, next.id);
      expect(onDay(c, today).single.window, dawn);
      expect(onDay(c, today).single.doneAt, 370);
      expect(onDay(c, tomorrow).single.id, next.id);
      expect(onDay(c, tomorrow).single.doneAt, 365);
      expect(checksOn(c, today).containsKey(old.id), isFalse);
    });

    test('changed part-way keeps the day it was to end on', () async {
      final c = container();
      final notifier = c.read(routineProvider.notifier);
      await notifier.addDaily(title: 'Japa', category: RoutineCategory.devotion, from: yesterday);
      // Stops after tomorrow.
      await notifier.removeFromDay(onDay(c, later).single);

      await notifier.editTask(
        onDay(c, today).single,
        title: 'Evening japa',
        category: RoutineCategory.devotion,
        window: evening,
        daily: true,
      );

      final next = c.read(routineProvider).daily.firstWhere((each) => each.since == routineDayKey(today));
      expect(next.until, routineDayKey(tomorrow));
      expect(onDay(c, tomorrow).single.title, 'Evening japa');
      expect(onDay(c, later), isEmpty);
    });

    test('made not daily stays on that day only, with its tick', () async {
      final c = container();
      final notifier = c.read(routineProvider.notifier);
      await notifier.addDaily(title: 'Japa', category: RoutineCategory.devotion, from: yesterday);
      final old = c.read(routineProvider).daily.single;
      await notifier.markDone(onDay(c, yesterday).single, minute: 300);
      await notifier.markDone(onDay(c, today).single, minute: 360);

      await notifier.editTask(
        onDay(c, today).single,
        title: 'Japa',
        category: RoutineCategory.devotion,
        daily: false,
      );

      expect(c.read(routineProvider).daily.single.until, routineDayKey(yesterday));
      expect(onDay(c, yesterday).single.isDaily, isTrue);
      expect(onDay(c, yesterday).single.doneAt, 300);

      final onToday = onDay(c, today).single;
      expect(onToday.isDaily, isFalse);
      expect(onToday.id, isNot(old.id));
      expect(onToday.isDone, isTrue);
      expect(onToday.doneAt, 360);
      expect(checksOn(c, today).containsKey(old.id), isFalse);
      expect(onDay(c, tomorrow), isEmpty);
    });

    test('saved unchanged is left alone', () async {
      final c = container();
      final notifier = c.read(routineProvider.notifier);
      await notifier.addDaily(
        title: 'Japa',
        category: RoutineCategory.devotion,
        window: morning,
        from: yesterday,
      );
      final before = c.read(routineProvider);

      await notifier.editTask(
        onDay(c, today).single,
        title: 'Japa',
        category: RoutineCategory.devotion,
        window: morning,
        daily: true,
      );

      expect(identical(c.read(routineProvider), before), isTrue);
    });

    test('changed from the daily list changes from today on', () async {
      final c = container();
      final notifier = c.read(routineProvider.notifier);
      await notifier.addDaily(title: 'Japa', category: RoutineCategory.devotion, from: yesterday);

      await notifier.editDaily(
        c.read(routineProvider).daily.single,
        title: 'Morning japa',
        category: RoutineCategory.devotion,
        window: morning,
      );

      expect(onDay(c, yesterday).single.title, 'Japa');
      expect(onDay(c, today).single.title, 'Morning japa');
      expect(onDay(c, tomorrow).single.title, 'Morning japa');
    });

    test('added from a later day starts that day', () async {
      final c = container();
      await c
          .read(routineProvider.notifier)
          .addDaily(title: 'Japa', category: RoutineCategory.devotion, from: tomorrow);

      expect(onDay(c, today), isEmpty);
      expect(onDay(c, tomorrow), hasLength(1));
    });
  });

  group('deleting', () {
    test('a task of one day goes, and undo puts it back', () async {
      final c = container();
      final notifier = c.read(routineProvider.notifier);
      await notifier.addTask(day: today, title: 'Temple', category: RoutineCategory.devotion);
      await notifier.addTask(day: today, title: 'Groceries', category: RoutineCategory.errand);
      final temple = onDay(c, today).firstWhere((each) => each.title == 'Temple');
      await notifier.markDone(temple, minute: 420);

      final removal = await notifier.removeFromDay(onDay(c, today).firstWhere((each) => each.id == temple.id));
      expect(onDay(c, today).map((each) => each.title), ['Groceries']);

      // Something done in between is kept.
      await notifier.markDone(onDay(c, today).single, minute: 500);
      await notifier.undoRemoval(removal);

      final back = onDay(c, today).firstWhere((each) => each.id == temple.id);
      expect(back.doneAt, 420);
      expect(onDay(c, today).firstWhere((each) => each.title == 'Groceries').doneAt, 500);
    });

    test('a daily item stops from that day on, and undo brings back its ticks', () async {
      final c = container();
      final notifier = c.read(routineProvider.notifier);
      await notifier.addDaily(title: 'Japa', category: RoutineCategory.devotion, from: yesterday);
      final item = c.read(routineProvider).daily.single;
      await notifier.markDone(onDay(c, yesterday).single, minute: 300);
      await notifier.markDone(onDay(c, today).single, minute: 360);

      final removal = await notifier.removeFromDay(onDay(c, today).single);
      expect(onDay(c, today), isEmpty);
      expect(onDay(c, tomorrow), isEmpty);
      expect(onDay(c, yesterday).single.doneAt, 300);

      // Yesterday's tick is moved to another time before the undo.
      await notifier.markDone(onDay(c, yesterday).single, minute: 310);
      await notifier.undoRemoval(removal);

      final back = c.read(routineProvider).daily.single;
      expect(back.id, item.id);
      expect(back.isActive, isTrue);
      expect(onDay(c, today).single.doneAt, 360);
      expect(onDay(c, tomorrow).single.isDone, isFalse);
      expect(onDay(c, yesterday).single.doneAt, 310);
    });
  });
}
