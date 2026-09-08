import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../views/auth/sign_in_view.dart';
import '../../views/dashboard/dashboard_view.dart';
import '../../views/dashboard/home_tab.dart';
import '../../views/dashboard/library_tab.dart';
import '../../views/dashboard/profile_tab.dart';
import '../../views/dashboard/sadhana_tab.dart';
import '../../views/splash/splash_view.dart';
import '../session/app_session.dart';
import 'app_navigator.dart';
import 'app_routes.dart';

/// The router.
///
/// One redirect decides which of the three states the app is in — still
/// reading storage, signed out, signed in — and it runs again whenever
/// [AppSession] notifies, which is how signing out anywhere in the app lands
/// everyone back on the sign-in screen without a single `Navigator` call.
GoRouter createRouter() {
  final session = AppSession.instance;

  final router = GoRouter(
    navigatorKey: AppNavigator.instance.rootKey,
    initialLocation: AppRoutes.splash,
    refreshListenable: session,
    debugLogDiagnostics: false,
    redirect: (context, state) {
      final location = state.matchedLocation;

      switch (session.status) {
        case SessionStatus.unknown:
          return location == AppRoutes.splash ? null : AppRoutes.splash;

        case SessionStatus.signedOut:
          return location == AppRoutes.signIn ? null : AppRoutes.signIn;

        case SessionStatus.signedIn:
          final atDoor = location == AppRoutes.splash || location == AppRoutes.signIn;
          return atDoor ? AppRoutes.home : null;
      }
    },
    routes: [
      GoRoute(
        path: AppRoutes.splash,
        name: RouteNames.splash,
        builder: (context, state) => const SplashView(),
      ),
      GoRoute(
        path: AppRoutes.signIn,
        name: RouteNames.signIn,
        builder: (context, state) => const SignInView(),
      ),

      // The tabs. An indexed stack keeps each tab's scroll position and state
      // alive while the others are off screen — switching tabs should not throw
      // away a half-read chapter.
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => DashboardView(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.home,
                name: RouteNames.home,
                builder: (context, state) => const HomeTab(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.sadhana,
                name: RouteNames.sadhana,
                builder: (context, state) => const SadhanaTab(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.library,
                name: RouteNames.library,
                builder: (context, state) => const LibraryTab(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.profile,
                name: RouteNames.profile,
                builder: (context, state) => const ProfileTab(),
              ),
            ],
          ),
        ],
      ),
    ],
    errorBuilder: (context, state) => const _RouteNotFound(),
  );

  AppNavigator.instance.attach(router);
  return router;
}

class _RouteNotFound extends StatelessWidget {
  const _RouteNotFound();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: Center(
        child: TextButton(
          onPressed: () => AppNavigator.instance.go(AppRoutes.home),
          child: const Text('Go home'),
        ),
      ),
    );
  }
}
