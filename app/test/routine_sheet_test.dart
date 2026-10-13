import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/constants/routine_presets.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/routine_task.dart';
import 'package:hariharibol/providers/routine_provider.dart';
import 'package:hariharibol/services/local_store.dart';
import 'package:hariharibol/views/dashboard/routine_tab.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory dir;

  setUpAll(() async {
    dir = await Directory.systemTemp.createTemp('hariharibol_routine_sheet');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/path_provider'),
          (call) async => dir.path,
        );
    await LocalStore.instance.init();
  });

  // Not `Hive.close()`: a save started inside a widget test's fake clock can
  // still be waiting there when the file ends, and close waits for it.
  tearDownAll(() {
    if (dir.existsSync()) dir.deleteSync(recursive: true);
  });

  setUp(() => LocalStore.instance.clear());

  Widget app({Brightness brightness = Brightness.dark}) => ProviderScope(
    child: MaterialApp(
      theme: brightness == Brightness.light ? AppTheme.light : AppTheme.dark,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: const RoutineTab(),
    ),
  );

  // The phone in the bug report: a 360 x 800 dp screen, with the keyboard up
  // when asked to be.
  void phone(WidgetTester tester, {double keyboard = 0}) {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 3;
    tester.view.viewInsets = FakeViewPadding(bottom: keyboard);
    addTearDown(tester.view.reset);
  }

  Future<void> openSheet(WidgetTester tester) async {
    await tester.tap(find.byTooltip('Add task'));
    await tester.pumpAndSettle();
  }

  // Typed, as a person would to reach Dinner or Sleep: the menu is only a
  // few rows tall and the last of the nine are below its fold.
  Future<void> pickPreset(WidgetTester tester, String name) async {
    await tester.tap(find.byType(TextField));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), name);
    await tester.pumpAndSettle();
    await tester.tap(find.text(name).last);
    await tester.pumpAndSettle();
  }

  /// Fills the open time picker through its keyboard entry, which is the one
  /// way a test can reach an exact minute without dragging a dial.
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

  String time(WidgetTester tester, int minute) => MaterialLocalizations.of(
    tester.element(find.byType(Scaffold).first),
  ).formatTimeOfDay(TimeOfDay(hour: minute ~/ 60, minute: minute % 60));

  ProviderContainer container(WidgetTester tester) =>
      ProviderScope.containerOf(tester.element(find.byType(RoutineTab)));

  List<RoutineTask> today(WidgetTester tester) => container(
    tester,
  ).read(routineDayProvider(routineDayKey(DateTime.now())));

  // A save writes three keys one after the other in the background of the
  // test's fake clock, and every step of every write needs a real moment and
  // then a pump to hand control on. The next test must not clear the store
  // before they are done, or the clear waits behind them forever.
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

  Finder saveButton() => find.widgetWithText(FilledButton, 'Add to this day');

  bool canSave(WidgetTester tester) =>
      tester.widget<FilledButton>(saveButton()).onPressed != null;

  group('the add sheet above the keyboard', () {
    for (final brightness in Brightness.values) {
      testWidgets('does not overflow in ${brightness.name} mode', (
        tester,
      ) async {
        phone(tester, keyboard: 900);
        await tester.pumpWidget(app(brightness: brightness));
        await tester.pumpAndSettle();

        await openSheet(tester);
        expect(find.text('Add task'), findsWidgets);
        expect(tester.takeException(), isNull);

        // The tallest it gets: a name picked, so it has a range to show.
        await pickPreset(tester, 'Breakfast');
        expect(tester.takeException(), isNull);
        expect(canSave(tester), isTrue);
      });
    }

    testWidgets('keeps Save in reach on a short screen', (tester) async {
      // 360 x 640 dp, with a keyboard 250 dp tall.
      tester.view.physicalSize = const Size(1080, 1920);
      tester.view.devicePixelRatio = 3;
      tester.view.viewInsets = const FakeViewPadding(bottom: 750);
      addTearDown(tester.view.reset);

      await tester.pumpWidget(app());
      await tester.pumpAndSettle();
      await openSheet(tester);
      await pickPreset(tester, 'Wake up');

      expect(tester.takeException(), isNull);
      // Save sits above the keyboard, not behind it.
      final bottom = tester.getBottomLeft(saveButton()).dy;
      expect(bottom, lessThanOrEqualTo(640 - 250));
    });
  });

  group('the task name', () {
    testWidgets('a standard routine fills in its category and time range', (
      tester,
    ) async {
      phone(tester);
      await tester.pumpWidget(app());
      await tester.pumpAndSettle();
      await openSheet(tester);

      // Devotion is where a new task starts; Breakfast belongs to Home.
      await pickPreset(tester, 'Breakfast');

      expect(
        tester.widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'Home')).selected,
        isTrue,
      );
      expect(
        tester
            .widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'Devotion'))
            .selected,
        isFalse,
      );
      final breakfast = RoutinePreset.breakfast;
      expect(find.text(time(tester, breakfast.start)), findsWidgets);
      expect(find.text(time(tester, breakfast.end)), findsWidgets);
      expect(find.widgetWithText(TextField, 'Breakfast'), findsOneWidget);

      await tester.tap(saveButton());
      await tester.pumpAndSettle();

      final saved = today(tester).single;
      expect(saved.title, 'Breakfast');
      expect(saved.category, RoutineCategory.home);
      expect(saved.window, breakfast.window);
      expect(find.text('Breakfast'), findsOneWidget);
      await settleSaves(tester);
    });

    testWidgets('anything not on the menu can be typed', (tester) async {
      phone(tester);
      await tester.pumpWidget(app());
      await tester.pumpAndSettle();
      await openSheet(tester);

      expect(canSave(tester), isFalse);
      await tester.enterText(find.byType(TextField), '  Call mother  ');
      await tester.pump();
      expect(canSave(tester), isTrue);

      await tester.tap(find.widgetWithText(ChoiceChip, 'Errand'));
      await tester.pump();
      await tester.tap(saveButton());
      await tester.pumpAndSettle();

      final saved = today(tester).single;
      expect(saved.title, 'Call mother');
      expect(saved.category, RoutineCategory.errand);
      expect(saved.window, isNull);
      expect(find.text('Call mother'), findsOneWidget);
      await settleSaves(tester);
    });

    testWidgets('a name of only spaces is not a name', (tester) async {
      phone(tester);
      await tester.pumpWidget(app());
      await tester.pumpAndSettle();
      await openSheet(tester);

      await tester.enterText(find.byType(TextField), '   ');
      await tester.pump();
      expect(canSave(tester), isFalse);
    });

    testWidgets('typing narrows the menu, and a custom name leaves none', (
      tester,
    ) async {
      phone(tester);
      await tester.pumpWidget(app());
      await tester.pumpAndSettle();
      await openSheet(tester);

      await tester.tap(find.byType(TextField));
      await tester.pumpAndSettle();
      expect(find.text('Dinner'), findsWidgets);

      await tester.enterText(find.byType(TextField), 'chant');
      await tester.pumpAndSettle();
      expect(find.text('Morning chanting'), findsWidgets);
      expect(find.text('Evening chanting'), findsWidgets);
      expect(find.text('Dinner'), findsNothing);

      // Nothing laid over the form: the chips under it take the taps.
      await tester.enterText(find.byType(TextField), 'Call mother');
      await tester.pumpAndSettle();
      for (final name in ['Wake up', 'Lunch', 'Dinner', 'Sleep']) {
        expect(find.text(name), findsNothing, reason: name);
      }
      await tester.tap(find.widgetWithText(ChoiceChip, 'Errand'));
      await tester.pump();
      expect(
        tester
            .widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'Errand'))
            .selected,
        isTrue,
      );
      expect(find.widgetWithText(TextField, 'Call mother'), findsOneWidget);
    });

    testWidgets('"Done" on the keyboard keeps what was typed', (tester) async {
      phone(tester);
      await tester.pumpWidget(app());
      await tester.pumpAndSettle();
      await openSheet(tester);

      // "chant" is inside two routines; it must not become either of them.
      await tester.enterText(find.byType(TextField), 'Chant');
      await tester.pumpAndSettle();
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();

      expect(find.widgetWithText(TextField, 'Chant'), findsOneWidget);
      expect(find.text('Set a time range'), findsOneWidget);
    });

    testWidgets('the menu lists every routine when opened, even with a name in', (
      tester,
    ) async {
      phone(tester);
      await tester.pumpWidget(app());
      await tester.pumpAndSettle();
      await openSheet(tester);
      await pickPreset(tester, 'Breakfast');

      await tester.tap(find.byType(TextField));
      await tester.pumpAndSettle();
      for (final name in [
        'Wake up',
        'Morning chanting',
        'Exercise',
        'Breakfast',
        'Lunch',
        'Evening chanting',
        'Dinner',
        'Scripture reading',
        'Sleep',
      ]) {
        expect(find.text(name), findsWidgets, reason: name);
      }
    });

    testWidgets('a picked routine can still be renamed', (tester) async {
      phone(tester);
      await tester.pumpWidget(app());
      await tester.pumpAndSettle();
      await openSheet(tester);
      await pickPreset(tester, 'Lunch');

      await tester.enterText(find.byType(TextField), 'Lunch with the family');
      await tester.pump();
      await tester.tap(saveButton());
      await tester.pumpAndSettle();

      final saved = today(tester).single;
      expect(saved.title, 'Lunch with the family');
      // The time range stays: renaming it does not forget when it is for.
      expect(saved.window, RoutinePreset.lunch.window);
      await settleSaves(tester);
    });
  });

  group('the time range', () {
    testWidgets('starts with none, and a task can be saved without one', (
      tester,
    ) async {
      phone(tester);
      await tester.pumpWidget(app());
      await tester.pumpAndSettle();
      await openSheet(tester);

      expect(find.text('Set a time range'), findsOneWidget);
      expect(find.text('From'), findsNothing);
    });

    testWidgets('can be taken off a routine that came with one', (
      tester,
    ) async {
      phone(tester);
      await tester.pumpWidget(app());
      await tester.pumpAndSettle();
      await openSheet(tester);
      await pickPreset(tester, 'Dinner');
      expect(find.text('From'), findsOneWidget);

      await tester.tap(find.byTooltip('Remove time range'));
      await tester.pumpAndSettle();
      expect(find.text('From'), findsNothing);
      expect(find.text('Set a time range'), findsOneWidget);

      await tester.tap(saveButton());
      await tester.pumpAndSettle();
      expect(today(tester).single.window, isNull);
      await settleSaves(tester);
    });

    testWidgets('an end before the start is said so, and cannot be saved', (
      tester,
    ) async {
      phone(tester);
      await tester.pumpWidget(app());
      await tester.pumpAndSettle();
      await openSheet(tester);
      // Sleep is 9 PM to 11 PM.
      await pickPreset(tester, 'Sleep');
      expect(canSave(tester), isTrue);
      expect(find.text('The end must be after the start.'), findsNothing);

      await tester.tap(find.bySemanticsLabel(RegExp('^To ')));
      await tester.pumpAndSettle();
      await enterTime(tester, hour: 8, minute: 0);

      expect(find.text('The end must be after the start.'), findsOneWidget);
      expect(canSave(tester), isFalse);

      // Taking the range off makes the task valid again.
      await tester.tap(find.byTooltip('Remove time range'));
      await tester.pumpAndSettle();
      expect(canSave(tester), isTrue);
    });

    testWidgets('a start moved past the end carries the end along', (
      tester,
    ) async {
      phone(tester);
      await tester.pumpWidget(app());
      await tester.pumpAndSettle();
      await openSheet(tester);
      // Wake up is 4:30 AM to 6:00 AM; start it at 7:00 AM.
      await pickPreset(tester, 'Wake up');

      await tester.tap(find.bySemanticsLabel(RegExp('^From ')));
      await tester.pumpAndSettle();
      await enterTime(tester, hour: 7, minute: 0);

      expect(find.text('The end must be after the start.'), findsNothing);
      expect(canSave(tester), isTrue);
      await tester.tap(saveButton());
      await tester.pumpAndSettle();

      final window = today(tester).single.window!;
      expect(window.start, 7 * 60);
      expect(window.end, 8 * 60);
      await settleSaves(tester);
    });

    testWidgets('a new range opens at 6 AM for an hour', (tester) async {
      phone(tester);
      await tester.pumpWidget(app());
      await tester.pumpAndSettle();
      await openSheet(tester);
      await tester.enterText(find.byType(TextField), 'Study');
      await tester.pump();

      await tester.tap(find.text('Set a time range'));
      await tester.pumpAndSettle();
      await tester.tap(saveButton());
      await tester.pumpAndSettle();

      expect(today(tester).single.window, const RoutineWindow(start: 360, end: 420));
      await settleSaves(tester);
    });
  });

  group('the category chips', () {
    for (final brightness in Brightness.values) {
      testWidgets('draw their icon where it can be seen in ${brightness.name}', (
        tester,
      ) async {
        phone(tester);
        await tester.pumpWidget(app(brightness: brightness));
        await tester.pumpAndSettle();
        await openSheet(tester);

        final scheme = (brightness == Brightness.light
                ? AppTheme.light
                : AppTheme.dark)
            .colorScheme;
        Color? iconOf(String label) => tester
            .widget<Icon>(
              find.descendant(
                of: find.widgetWithText(ChoiceChip, label),
                matching: find.byType(Icon),
              ),
            )
            .color;

        // The selected one sits on the primary fill, which in dark mode is
        // white; the default ink would vanish there.
        expect(iconOf('Devotion'), scheme.onPrimary);
        expect(iconOf('Work'), scheme.onSurfaceVariant);

        await tester.tap(find.widgetWithText(ChoiceChip, 'Work'));
        await tester.pumpAndSettle();
        expect(iconOf('Work'), scheme.onPrimary);
        expect(iconOf('Devotion'), scheme.onSurfaceVariant);
      });
    }
  });
}
