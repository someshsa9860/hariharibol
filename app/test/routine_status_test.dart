import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/constants/routine_presets.dart';
import 'package:hariharibol/core/constants/storage_keys.dart';
import 'package:hariharibol/core/theme/app_colors.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/models/routine_task.dart';
import 'package:hariharibol/providers/routine_provider.dart';
import 'package:hariharibol/services/local_store.dart';
import 'package:hive_ce_flutter/hive_flutter.dart';

const _six = 6 * 60;

double _contrast(Color a, Color b) {
  final la = a.computeLuminance();
  final lb = b.computeLuminance();
  final high = la > lb ? la : lb;
  final low = la > lb ? lb : la;
  return (high + 0.05) / (low + 0.05);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('a time range', () {
    const window = RoutineWindow(start: _six, end: 7 * 60 + 30);

    test('both ends are on time, the minutes outside are not', () {
      expect(window.statusOf(_six - 1), RoutineStatus.early);
      expect(window.statusOf(_six), RoutineStatus.onTime);
      expect(window.statusOf(7 * 60), RoutineStatus.onTime);
      expect(window.statusOf(7 * 60 + 30), RoutineStatus.onTime);
      expect(window.statusOf(7 * 60 + 31), RoutineStatus.late);
    });

    test('must end after it starts and within the day', () {
      expect(RoutineWindow.isValid(_six, _six + 1), isTrue);
      expect(RoutineWindow.isValid(_six, _six), isFalse);
      expect(RoutineWindow.isValid(_six, _six - 1), isFalse);
      expect(RoutineWindow.isValid(-1, _six), isFalse);
      expect(RoutineWindow.isValid(_six, 24 * 60), isFalse);
      expect(RoutineWindow.isValid(0, 24 * 60 - 1), isTrue);
    });

    test('a stored range that is not one means no range', () {
      expect(
        RoutineWindow.fromJson({'windowStart': _six, 'windowEnd': _six}),
        isNull,
      );
      expect(RoutineWindow.fromJson({'windowStart': _six}), isNull);
      expect(RoutineWindow.fromJson({'windowStart': 'x', 'windowEnd': 9}), isNull);
      expect(
        RoutineWindow.fromJson({'windowStart': _six, 'windowEnd': 7 * 60}),
        window.copyWith(end: 7 * 60),
      );
    });

    test('puts a task in the slot its range opens in', () {
      expect(const RoutineWindow(start: 5 * 60, end: 20 * 60).slot, RoutineSlot.morning);
      expect(const RoutineWindow(start: 12 * 60, end: 14 * 60).slot, RoutineSlot.afternoon);
      expect(const RoutineWindow(start: 17 * 60, end: 18 * 60).slot, RoutineSlot.evening);
    });

    test('every standard routine is a range of its own', () {
      for (final preset in RoutinePreset.values) {
        expect(RoutineWindow.isValid(preset.start, preset.end), isTrue, reason: '$preset');
      }
      // In the order of the day, which is the order the menu lists them in.
      final starts = [for (final p in RoutinePreset.values) p.start];
      expect(starts, [...starts]..sort());
    });
  });

  group('how on time a task is', () {
    const window = RoutineWindow(start: _six, end: 7 * 60);
    const task = RoutineTask(id: '1', title: 'Japa', window: window);

    test('not ticked is pending, whatever the time', () {
      expect(task.status, RoutineStatus.pending);
    });

    test('ticked is early, on time or late by where the time falls', () {
      expect(task.doneAtMinute(_six - 30).status, RoutineStatus.early);
      expect(task.doneAtMinute(_six + 30).status, RoutineStatus.onTime);
      expect(task.doneAtMinute(7 * 60 + 1).status, RoutineStatus.late);
    });

    test('ticked with no time range, or no time kept, is plain done', () {
      const free = RoutineTask(id: '2', title: 'Errand');
      expect(free.doneAtMinute(_six).status, RoutineStatus.done);
      expect(
        const RoutineTask(id: '3', title: 'Old', window: window, isDone: true).status,
        RoutineStatus.done,
      );
    });

    test('changing the time moves the status, unticking clears the time', () {
      final late = task.doneAtMinute(9 * 60);
      expect(late.status, RoutineStatus.late);
      expect(late.doneAtMinute(_six + 5).status, RoutineStatus.onTime);

      final undone = late.notDone();
      expect(undone.isDone, isFalse);
      expect(undone.doneAt, isNull);
      expect(undone.window, window);
    });

    test('survives being saved', () {
      final back = RoutineTask.fromJson(task.doneAtMinute(_six + 5).toJson());
      expect(back.window, window);
      expect(back.doneAt, _six + 5);
      expect(back.status, RoutineStatus.onTime);

      final free = RoutineTask.fromJson(
        const RoutineTask(id: '4', title: 'No time').toJson(),
      );
      expect(free.window, isNull);
      expect(free.doneAt, isNull);
    });
  });

  group('the colours', () {
    // The card a row is drawn on, and the bar a graphic has to clear on it.
    final themes = {
      'light': (AppTheme.light, true),
      'dark': (AppTheme.dark, false),
    };

    themes.forEach((name, entry) {
      final (theme, isLight) = entry;
      final card = theme.cardTheme.color!;

      test('early, on time and late are 3:1 or better on a card in $name', () {
        for (final (label, color) in [
          ('early', AppColors.early(isLight: isLight)),
          ('on time', AppColors.onTime(isLight: isLight)),
          ('late', AppColors.late(isLight: isLight)),
        ]) {
          expect(
            _contrast(color, card),
            greaterThanOrEqualTo(3),
            reason: '$label in $name',
          );
        }
      });

      test('the words on the pill stay readable over each wash in $name', () {
        final ink = theme.colorScheme.onSurface;
        for (final color in [
          AppColors.early(isLight: isLight),
          AppColors.onTime(isLight: isLight),
          AppColors.late(isLight: isLight),
        ]) {
          final wash = Color.alphaBlend(color.withValues(alpha: 0.14), card);
          expect(_contrast(ink, wash), greaterThanOrEqualTo(4.5));
        }
      });

      test('the three are told apart in $name', () {
        final colors = {
          AppColors.early(isLight: isLight),
          AppColors.onTime(isLight: isLight),
          AppColors.late(isLight: isLight),
        };
        expect(colors, hasLength(3));
      });
    });

    test('early is yellow, on time green, late red', () {
      for (final isLight in [true, false]) {
        final early = HSLColor.fromColor(AppColors.early(isLight: isLight)).hue;
        final onTime = HSLColor.fromColor(AppColors.onTime(isLight: isLight)).hue;
        final late = HSLColor.fromColor(AppColors.late(isLight: isLight)).hue;
        expect(early, inInclusiveRange(35, 60), reason: 'yellow, light=$isLight');
        expect(onTime, inInclusiveRange(100, 160), reason: 'green, light=$isLight');
        expect(late, anyOf(inInclusiveRange(0, 15), inInclusiveRange(345, 360)));
      }
    });
  });

  group('what was stored before times were kept', () {
    late Directory dir;

    setUpAll(() async {
      dir = await Directory.systemTemp.createTemp('hariharibol_routine_status');
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

    test('a daily check saved as a list of ids still reads as done', () async {
      await LocalStore.instance.write(BoxKeys.routineDaily, [
        {'id': 'a', 'title': 'Japa', 'since': '2026-10-01', 'category': 'devotion'},
      ]);
      await LocalStore.instance.write(BoxKeys.routineChecks, {
        '2026-10-05': ['a'],
      });

      final task = container().read(routineDayProvider('2026-10-05')).single;
      expect(task.isDone, isTrue);
      expect(task.doneAt, isNull);
      expect(task.status, RoutineStatus.done);
    });

    test('a daily check keeps the time it was made at', () async {
      final c = container();
      final notifier = c.read(routineProvider.notifier);
      await notifier.addDaily(
        title: 'Japa',
        category: RoutineCategory.devotion,
        window: const RoutineWindow(start: _six, end: 7 * 60),
      );
      final today = routineDayKey(DateTime.now());
      await notifier.markDone(
        c.read(routineDayProvider(today)).single,
        minute: 7 * 60 + 20,
      );

      final back = container().read(routineDayProvider(today)).single;
      expect(back.doneAt, 7 * 60 + 20);
      expect(back.status, RoutineStatus.late);
    });

    test('a task is listed in the order of the day, those with no time last', () async {
      final c = container();
      final notifier = c.read(routineProvider.notifier);
      final day = DateTime.now();
      await notifier.addTask(day: day, title: 'Errand', category: RoutineCategory.errand);
      await notifier.addTask(
        day: day,
        title: 'Dinner',
        category: RoutineCategory.home,
        window: RoutinePreset.dinner.window,
      );
      await notifier.addTask(
        day: day,
        title: 'Breakfast',
        category: RoutineCategory.home,
        window: RoutinePreset.breakfast.window,
      );

      final titles = [
        for (final t in c.read(routineDayProvider(routineDayKey(day)))) t.title,
      ];
      expect(titles, ['Breakfast', 'Dinner', 'Errand']);
    });
  });
}
