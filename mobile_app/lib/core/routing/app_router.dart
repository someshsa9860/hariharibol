import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/pages/splash_page.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/auth/presentation/pages/onboarding_sampraday_page.dart';
import '../../features/auth/presentation/providers/auth_provider.dart';
import '../../features/shell/presentation/pages/main_shell_page.dart';
import '../../features/home/presentation/pages/verse_detail_page.dart';
import '../../features/home/presentation/pages/verse_of_day_page.dart';
import '../../features/sampradayas/presentation/pages/sampraday_detail_page.dart';
import '../../features/sampradayas/presentation/pages/sampradayas_page.dart';
import '../../features/groups/presentation/pages/groups_page.dart';
import '../../features/chanting/presentation/pages/mantra_detail_page.dart';
import '../../features/chanting/presentation/pages/chant_counter_page.dart';
import '../../features/chanting/presentation/pages/chant_history_page.dart';
import '../../features/mantras/presentation/pages/mantra_library_page.dart';
import '../../features/chatbot/presentation/pages/chat_session_page.dart';
import '../../features/groups/presentation/pages/group_chat_page.dart';
import '../../features/settings/presentation/pages/settings_page.dart';
import '../../features/reading/presentation/pages/book_detail_page.dart';
import '../../features/reading/presentation/pages/chapter_reading_page.dart';
import '../../features/search/presentation/pages/search_page.dart';
import '../../features/notifications/presentation/pages/notifications_page.dart';
import '../../features/favorites/presentation/pages/favorites_page.dart';

// ─── Page transition helpers ──────────────────────────────────────────────────

CustomTransitionPage<void> _slideFromRight({
  required GoRouterState state,
  required Widget child,
}) {
  return CustomTransitionPage<void>(
    key: state.pageKey,
    child: child,
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final slide = Tween<Offset>(
        begin: const Offset(1.0, 0.0),
        end: Offset.zero,
      ).animate(CurvedAnimation(parent: animation, curve: Curves.easeInOutCubic));
      return SlideTransition(
        position: slide,
        child: FadeTransition(
          opacity: CurvedAnimation(parent: animation, curve: Curves.easeIn),
          child: child,
        ),
      );
    },
    transitionDuration: const Duration(milliseconds: 280),
  );
}

CustomTransitionPage<void> _fadeTransition({
  required GoRouterState state,
  required Widget child,
}) {
  return CustomTransitionPage<void>(
    key: state.pageKey,
    child: child,
    transitionsBuilder: (context, animation, secondaryAnimation, child) =>
        FadeTransition(opacity: animation, child: child),
    transitionDuration: const Duration(milliseconds: 250),
  );
}

// ─── Auth Redirect Notifier ───────────────────────────────────────────────────

class _RouterNotifier extends ChangeNotifier {
  final Ref _ref;

  _RouterNotifier(this._ref) {
    _ref.listen(authStateProvider, (_, __) => notifyListeners());
  }

  static const _publicPaths = {
    '/splash',
    '/login',
    '/onboarding',
    '/verse-of-day',
    '/search',
  };

  String? redirect(BuildContext context, GoRouterState state) {
    final auth = _ref.read(authStateProvider);
    if (auth.isLoading) return null;

    final isAuth = auth.valueOrNull?.isAuthenticated ?? false;
    final location = state.matchedLocation;

    if (!isAuth && !_publicPaths.contains(location)) {
      return '/login';
    }
    return null;
  }
}

// ─── Router Provider ──────────────────────────────────────────────────────────

final routerProvider = Provider<GoRouter>((ref) {
  final notifier = _RouterNotifier(ref);
  ref.onDispose(notifier.dispose);

  final router = GoRouter(
    initialLocation: '/splash',
    refreshListenable: notifier,
    redirect: notifier.redirect,
    routes: _routes,
  );
  ref.onDispose(router.dispose);
  return router;
});

// ─── Route Definitions ────────────────────────────────────────────────────────

