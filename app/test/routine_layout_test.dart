// The routine list scrolls clear of the floating nav bar.
//
// The dashboard lays the bar over the tabs and hands each one the bar's height
// as its bottom padding. A tab that does not add that to its list's own padding
// leaves its last row under the bar, unreachable however far it is scrolled —
// which is how the last task on the Routine tab was found clipped.

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/constants/storage_keys.dart';
import 'package:hariharibol/core/theme/app_spacing.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/routine_task.dart';
import 'package:hariharibol/services/local_store.dart';
import 'package:hariharibol/views/dashboard/routine_tab.dart';
import 'package:hariharibol/widgets/routine/routine_task_tile.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory dir;

  setUpAll(() async {
    dir = await Directory.systemTemp.createTemp('hariharibol_routine_layout');
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

  /// What the dashboard hands a tab: the nav bar's height as bottom padding.
  const barHeight = 120.0;
  const screenHeight = 800.0;

  Widget app() => ProviderScope(
    child: MaterialApp(
      theme: AppTheme.light,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Builder(
        builder: (context) {
          final media = MediaQuery.of(context);
          return MediaQuery(
            data: media.copyWith(
              padding: media.padding.copyWith(bottom: barHeight),
            ),
            child: const RoutineTab(),
          );
        },
      ),
    ),
  );

  void phone(WidgetTester tester) {
    tester.view.physicalSize = const Size(1080, screenHeight * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
  }

  Future<void> seed(WidgetTester tester, int count) => tester.runAsync(
    () => LocalStore.instance.write(BoxKeys.routineTasks, [
      for (var index = 0; index < count; index++)
        {
          'id': 'task$index',
          'title': 'Task number $index',
          'category': 'devotion',
          'slot': 'anytime',
          'isDone': false,
          'day': routineDayKey(DateTime.now()),
        },
    ]),
  );

  testWidgets('the last row can be scrolled clear of the nav bar', (tester) async {
    phone(tester);
    await seed(tester, 14);
    await tester.pumpWidget(app());
    await tester.pump();

    await tester.drag(find.byType(ListView).last, const Offset(0, -4000));
    await tester.pumpAndSettle();

    final last = find.byType(RoutineTaskTile).last;
    expect(find.text('Task number 13'), findsOneWidget);
    expect(
      tester.getBottomLeft(last).dy,
      lessThanOrEqualTo(screenHeight - barHeight),
      reason: 'the last row ends above the nav bar',
    );
  });

  testWidgets('and leaves room beneath it, not only its bare height', (tester) async {
    phone(tester);
    await seed(tester, 14);
    await tester.pumpWidget(app());
    await tester.pump();

    await tester.drag(find.byType(ListView).last, const Offset(0, -4000));
    await tester.pumpAndSettle();

    // The section's own gap sits under the row as well; the padding is on top.
    final room = screenHeight - barHeight - tester.getBottomLeft(find.byType(RoutineTaskTile).last).dy;
    expect(room, greaterThanOrEqualTo(AppSpacing.xxl));
  });

  testWidgets('an empty day keeps its actions above the nav bar', (tester) async {
    phone(tester);
    await tester.pumpWidget(app());
    await tester.pump();

    final text = AppLocalizations.of(tester.element(find.byType(RoutineTab)));
    // The header's icon button only has a tooltip, so this text is the button
    // under the empty-state message.
    final button = find.text(text.routineManageDaily);
    expect(button, findsOneWidget);
    expect(
      tester.getBottomLeft(button).dy,
      lessThanOrEqualTo(screenHeight - barHeight),
    );
  });
}
