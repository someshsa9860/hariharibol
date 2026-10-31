// The three states the app can boot into, and the screen each one lands on.
//
// This is the guarantee the whole session design exists to provide: a person
// who signed in once opens the app and sees the dashboard, with no sign-in
// screen flashing past and no network call in the way. It is asserted here
// rather than checked by hand because it is the thing most easily broken by an
// unrelated change to the router or the session.

import 'dart:io';

import 'package:flutter/material.dart' show FilledButton, TextButton;
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_ce_flutter/hive_flutter.dart';

import 'package:hariharibol/app.dart';
import 'package:hariharibol/core/navigation/app_navigator.dart';
import 'package:hariharibol/core/constants/splash_config.dart';
import 'package:hariharibol/core/navigation/app_routes.dart';
import 'package:hariharibol/core/navigation/splash_gate.dart';
import 'package:hariharibol/core/session/app_session.dart';
import 'package:hariharibol/models/auth_session.dart';
import 'package:hariharibol/core/constants/storage_keys.dart';
import 'package:hariharibol/services/local_store.dart';
import 'package:hariharibol/views/auth/sign_in_view.dart';
import 'package:hariharibol/views/dashboard/dashboard_view.dart';
import 'package:hariharibol/views/dashboard/routine_tab.dart';
import 'package:hariharibol/core/constants/intro_config.dart';
import 'package:hariharibol/widgets/common/glass_nav_bar.dart';
import 'package:hariharibol/widgets/common/side_nav.dart';
import 'package:hariharibol/views/onboarding/intro_view.dart';
import 'package:hariharibol/views/onboarding/setup_view.dart';
import 'package:hariharibol/views/splash/splash_view.dart';