final _routes = <RouteBase>[
  GoRoute(
    path: '/splash',
    pageBuilder: (context, state) =>
        _fadeTransition(state: state, child: const SplashPage()),
  ),
  GoRoute(
    path: '/login',
    pageBuilder: (context, state) =>
        _fadeTransition(state: state, child: const LoginPage()),
  ),
  GoRoute(
    path: '/onboarding',
    pageBuilder: (context, state) =>
        _slideFromRight(state: state, child: const OnboardingSampradayPage()),
  ),

  // ── Shell tabs ───────────────────────────────────────────────────────────────
  GoRoute(
    path: '/home',
    builder: (context, state) => const MainShellPage(initialIndex: 0),
  ),
  GoRoute(
    path: '/books',
    builder: (context, state) => const MainShellPage(initialIndex: 1),
  ),
  GoRoute(
    path: '/chanting',
    builder: (context, state) => const MainShellPage(initialIndex: 2),
  ),
  GoRoute(
    path: '/gurudev',
    builder: (context, state) => const MainShellPage(initialIndex: 3),
  ),
  GoRoute(
    path: '/profile',
    builder: (context, state) => const MainShellPage(initialIndex: 4),
  ),
  // Legacy shell aliases
  GoRoute(
    path: '/read',
    builder: (context, state) => const MainShellPage(initialIndex: 1),
  ),
  GoRoute(
    path: '/community',
    builder: (context, state) => const MainShellPage(initialIndex: 0),
  ),

  // ── Verse of Day ─────────────────────────────────────────────────────────────
  GoRoute(
    path: '/verse-of-day',
    pageBuilder: (context, state) =>
        _slideFromRight(state: state, child: const VerseOfDayPage()),
  ),

  // ── Search ───────────────────────────────────────────────────────────────────
  GoRoute(
    path: '/search',
    pageBuilder: (context, state) =>
        _slideFromRight(state: state, child: const SearchPage()),
  ),

  // ── Sampradayas ──────────────────────────────────────────────────────────────
  GoRoute(
    path: '/sampradayas',
    pageBuilder: (context, state) =>
        _slideFromRight(state: state, child: const SampradayasPage()),
  ),
  GoRoute(
    path: '/sampradayas/:id',
    pageBuilder: (context, state) => _slideFromRight(
      state: state,
      child: SampradayDetailPage(sampradayId: state.pathParameters['id']!),
    ),
  ),
  // Legacy singular form
  GoRoute(
    path: '/sampraday/:id',
    pageBuilder: (context, state) => _slideFromRight(
      state: state,
      child: SampradayDetailPage(sampradayId: state.pathParameters['id']!),
    ),
  ),

  // ── Groups ───────────────────────────────────────────────────────────────────
  GoRoute(
    path: '/groups',
    pageBuilder: (context, state) =>
        _slideFromRight(state: state, child: const GroupsPage()),
  ),
  GoRoute(
    path: '/groups/:id',
    pageBuilder: (context, state) => _slideFromRight(
      state: state,
      child: GroupChatPage(groupId: state.pathParameters['id']!),
    ),
  ),
  GoRoute(
    path: '/group/:id',
    pageBuilder: (context, state) => _slideFromRight(
      state: state,
      child: GroupChatPage(groupId: state.pathParameters['id']!),
    ),
  ),

  // ── GuruDev chat session ──────────────────────────────────────────────────────
  GoRoute(
    path: '/gurudev/session/:id',
    pageBuilder: (context, state) {
      final extra = (state.extra as Map<String, dynamic>?) ?? {};
      return _slideFromRight(
        state: state,
        child: ChatSessionPage(
          sessionId: state.pathParameters['id']!,
          initialPrompt: extra['initialPrompt'] as String?,
        ),
      );
    },
  ),

  // ── Verse Detail ─────────────────────────────────────────────────────────────
  GoRoute(
    path: '/verse/:id',
    pageBuilder: (context, state) => _slideFromRight(
      state: state,
      child: VerseDetailPage(verseId: state.pathParameters['id']!),
    ),
  ),

  // ── Chanting ─────────────────────────────────────────────────────────────────
  GoRoute(
    path: '/chanting/history',
    pageBuilder: (context, state) =>
        _slideFromRight(state: state, child: const ChantHistoryPage()),
  ),
  GoRoute(
    path: '/mantras',
    pageBuilder: (context, state) =>
        _slideFromRight(state: state, child: const MantraLibraryPage()),
  ),
  GoRoute(
    path: '/mantra/:id',
    pageBuilder: (context, state) => _slideFromRight(
      state: state,
      child: MantraDetailPage(mantraId: state.pathParameters['id']!),
    ),
  ),
  GoRoute(
    path: '/chant/:mantraId',
    pageBuilder: (context, state) {
      final extra = (state.extra as Map<String, dynamic>?) ?? {};
      return _slideFromRight(
        state: state,
        child: ChantCounterPage(
          mantraId: state.pathParameters['mantraId']!,
          mantraName: extra['mantraName'] as String? ?? 'Mantra',
          goal: extra['goal'] as int? ?? 108,
        ),
      );
    },
  ),

  // ── Books ─────────────────────────────────────────────────────────────────────
  GoRoute(
    path: '/books/:id',
    pageBuilder: (context, state) => _slideFromRight(
      state: state,
      child: BookDetailPage(bookId: state.pathParameters['id']!),
    ),
  ),
  GoRoute(
    path: '/books/:bookId/chapters/:chapterNum',
    pageBuilder: (context, state) => _slideFromRight(
      state: state,
      child: ChapterReadingPage(
        bookId: state.pathParameters['bookId']!,
        chapterNum: int.parse(state.pathParameters['chapterNum']!),
      ),
    ),
  ),
  // Legacy singular paths
  GoRoute(
    path: '/book/:id',
    pageBuilder: (context, state) => _slideFromRight(
      state: state,
      child: BookDetailPage(bookId: state.pathParameters['id']!),
    ),
  ),
  GoRoute(
    path: '/book/:bookId/chapter/:num',
    pageBuilder: (context, state) => _slideFromRight(
      state: state,
      child: ChapterReadingPage(
        bookId: state.pathParameters['bookId']!,
        chapterNum: int.parse(state.pathParameters['num']!),
      ),
    ),
  ),

  // ── Profile & Settings ────────────────────────────────────────────────────────
  GoRoute(
    path: '/settings',
    pageBuilder: (context, state) =>
        _slideFromRight(state: state, child: const SettingsPage()),
  ),

  // ── Notifications ─────────────────────────────────────────────────────────────
  GoRoute(
    path: '/notifications',
    pageBuilder: (context, state) =>
        _slideFromRight(state: state, child: const NotificationsPage()),
  ),

  // ── Favorites ─────────────────────────────────────────────────────────────────
  GoRoute(
    path: '/favorites',
    pageBuilder: (context, state) =>
        _slideFromRight(state: state, child: const FavoritesPage()),
  ),
];
