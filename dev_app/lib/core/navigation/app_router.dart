import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../services/push_service.dart';
import '../../views/auth/sign_in_view.dart';
import '../../views/chats/chats_view.dart';
import '../../views/chats/new_chat_view.dart';
import '../../views/chats/thread_view.dart';
import '../../views/live/live_view.dart';
import '../../views/settings/settings_view.dart';
import '../../views/shell/shell_view.dart';
import '../../views/splash/splash_view.dart';
import '../../views/tickets/ticket_view.dart';
import '../../views/tickets/tickets_view.dart';
import '../session/app_session.dart';
import 'app_routes.dart';

final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');

/// The router, built once. It listens to the session: signed out → the sign-in screen, signed in → the app,
/// and nobody gets to either by typing a path.
GoRouter createRouter() {
  final session = AppSession.instance;

  final router = GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: AppRoutes.splash,
    refreshListenable: session,
    redirect: (context, state) {
      final location = state.matchedLocation;
      switch (session.status) {
        case SessionStatus.unknown:
          return location == AppRoutes.splash ? null : AppRoutes.splash;
        case SessionStatus.signedOut:
          return location == AppRoutes.signIn ? null : AppRoutes.signIn;
        case SessionStatus.signedIn:
          if (location == AppRoutes.splash || location == AppRoutes.signIn) {
            // A push that opened the app names where to go.
            return PushService.instance.takePendingRoute() ?? AppRoutes.live;
          }
          return null;
      }
    },
    routes: [
      GoRoute(path: AppRoutes.splash, builder: (context, state) => const SplashView()),
      GoRoute(path: AppRoutes.signIn, builder: (context, state) => const SignInView()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => ShellView(shell: shell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: AppRoutes.live, builder: (context, state) => const LiveView()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: AppRoutes.chats, builder: (context, state) => const ChatsView()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: AppRoutes.tickets, builder: (context, state) => const TicketsView()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: AppRoutes.settings, builder: (context, state) => const SettingsView()),
          ]),
        ],
      ),
      // Over the tab bar.
      GoRoute(
        path: AppRoutes.newChat,
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const NewChatView(),
      ),
      GoRoute(
        path: '${AppRoutes.chats}/:id',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => ThreadView(conversationId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '${AppRoutes.tickets}/:id',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => TicketView(ticketId: state.pathParameters['id']!),
      ),
    ],
  );

  // A tap on a push while the app is running.
  PushService.instance.onRoute = (route) {
    if (session.isSignedIn) router.go(route);
  };
  return router;
}