/// What the API actually returns from `/auth/social` and `/auth/refresh` —
/// copied from the shape `sessionPayload()` builds in the backend controller.
Map<String, dynamic> sessionPayload({DateTime? refreshExpiresAt}) => {
      'user': {
        'id': 'usr_1',
        'email': 'user@smoke.test',
        'name': 'Test Devotee',
        'authProvider': 'GOOGLE',
        'appLanguage': 'en',
        'mantraLanguage': 'sa',
        'readingLanguage': 'en',
        'timezone': 'Asia/Kolkata',
        'isPremium': false,
        'role': 'user',
      },
      'tokens': {
        'accessToken': 'a' * 64,
        'refreshToken': 'r' * 64,
        'refreshExpiresAt':
            (refreshExpiresAt ?? DateTime.now().add(const Duration(days: 365)))
                .toUtc()
                .toIso8601String(),
      },
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory hiveDir;

  setUpAll(() async {
    // Hive reaches for the documents directory through path_provider, which has
    // no implementation in a test. A temp directory stands in for it.
    hiveDir = await Directory.systemTemp.createTemp('hariharibol_test');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/path_provider'),
      (call) async => hiveDir.path,
    );
    // Someone signed in starts the routine's sync, which listens for the
    // connection coming back. No plugin answers in a test; this one does, with
    // nothing to say.
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('dev.fluttercommunity.plus/connectivity_status'),
      (call) async => null,
    );
    await LocalStore.instance.init();
  });

  tearDownAll(() async {
    await Hive.close();
    if (hiveDir.existsSync()) hiveDir.deleteSync(recursive: true);
  });

  setUp(() async {
    FlutterSecureStorage.setMockInitialValues({});
    await LocalStore.instance.clear();

    // The launch animation holds the router on the splash for a couple of
    // seconds. Everything outside the "launch animation" group is about where
    // the app lands, not how it gets there, so the hold starts open.
    SplashGate.instance.open();
  });

  group('AppSession.restore', () {
    test('with nothing stored, the app is signed out', () async {
      await AppSession.instance.restore();

      expect(AppSession.instance.status, SessionStatus.signedOut);
      expect(AppSession.instance.isSignedIn, isFalse);
      expect(AppSession.instance.accessToken, isNull);
    });

    test('with a stored pair, the app is signed in without a network call', () async {
      await AppSession.instance.start(AuthSession.fromJson(sessionPayload()));
      await AppSession.instance.restore();

      expect(AppSession.instance.status, SessionStatus.signedIn);
      expect(AppSession.instance.accessToken, 'a' * 64);
      expect(AppSession.instance.user?.email, 'user@smoke.test');
    });

    test('a phone clock past the refresh token\'s year does not sign anyone out', () async {
      // Only the server decides whether a session is over (a 403 on the
      // refresh). A clock that is wrong, or a date in the future, must not log
      // someone out of a session the server would still honour.
      await AppSession.instance.start(
        AuthSession.fromJson(
          sessionPayload(refreshExpiresAt: DateTime.now().subtract(const Duration(days: 1))),
        ),
      );
      await AppSession.instance.restore();

      expect(AppSession.instance.status, SessionStatus.signedIn);
      expect(AppSession.instance.refreshToken, 'r' * 64);
    });

    test('a stored pair with an empty token is not a session', () async {
      FlutterSecureStorage.setMockInitialValues({});
      await AppSession.instance.start(AuthSession.fromJson(sessionPayload()));
      await AppSession.instance.updateTokens(
        const AuthTokens(accessToken: '', refreshToken: '', refreshExpiresAt: null),
      );
      await AppSession.instance.restore();

      expect(AppSession.instance.status, SessionStatus.signedOut);
    });

    test('a silent rotation swaps the tokens and leaves the user alone', () async {
      await AppSession.instance.start(AuthSession.fromJson(sessionPayload()));

      await AppSession.instance.updateTokens(
        AuthTokens(
          accessToken: 'b' * 64,
          refreshToken: 'z' * 64,
          refreshExpiresAt: DateTime.now().add(const Duration(days: 365)),
        ),
      );

      expect(AppSession.instance.accessToken, 'b' * 64);
      expect(AppSession.instance.user?.email, 'user@smoke.test');

      // And it survives a restart — the rotation was written, not just held.
      await AppSession.instance.restore();
      expect(AppSession.instance.accessToken, 'b' * 64);
    });

    test('signing out leaves nothing behind', () async {
      await AppSession.instance.start(AuthSession.fromJson(sessionPayload()));
      await AppSession.instance.clear();

      expect(AppSession.instance.status, SessionStatus.signedOut);
      expect(AppSession.instance.accessToken, isNull);
      expect(AppSession.instance.user, isNull);

      await AppSession.instance.restore();
      expect(AppSession.instance.status, SessionStatus.signedOut);
    });

    test('a phone with nobody on it has not seen the welcome pages', () async {
      await AppSession.instance.restore();

      expect(LocalStore.instance.read<bool>(BoxKeys.introSeen), isNull);
    });

    test('someone who signs in has seen what is in the app', () async {
      await AppSession.instance.start(AuthSession.fromJson(sessionPayload()));

      expect(LocalStore.instance.read<bool>(BoxKeys.introSeen), isTrue);
    });

    test('an account from before the welcome pages existed has seen them too', () async {
      // Its session is stored; the flag never was. Without this it would meet
      // the pages the first time it signed out.
      await AppSession.instance.start(AuthSession.fromJson(sessionPayload()));
      await LocalStore.instance.write(BoxKeys.introSeen, null);

      await AppSession.instance.restore();

      expect(AppSession.instance.status, SessionStatus.signedIn);
      expect(LocalStore.instance.read<bool>(BoxKeys.introSeen), isTrue);
    });

    test('signing out does not bring the welcome pages back', () async {
      await AppSession.instance.start(AuthSession.fromJson(sessionPayload()));
      await AppSession.instance.clear();

      expect(LocalStore.instance.read<bool>(BoxKeys.introSeen), isTrue);
    });
  });

  group('where the app lands', () {
    // Storage has to run outside the fake clock. `testWidgets` drives time
    // itself, so a Hive write — which is real disk I/O — would be issued and
    // then never observed to finish, and the test would sit there forever.
    // `chosenLanguages: false` is what a brand-new account looks like — the
    // router holds it at the language picker until the API has accepted a
    // choice. Everything below is a returning account unless it says otherwise.
    Future<void> signIn(WidgetTester tester, {bool chosenLanguages = true}) =>
        tester.runAsync(() async {
          await AppSession.instance.start(AuthSession.fromJson(sessionPayload()));
          await LocalStore.instance.write(BoxKeys.onboardingSeen, chosenLanguages);
          await AppSession.instance.restore();
        });

    // `seenIntro: false` is a phone that has never shown the welcome pages;
    // every other signed-out test is about a phone that has.
    Future<void> signOut(WidgetTester tester, {bool seenIntro = true}) =>
        tester.runAsync(() async {
          await AppSession.instance.clear();
          await LocalStore.instance.write(BoxKeys.onboardingSeen, null);
          await LocalStore.instance.write(BoxKeys.introSeen, seenIntro ? true : null);
          await AppSession.instance.restore();
        });

    // The welcome pages' last button, and Skip, write the flag before they move
    // on, and a write to the store is disk I/O that a test's fake clock never
    // sees finish. The tap and a moment of real time go together.
    Future<void> tapAndSave(WidgetTester tester, Finder finder) =>
        tester.runAsync(() async {
          await tester.tap(finder);
          await Future<void>.delayed(const Duration(milliseconds: 100));
        });

    Future<void> openWelcomePages(WidgetTester tester) async {
      await signOut(tester, seenIntro: false);

      await tester.pumpWidget(const ProviderScope(child: HariHariBolApp()));
      await tester.pump();
      // Long enough for the last button's staggered entrance to have started,
      // so no timer is left pending when the test ends.
      await tester.pump(const Duration(seconds: 1));
    }

    // The test window is 800 wide, which the app treats as a small tablet; the bar is a phone's.
    void phone(WidgetTester tester) {
      tester.view.physicalSize = const Size(400, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
    }

    testWidgets('a signed-in person goes straight to the dashboard', (tester) async {
      phone(tester);
      await signIn(tester);

      await tester.pumpWidget(const ProviderScope(child: HariHariBolApp()));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byType(DashboardView), findsOneWidget);
      expect(find.byType(GlassNavBar), findsOneWidget);
      expect(find.byType(SignInView), findsNothing);
      expect(find.byType(SplashView), findsNothing);
    });

    testWidgets('on a wide window the destinations are a column, not a bar', (tester) async {
      tester.view.physicalSize = const Size(1280, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await signIn(tester);

      await tester.pumpWidget(const ProviderScope(child: HariHariBolApp()));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byType(DashboardView), findsOneWidget);
      expect(find.byType(SideNav), findsOneWidget);
      expect(find.byType(GlassNavBar), findsNothing);
    });

    testWidgets('all four tabs are reachable from the bar', (tester) async {
      phone(tester);
      await signIn(tester);

      await tester.pumpWidget(const ProviderScope(child: HariHariBolApp()));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      final bar = tester.widget<GlassNavBar>(find.byType(GlassNavBar));
      expect(bar.items.map((item) => item.label), ['Home', 'Jap', 'Read', 'Reels']);
      expect(bar.selectedIndex, 0);
      // Sakha is raised in the middle of them, and is not one of the four.
      expect(bar.hero, isNotNull);
      expect(bar.hero!.semanticLabel, 'Ask Sakha');
      expect(bar.onMedia, isFalse);
    });

    testWidgets('the routine is a screen of its own, opened from Home', (tester) async {
      await signIn(tester);

      await tester.pumpWidget(const ProviderScope(child: HariHariBolApp()));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      AppNavigator.instance.push(AppRoutes.routine);
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(find.byType(RoutineTab), findsOneWidget);
      expect(find.byTooltip('Back'), findsOneWidget);

      await tester.tap(find.byTooltip('Back'));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(RoutineTab), findsNothing);
      expect(find.byType(DashboardView), findsOneWidget);
    });

    testWidgets('a new account is held at the setup', (tester) async {
      await signIn(tester, chosenLanguages: false);

      await tester.pumpWidget(const ProviderScope(child: HariHariBolApp()));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byType(SetupView), findsOneWidget);
      expect(find.byType(DashboardView), findsNothing);
    });

    testWidgets('a signed-out person gets the sign-in screen', (tester) async {
      await signOut(tester);

      await tester.pumpWidget(const ProviderScope(child: HariHariBolApp()));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byType(SignInView), findsOneWidget);
      expect(find.byType(DashboardView), findsNothing);
      expect(find.byType(IntroView), findsNothing);
    });

    testWidgets('a phone that has never shown the welcome pages shows them first', (tester) async {
      await openWelcomePages(tester);

      expect(find.byType(IntroView), findsOneWidget);
      expect(find.byType(SignInView), findsNothing);
      expect(find.byType(SplashView), findsNothing);
    });

    testWidgets('the last button leads to sign-in and the pages stay seen', (tester) async {
      await openWelcomePages(tester);

      for (var page = 1; page < IntroConfig.pageCount; page++) {
        await tester.tap(find.byType(FilledButton));
        await tester.pump();
        await tester.pump(IntroConfig.pageTurn);
        await tester.pump(const Duration(milliseconds: 300));
      }
      expect(find.text('Get started'), findsOneWidget);
      expect(LocalStore.instance.read<bool>(BoxKeys.introSeen), isNull);

      await tapAndSave(tester, find.byType(FilledButton));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(find.byType(SignInView), findsOneWidget);
      expect(find.byType(IntroView), findsNothing);
      expect(LocalStore.instance.read<bool>(BoxKeys.introSeen), isTrue);
    });

    testWidgets('Skip does the same from the first page', (tester) async {
      await openWelcomePages(tester);

      await tapAndSave(tester, find.widgetWithText(TextButton, 'Skip'));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(find.byType(SignInView), findsOneWidget);
      expect(find.byType(IntroView), findsNothing);
      expect(LocalStore.instance.read<bool>(BoxKeys.introSeen), isTrue);
    });

    testWidgets('the welcome pages, opened over the app, close back to it', (tester) async {
      await signIn(tester);

      await tester.pumpWidget(const ProviderScope(child: HariHariBolApp()));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      AppNavigator.instance.push(AppRoutes.intro);
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(IntroView), findsOneWidget);

      await tapAndSave(tester, find.widgetWithText(TextButton, 'Skip'));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(find.byType(IntroView), findsNothing);
      expect(find.byType(DashboardView), findsOneWidget);
      expect(find.byType(SignInView), findsNothing);
    });

    testWidgets('signing out from the dashboard returns to the sign-in screen', (tester) async {
      await signIn(tester);

      await tester.pumpWidget(const ProviderScope(child: HariHariBolApp()));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.byType(DashboardView), findsOneWidget);

      // No navigation call anywhere — the session notifies and the router acts,
      // which is the same path a dead refresh token takes.
      await tester.runAsync(() => AppSession.instance.clear());
      await tester.pump();
      // Long enough for the route transition to finish; until it does both
      // screens are legitimately in the tree at once.
      await tester.pump(const Duration(seconds: 1));

      expect(find.byType(SignInView), findsOneWidget);
      expect(find.byType(DashboardView), findsNothing);
    });

    testWidgets('a profile update does not bring back a screen that just closed', (tester) async {
      await signIn(tester);

      await tester.pumpWidget(const ProviderScope(child: HariHariBolApp()));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      AppNavigator.instance.push(AppRoutes.setup);
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(SetupView), findsOneWidget);

      // What saving a language in settings does: the session takes the new
      // user, then the screen pops itself. The session notifies on the update,
      // and a router that refreshed on that put the picker straight back.
      final user = AppSession.instance.user!;
      await tester.runAsync(
        () => AppSession.instance.updateUser(user.copyWith(appLanguage: 'hi')),
      );
      AppNavigator.instance.pop();
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(find.byType(SetupView), findsNothing);
      expect(find.byType(DashboardView), findsOneWidget);
    });

    group('the launch animation', () {
      // The session is known before the first frame, so a signed-in person
      // would see the splash for a single frame. The gate is what stops that —
      // and it must never strand anyone on the splash.
      setUp(() => SplashGate.instance.close());

      // Three steps, because there are three things to wait for: the clock
      // running out (the gate opens on the tick after it does), the router
      // acting on the open gate, and the route transition finishing — until it
      // does the splash is legitimately still in the tree.
      Future<void> playOut(WidgetTester tester, Duration length) async {
        await tester.pump(length);
        await tester.pump(const Duration(seconds: 1));
        await tester.pump(const Duration(seconds: 1));
      }

      testWidgets('holds the splash while it plays, then lands where the session says',
          (tester) async {
        await signIn(tester);

        await tester.pumpWidget(const ProviderScope(child: HariHariBolApp()));
        await tester.pump();
        await tester.pump(SplashConfig.total ~/ 2);

        expect(find.byType(SplashView), findsOneWidget);
        expect(find.byType(DashboardView), findsNothing);

        await playOut(tester, SplashConfig.total);

        expect(find.byType(DashboardView), findsOneWidget);
        expect(find.byType(SplashView), findsNothing);
      });

      testWidgets('a signed-out person is sent to sign-in when it ends', (tester) async {
        await signOut(tester);

        await tester.pumpWidget(const ProviderScope(child: HariHariBolApp()));
        await tester.pump();
        expect(find.byType(SplashView), findsOneWidget);

        await playOut(tester, SplashConfig.total);

        expect(find.byType(SignInView), findsOneWidget);
        expect(find.byType(SplashView), findsNothing);
      });

      testWidgets('a phone that has never shown the welcome pages is sent to them',
          (tester) async {
        await signOut(tester, seenIntro: false);

        await tester.pumpWidget(const ProviderScope(child: HariHariBolApp()));
        await tester.pump();
        expect(find.byType(SplashView), findsOneWidget);

        await playOut(tester, SplashConfig.total);

        expect(find.byType(IntroView), findsOneWidget);
        expect(find.byType(SignInView), findsNothing);
        expect(find.byType(SplashView), findsNothing);
      });

      testWidgets('a tap skips it', (tester) async {
        await signIn(tester);

        await tester.pumpWidget(const ProviderScope(child: HariHariBolApp()));
        await tester.pump();
        expect(find.byType(SplashView), findsOneWidget);

        await tester.tap(find.byType(SplashView));
        await tester.pump();
        await tester.pump(const Duration(seconds: 1));

        expect(find.byType(DashboardView), findsOneWidget);
      });

      testWidgets('with reduce-motion on it is a short still, not an animation',
          (tester) async {
        tester.platformDispatcher.accessibilityFeaturesTestValue =
            const FakeAccessibilityFeatures(disableAnimations: true);
        addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
        await signIn(tester);

        await tester.pumpWidget(const ProviderScope(child: HariHariBolApp()));
        await tester.pump();
        expect(find.byType(SplashView), findsOneWidget);

        // Gone well before the full timeline would have finished.
        await playOut(tester, SplashConfig.reducedMotionHold);

        expect(SplashConfig.reducedMotionHold < SplashConfig.total, isTrue);
        expect(find.byType(DashboardView), findsOneWidget);
      });
    });
  });
}
