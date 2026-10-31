import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../models/mantra.dart';
import '../../views/auth/sign_in_view.dart';
import '../../views/calendar/calendar_view.dart';
import '../../views/etiquette/etiquette_item_view.dart';
import '../../views/etiquette/etiquette_view.dart';
import '../../views/prayers/prayer_view.dart';
import '../../views/prayers/prayers_view.dart';
import '../../views/support/support_ticket_view.dart';
import '../../views/support/developer_chat_view.dart';
import '../../views/support/support_view.dart';
import '../../views/chant/chant_analytics_view.dart';
import '../../views/chat/chat_view.dart';
import '../../views/chant/chant_session_view.dart';
import '../../views/chant/chant_view.dart';
import '../../views/dashboard/dashboard_view.dart';
import '../../views/dashboard/home_tab.dart';
import '../../views/dashboard/library_tab.dart';
import '../../views/dashboard/routine_tab.dart';
import '../../views/dashboard/sadhana_tab.dart';
import '../../views/library/book_detail_view.dart';
import '../../views/library/chapter_list_view.dart';
import '../../views/library/chapter_read_view.dart';
import '../../views/mantra/add_mantra_view.dart';
import '../../views/mantra/mantra_detail_view.dart';
import '../../views/onboarding/intro_view.dart';
import '../../views/onboarding/setup_view.dart';
import '../../views/reels/creator_view.dart';
import '../../views/reels/reel_detail_view.dart';
import '../../views/reels/book_reels_view.dart';
import '../../views/reels/similar_reels_view.dart';
import '../../views/reels/reels_view.dart';
import '../../views/search/search_view.dart';
import '../../views/premium/plans_view.dart';
import '../../views/premium/refer_view.dart';
import '../share_links.dart';
import '../../views/settings/sources_view.dart';
import '../../views/settings/voices_view.dart';
import '../../views/settings/settings_view.dart';
import '../../views/splash/splash_view.dart';
import '../constants/storage_keys.dart';
import '../layout/adaptive.dart';
import '../session/app_session.dart';
import '../theme/app_spacing.dart';
import '../../services/deep_link_service.dart';
import '../../services/local_store.dart';
import 'app_navigator.dart';
import 'app_routes.dart';
import 'splash_gate.dart';

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
///
/// The splash is the one place the redirect does not run: the session is known
/// before the first frame, so without a hold the launch animation would last a
/// single frame. [SplashGate] opens when the animation ends, which re-runs the
/// redirect and sends the person on as usual.
GoRouter createRouter() {
  final session = AppSession.instance;
  final gate = SplashGate.instance;
  final status = ValueNotifier<SessionStatus>(session.status);
  session.addListener(() => status.value = session.status);

  final router = GoRouter(
    navigatorKey: AppNavigator.instance.rootKey,
    initialLocation: AppRoutes.splash,
    refreshListenable: Listenable.merge([status, gate]),
    debugLogDiagnostics: false,
    redirect: (context, state) {
      // A shared link that reached the router as a path is not a screen. DeepLinkService opens
      // what it points at (once, however many times the system announces it); the router goes on
      // to wherever the session says.
      if (ShareLinks.claims(state.uri)) {
        unawaited(DeepLinkService.instance.handle(state.uri));
        return AppRoutes.splash;
      }

      // The website's "Get the app" page. Android and iOS hand it to the installed app (it is in the
      // app links), and the app has nothing to show for it: it goes on to wherever the session says.
      if (state.uri.path == '/get-app') return AppRoutes.splash;

      final location = state.matchedLocation;

      if (location == AppRoutes.splash && !gate.isOpen) return null;

      switch (session.status) {
        case SessionStatus.unknown:
          return location == AppRoutes.splash ? null : AppRoutes.splash;

        case SessionStatus.signedOut:
          // A phone that has never shown the welcome pages shows them before
          // anything else. The flag is the device's, so signing out later goes
          // straight to sign-in.
          final seenIntro =
              LocalStore.instance.read<bool>(BoxKeys.introSeen) ?? false;
          if (!seenIntro) {
            return location == AppRoutes.intro ? null : AppRoutes.intro;
          }
          return location == AppRoutes.signIn ? null : AppRoutes.signIn;

        case SessionStatus.signedIn:
          // A new account has the default settings rather than chosen ones, and
          // is held at the setup until it is finished. Sign-in writes the flag
          // for an account that already exists; the setup writes it only after
          // its last save has worked, so a failed save cannot let anyone
          // through with nothing set.
          final setupDone =
              LocalStore.instance.read<bool>(BoxKeys.onboardingSeen) ?? false;
          if (!setupDone) {
            return location == AppRoutes.setup ? null : AppRoutes.setup;
          }

          // Once the flag is set the setup is not bounced. It is left by an
          // explicit navigation, not a redirect.
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
      // Fades in from the splash rather than cutting: the launch animation ends
      // on the same warm ground, so the two read as one opening.
      GoRoute(
        path: AppRoutes.intro,
        name: RouteNames.intro,
        pageBuilder: (context, state) => CustomTransitionPage<void>(
          key: state.pageKey,
          child: const IntroView(),
          transitionDuration: AppDurations.page,
          reverseTransitionDuration: AppDurations.page,
          transitionsBuilder: (context, animation, secondary, child) =>
              FadeTransition(opacity: animation, child: child),
        ),
      ),
      GoRoute(
        path: AppRoutes.signIn,
        name: RouteNames.signIn,
        builder: (context, state) => ContentWidth(
          maxWidth: ContentWidths.reading,
          child: const SignInView(),
        ),
      ),
      GoRoute(
        path: AppRoutes.setup,
        name: RouteNames.setup,
        builder: (context, state) => ContentWidth(
          maxWidth: ContentWidths.reading,
          child: const SetupView(),
        ),
      ),
      GoRoute(
        path: AppRoutes.settings,
        name: RouteNames.settings,
        builder: (context, state) => ContentWidth(
          maxWidth: ContentWidths.regular,
          child: const SettingsView(),
        ),
      ),
      GoRoute(
        path: AppRoutes.refer,
        name: RouteNames.refer,
        builder: (context, state) => ContentWidth(
          maxWidth: ContentWidths.regular,
          child: const ReferView(),
        ),
      ),
      GoRoute(
        path: AppRoutes.plans,
        name: RouteNames.plans,
        builder: (context, state) => ContentWidth(
          maxWidth: ContentWidths.wide,
          child: const PlansView(),
        ),
      ),
      GoRoute(
        path: AppRoutes.voices,
        name: RouteNames.voices,
        builder: (context, state) => ContentWidth(
          maxWidth: ContentWidths.regular,
          child: const VoicesView(),
        ),
      ),
      GoRoute(
        path: AppRoutes.sources,
        name: RouteNames.sources,
        builder: (context, state) => ContentWidth(
          maxWidth: ContentWidths.regular,
          child: const SourcesView(),
        ),
      ),
      GoRoute(
        path: AppRoutes.search,
        name: RouteNames.search,
        builder: (context, state) => ContentWidth(
          maxWidth: ContentWidths.regular,
          child: const SearchView(),
        ),
      ),
      GoRoute(
        path: AppRoutes.addMantra,
        name: RouteNames.addMantra,
        builder: (context, state) => ContentWidth(
          maxWidth: ContentWidths.reading,
          child: const AddMantraView(),
        ),
      ),
      GoRoute(
        path: AppRoutes.mantraPattern,
        name: RouteNames.mantraDetail,
        builder: (context, state) => ContentWidth(
          maxWidth: ContentWidths.reading,
          child: MantraDetailView(slug: state.pathParameters['slug']!),
        ),
      ),
      GoRoute(
        path: AppRoutes.bookPattern,
        name: RouteNames.bookDetail,
        builder: (context, state) => ContentWidth(
          maxWidth: ContentWidths.regular,
          child: BookDetailView(slug: state.pathParameters['slug']!),
        ),
      ),
      GoRoute(
        path: AppRoutes.bookCantoPattern,
        name: RouteNames.bookCanto,
        builder: (context, state) => ContentWidth(
          maxWidth: ContentWidths.regular,
          child: ChapterListView(
          slug: state.pathParameters['slug']!,
          canto: int.parse(state.pathParameters['canto']!),
        ),
        ),
      ),
      GoRoute(
        path: AppRoutes.chapterPattern,
        name: RouteNames.chapterRead,
        builder: (context, state) => ContentWidth(
          maxWidth: ContentWidths.reading,
          child: ChapterReadView(
          slug: state.pathParameters['slug']!,
          number: int.parse(state.pathParameters['number']!),
          canto: int.tryParse(state.uri.queryParameters['canto'] ?? ''),
          targetVerseNumber: int.tryParse(state.uri.queryParameters['verse'] ?? ''),
        ),
        ),
      ),
      GoRoute(
        path: AppRoutes.chant,
        name: RouteNames.chant,
        builder: (context, state) => ContentWidth(
          maxWidth: ContentWidths.reading,
          child: ChantView(mantra: state.extra as Mantra?),
        ),
      ),
      GoRoute(
        path: AppRoutes.chantAnalytics,
        name: RouteNames.chantAnalytics,
        builder: (context, state) => ContentWidth(
          maxWidth: ContentWidths.regular,
          child: ChantAnalyticsView(args: state.extra as ChantAnalyticsArgs),
        ),
      ),
      GoRoute(
        path: AppRoutes.chantSessionPattern,
        name: RouteNames.chantSession,
        builder: (context, state) => ContentWidth(
          maxWidth: ContentWidths.reading,
          child: ChantSessionView(sessionId: state.pathParameters['id']!),
        ),
      ),
      GoRoute(
        path: AppRoutes.reelPattern,
        name: RouteNames.reelDetail,
        builder: (context, state) => ReelDetailView(reelId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: AppRoutes.bookReelsPattern,
        name: RouteNames.bookReels,
        builder: (context, state) => BookReelsView(verseId: state.pathParameters['verseId']!),
      ),
      GoRoute(
        path: AppRoutes.similarPattern,
        name: RouteNames.reelSimilar,
        builder: (context, state) => SimilarReelsView(reelId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: AppRoutes.creatorPattern,
        name: RouteNames.creatorProfile,
        builder: (context, state) => ContentWidth(
          maxWidth: ContentWidths.regular,
          child: CreatorView(creatorId: state.pathParameters['id']!),
        ),
      ),

      // Rises out of the bar's centre button, where it was opened from.
      GoRoute(
        path: AppRoutes.chat,
        name: RouteNames.chat,
        pageBuilder: (context, state) => CustomTransitionPage<void>(
          key: state.pageKey,
          child: ContentWidth(
            maxWidth: ContentWidths.reading,
            child: ChatView(initialPrompt: state.extra is String ? state.extra as String : null),
          ),
          transitionDuration: AppDurations.slow,
          reverseTransitionDuration: AppDurations.normal,
          transitionsBuilder: (context, animation, secondary, child) {
            if (MediaQuery.disableAnimationsOf(context)) return child;
            final curved = CurvedAnimation(
              parent: animation,
              curve: Curves.easeOutCubic,
              reverseCurve: Curves.easeInCubic,
            );
            return FadeTransition(
              opacity: curved,
              child: ScaleTransition(
                scale: Tween<double>(begin: 0.86, end: 1).animate(curved),
                alignment: const Alignment(0, 1),
                child: child,
              ),
            );
          },
        ),
      ),

      GoRoute(
        path: AppRoutes.support,
        name: RouteNames.support,
        builder: (context, state) => ContentWidth(
          maxWidth: ContentWidths.regular,
          child: const SupportView(),
        ),
      ),
      GoRoute(
        path: AppRoutes.developerChat,
        name: RouteNames.developerChat,
        builder: (context, state) => ContentWidth(
          maxWidth: ContentWidths.regular,
          child: const DeveloperChatView(),
        ),
      ),
      GoRoute(
        path: AppRoutes.ticketPattern,
        name: RouteNames.ticket,
        builder: (context, state) => ContentWidth(
          maxWidth: ContentWidths.regular,
          child: SupportTicketView(id: state.pathParameters['id']!),
        ),
      ),

      GoRoute(
        path: AppRoutes.calendar,
        name: RouteNames.calendar,
        builder: (context, state) => ContentWidth(
          maxWidth: ContentWidths.regular,
          child: const CalendarView(),
        ),
      ),

      GoRoute(
        path: AppRoutes.etiquette,
        name: RouteNames.etiquette,
        builder: (context, state) => ContentWidth(
          maxWidth: ContentWidths.regular,
          child: const EtiquetteView(),
        ),
      ),

      GoRoute(
        path: AppRoutes.etiquettePattern,
        name: RouteNames.etiquetteItem,
        builder: (context, state) => ContentWidth(
          maxWidth: ContentWidths.regular,
          child: EtiquetteItemView(id: state.pathParameters['id']!),
        ),
      ),

      GoRoute(
        path: AppRoutes.prayers,
        name: RouteNames.prayers,
        builder: (context, state) => ContentWidth(
          maxWidth: ContentWidths.regular,
          child: const PrayersView(),
        ),
      ),

      GoRoute(
        path: AppRoutes.prayerPattern,
        name: RouteNames.prayer,
        builder: (context, state) => ContentWidth(
          maxWidth: ContentWidths.reading,
          child: PrayerView(id: state.pathParameters['id']!),
        ),
      ),

      GoRoute(
        path: AppRoutes.routine,
        name: RouteNames.routine,
        builder: (context, state) => ContentWidth(
          maxWidth: ContentWidths.regular,
          child: const RoutineTab(showBack: true),
        ),
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
                path: AppRoutes.reels,
                name: RouteNames.reels,
                builder: (context, state) => const ReelsView(),
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
