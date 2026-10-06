import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../models/mantra.dart';
import '../../models/search_result.dart';
import '../../views/auth/sign_in_view.dart';
import '../../views/chant/chant_view.dart';
import '../../views/dashboard/dashboard_view.dart';
import '../../views/dashboard/home_tab.dart';
import '../../views/dashboard/library_tab.dart';
import '../../views/dashboard/routine_tab.dart';
import '../../views/dashboard/sadhana_tab.dart';
import '../../views/library/book_detail_view.dart';
import '../../views/library/chapter_list_view.dart';
import '../../views/library/chapter_read_view.dart';
import '../../views/mantra/mantra_detail_view.dart';
import '../../views/onboarding/language_view.dart';
import '../../views/reels/creator_view.dart';
import '../../views/reels/reel_detail_view.dart';
import '../../views/reels/reels_view.dart';
import '../../views/search/search_results_view.dart';
import '../../views/search/search_view.dart';
import '../../views/premium/plans_view.dart';
import '../../views/settings/settings_view.dart';
import '../../views/splash/splash_view.dart';
import '../constants/storage_keys.dart';
import '../session/app_session.dart';
import '../theme/app_spacing.dart';
import '../../services/local_store.dart';
import 'app_navigator.dart';
import 'app_routes.dart';

/// The router.
///
/// One redirect decides which of the three states the app is in — still
/// reading storage, signed out, signed in — and it runs again whenever the
/// session's status changes, which is how signing out anywhere in the app lands
/// everyone back on the sign-in screen without a single `Navigator` call.
///
/// It listens to the status and not to [AppSession] itself, which also notifies
/// when the profile is updated. A refresh re-applies the stack the router held
/// before it, so one fired by a language change in settings put the screen that
/// had just popped itself back on top.
GoRouter createRouter() {
  final session = AppSession.instance;
  final status = ValueNotifier<SessionStatus>(session.status);
  session.addListener(() => status.value = session.status);

  final router = GoRouter(
    navigatorKey: AppNavigator.instance.rootKey,
    initialLocation: AppRoutes.splash,
    refreshListenable: status,
    debugLogDiagnostics: false,
    redirect: (context, state) {
      final location = state.matchedLocation;

      switch (session.status) {
        case SessionStatus.unknown:
          return location == AppRoutes.splash ? null : AppRoutes.splash;

        case SessionStatus.signedOut:
          return location == AppRoutes.signIn ? null : AppRoutes.signIn;

        case SessionStatus.signedIn:
          // A new account has the default languages rather than chosen ones,
          // and is held at the picker until it does. The flag is written by
          // sign-in and cleared only when the API has accepted a choice, so a
          // failed save cannot let anyone through with nothing set.
          final chosenLanguages =
              LocalStore.instance.read<bool>(BoxKeys.onboardingSeen) ?? false;
          if (!chosenLanguages) {
            return location == AppRoutes.languageSetup
                ? null
                : AppRoutes.languageSetup;
          }

          // The language screen is deliberately not bounced once the choice is
          // made — settings pushes the same screen to change it later, and the
          // onboarding exit is an explicit navigation rather than a redirect.
          final atDoor =
              location == AppRoutes.splash || location == AppRoutes.signIn;
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
      GoRoute(
        path: AppRoutes.languageSetup,
        name: RouteNames.languageSetup,
        builder: (context, state) => const LanguageView(),
      ),
      GoRoute(
        path: AppRoutes.settings,
        name: RouteNames.settings,
        builder: (context, state) => const SettingsView(),
      ),
      GoRoute(
        path: AppRoutes.plans,
        name: RouteNames.plans,
        builder: (context, state) => const PlansView(),
      ),
      GoRoute(
        path: AppRoutes.search,
        name: RouteNames.search,
        builder: (context, state) => const SearchView(),
      ),
      GoRoute(
        path: AppRoutes.searchResultsPattern,
        name: RouteNames.searchResults,
        builder: (context, state) => SearchResultsView(
          scope: SearchScope.values.firstWhere(
            (scope) => scope.wire == state.pathParameters['scope'],
            orElse: () => SearchScope.verse,
          ),
          query: state.uri.queryParameters['q'] ?? '',
        ),
      ),
      GoRoute(
        path: AppRoutes.mantraPattern,
        name: RouteNames.mantraDetail,
        builder: (context, state) =>
            MantraDetailView(slug: state.pathParameters['slug']!),
      ),
      GoRoute(
        path: AppRoutes.bookPattern,
        name: RouteNames.bookDetail,
        builder: (context, state) => BookDetailView(slug: state.pathParameters['slug']!),
      ),
      GoRoute(
        path: AppRoutes.bookCantoPattern,
        name: RouteNames.bookCanto,
        builder: (context, state) => ChapterListView(
          slug: state.pathParameters['slug']!,
          canto: int.parse(state.pathParameters['canto']!),
        ),
      ),
      GoRoute(
        path: AppRoutes.chapterPattern,
        name: RouteNames.chapterRead,
        builder: (context, state) => ChapterReadView(
          slug: state.pathParameters['slug']!,
          number: int.parse(state.pathParameters['number']!),
          canto: int.tryParse(state.uri.queryParameters['canto'] ?? ''),
          targetVerseNumber: int.tryParse(state.uri.queryParameters['verse'] ?? ''),
        ),
      ),
      GoRoute(
        path: AppRoutes.chant,
        name: RouteNames.chant,
        builder: (context, state) => ChantView(mantra: state.extra as Mantra?),
      ),
      GoRoute(
        path: AppRoutes.reels,
        name: RouteNames.reels,
        builder: (context, state) => const ReelsView(),
      ),
      // Registered after the feed, so `/reels` still matches the feed rather
      // than being read as a reel whose id is empty.
      GoRoute(
        path: AppRoutes.reelPattern,
        name: RouteNames.reelDetail,
        builder: (context, state) => ReelDetailView(reelId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: AppRoutes.creatorPattern,
        name: RouteNames.creatorProfile,
        builder: (context, state) => CreatorView(creatorId: state.pathParameters['id']!),
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
                path: AppRoutes.routine,
                name: RouteNames.routine,
                builder: (context, state) => const RoutineTab(),
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
    final text = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(),
      body: Center(
        child: Padding(
          padding: AppSpacing.page,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                text.errorRouteNotFound,
                style: Theme.of(context).textTheme.titleMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.lg),
              TextButton(
                onPressed: () => AppNavigator.instance.go(AppRoutes.home),
                child: Text(text.actionGoHome),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
