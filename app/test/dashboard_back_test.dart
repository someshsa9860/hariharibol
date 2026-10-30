// Back on the dashboard. Pressed on a tab it goes to Home; pressed on Home it
// asks before the app closes, and closes only on a yes.
//
// The dashboard is mounted in a router built the way the app's is: one shell,
// one branch per tab, on the app's root navigator key. So the real
// DashboardView and go_router handle the press. The whole app is not pumped
// here, which keeps this test to the dashboard alone.
//
// The press is sent the way the engine sends it (a `popRoute` message on the
// navigation channel). The close is the platform's `SystemNavigator.pop`, counted.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:hariharibol/core/navigation/app_navigator.dart';
import 'package:hariharibol/core/navigation/app_routes.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/views/dashboard/dashboard_view.dart';
import 'package:hariharibol/widgets/common/glass_nav_bar.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  var closeRequests = 0;

  setUp(() {
    closeRequests = 0;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async {
        if (call.method == 'SystemNavigator.pop') closeRequests++;
        return null;
      },
    );
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      null,
    );
  });

  /// The dashboard as the app mounts it: one shell, a branch per tab, all on
  /// the app's root navigator.
  GoRouter dashboardRouter() => GoRouter(
        navigatorKey: AppNavigator.instance.rootKey,
        initialLocation: AppRoutes.home,
        routes: [
          StatefulShellRoute.indexedStack(
            builder: (context, state, shell) => DashboardView(shell: shell),
            branches: [
              for (final path in AppRoutes.tabs)
                StatefulShellBranch(
                  routes: [
                    GoRoute(path: path, builder: (context, state) => const SizedBox.shrink()),
                  ],
                ),
            ],
          ),
        ],
      );

  /// A phone-sized window, with the dashboard on screen on Home.
  Future<void> openDashboard(WidgetTester tester) async {
    tester.view.physicalSize = const Size(400, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp.router(
        routerConfig: dashboardRouter(),
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
  }

  int selectedTab(WidgetTester tester) =>
      tester.widget<GlassNavBar>(find.byType(GlassNavBar)).selectedIndex;

  Future<void> tapTab(WidgetTester tester, String label) async {
    await tester.tap(find.descendant(of: find.byType(GlassNavBar), matching: find.text(label)));
    await tester.pump(const Duration(milliseconds: 300));
  }

  /// The phone's back button, as the engine delivers it.
  Future<void> pressBack(WidgetTester tester) async {
    await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.handlePlatformMessage(
      SystemChannels.navigation.name,
      SystemChannels.navigation.codec.encodeMethodCall(const MethodCall('popRoute')),
      (_) {},
    );
    await tester.pump(const Duration(milliseconds: 300));
  }

  Finder inDialog(String label) =>
      find.descendant(of: find.byType(AlertDialog), matching: find.text(label));

  testWidgets('back on a tab goes to Home first, and the app stays open', (tester) async {
    await openDashboard(tester);
    await tapTab(tester, 'Read');
    expect(selectedTab(tester), 2);

    await pressBack(tester);

    expect(selectedTab(tester), 0);
    expect(closeRequests, 0);
    expect(find.byType(AlertDialog), findsNothing);
  });

  testWidgets('back on Home asks before the app closes', (tester) async {
    await openDashboard(tester);

    await pressBack(tester);

    expect(find.text('Close the app?'), findsOneWidget);
    expect(closeRequests, 0);
  });

  testWidgets('Cancel on that question keeps the app open on Home', (tester) async {
    await openDashboard(tester);
    await pressBack(tester);

    await tester.tap(inDialog('Cancel'));
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.byType(AlertDialog), findsNothing);
    expect(closeRequests, 0);
    expect(selectedTab(tester), 0);
  });

  testWidgets('Close on that question closes the app', (tester) async {
    await openDashboard(tester);
    await pressBack(tester);

    await tester.tap(inDialog('Close'));
    await tester.pump(const Duration(milliseconds: 300));

    expect(closeRequests, 1);
  });

  testWidgets('a back from a tab takes Home first, and the next back asks', (tester) async {
    await openDashboard(tester);
    await tapTab(tester, 'Read');

    await pressBack(tester);
    expect(find.text('Close the app?'), findsNothing);

    await pressBack(tester);
    expect(find.text('Close the app?'), findsOneWidget);
    expect(closeRequests, 0);
  });
}
