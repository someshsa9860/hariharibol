// The three states the app can boot into, and the screen each one lands on.
//
// This is the guarantee the whole session design exists to provide: a person
// who signed in once opens the app and sees the dashboard, with no sign-in
// screen flashing past and no network call in the way. It is asserted here
// rather than checked by hand because it is the thing most easily broken by an
// unrelated change to the router or the session.

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_ce_flutter/hive_flutter.dart';

import 'package:hariharibol/app.dart';
import 'package:hariharibol/core/session/app_session.dart';
import 'package:hariharibol/models/auth_session.dart';
import 'package:hariharibol/services/local_store.dart';
import 'package:hariharibol/views/auth/sign_in_view.dart';
import 'package:hariharibol/views/dashboard/dashboard_view.dart';
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
    await LocalStore.instance.init();
  });

  tearDownAll(() async {
    await Hive.close();
    if (hiveDir.existsSync()) hiveDir.deleteSync(recursive: true);
  });

  setUp(() async {
    FlutterSecureStorage.setMockInitialValues({});
    await LocalStore.instance.clear();
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

    test('a refresh token past its year is not trusted', () async {
      await AppSession.instance.start(
        AuthSession.fromJson(
          sessionPayload(refreshExpiresAt: DateTime.now().subtract(const Duration(days: 1))),
        ),
      );
      await AppSession.instance.restore();

      expect(AppSession.instance.status, SessionStatus.signedOut);
      expect(AppSession.instance.refreshToken, isNull);
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
  });

  group('where the app lands', () {
    // Storage has to run outside the fake clock. `testWidgets` drives time
    // itself, so a Hive write — which is real disk I/O — would be issued and
    // then never observed to finish, and the test would sit there forever.
    Future<void> signIn(WidgetTester tester) => tester.runAsync(() async {
          await AppSession.instance.start(AuthSession.fromJson(sessionPayload()));
          await AppSession.instance.restore();
        });

    Future<void> signOut(WidgetTester tester) => tester.runAsync(() async {
          await AppSession.instance.clear();
          await AppSession.instance.restore();
        });

    testWidgets('a signed-in person goes straight to the dashboard', (tester) async {
      await signIn(tester);

      await tester.pumpWidget(const ProviderScope(child: HariHariBolApp()));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byType(DashboardView), findsOneWidget);
      expect(find.byType(NavigationBar), findsOneWidget);
      expect(find.byType(SignInView), findsNothing);
      expect(find.byType(SplashView), findsNothing);
    });

    testWidgets('all four tabs are reachable from the bar', (tester) async {
      await signIn(tester);

      await tester.pumpWidget(const ProviderScope(child: HariHariBolApp()));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      final bar = tester.widget<NavigationBar>(find.byType(NavigationBar));
      expect(bar.destinations, hasLength(4));
      expect(bar.selectedIndex, 0);
    });

    testWidgets('a signed-out person gets the sign-in screen', (tester) async {
      await signOut(tester);

      await tester.pumpWidget(const ProviderScope(child: HariHariBolApp()));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byType(SignInView), findsOneWidget);
      expect(find.byType(DashboardView), findsNothing);
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
  });
}
