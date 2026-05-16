import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/pages/splash_page.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/auth/presentation/pages/onboarding_sampraday_page.dart';
import '../../features/shell/presentation/pages/main_shell_page.dart';
import '../../features/home/presentation/pages/verse_detail_page.dart';
import '../../features/sampradayas/presentation/pages/sampraday_detail_page.dart';
import '../../features/chanting/presentation/pages/mantra_detail_page.dart';
import '../../features/chanting/presentation/pages/chant_counter_page.dart';
import '../../features/chanting/presentation/pages/chant_history_page.dart';
import '../../features/mantras/presentation/pages/mantra_library_page.dart';
import '../../features/chatbot/presentation/pages/chat_session_page.dart';
import '../../features/groups/presentation/pages/group_chat_page.dart';
import '../../features/profile/presentation/pages/profile_page.dart';
import '../../features/settings/presentation/pages/settings_page.dart';
import '../../features/reading/presentation/pages/book_detail_page.dart';
import '../../features/reading/presentation/pages/chapter_reading_page.dart';

class AppRouter {
  static final GoRouter router = GoRouter(
    initialLocation: '/splash',
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashPage(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginPage(),
      ),
      // ── Onboarding ─────────────────────────────────────────────────────────
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingSampradayPage(),
      ),
      // ── Shell (4-tab) ──────────────────────────────────────────────────────
      GoRoute(
        path: '/home',
        builder: (context, state) => const MainShellPage(initialIndex: 0),
      ),
      GoRoute(
        path: '/gurudev',
        builder: (context, state) => const MainShellPage(initialIndex: 1),
      ),
      GoRoute(
        path: '/chanting',
        builder: (context, state) => const MainShellPage(initialIndex: 2),
      ),
      GoRoute(
        path: '/read',
        builder: (context, state) => const MainShellPage(initialIndex: 3),
      ),
      // ── Chat Session ───────────────────────────────────────────────────────
      GoRoute(
        path: '/gurudev/session/:id',
        builder: (context, state) {
          final extra = (state.extra as Map<String, dynamic>?) ?? {};
          return ChatSessionPage(
            sessionId: state.pathParameters['id']!,
            initialPrompt: extra['initialPrompt'] as String?,
          );
        },
      ),
      // ── Verse Detail ───────────────────────────────────────────────────────
      GoRoute(
        path: '/verse/:id',
        builder: (context, state) => VerseDetailPage(verseId: state.pathParameters['id']!),
      ),
      // ── Sampraday Detail ───────────────────────────────────────────────────
      GoRoute(
        path: '/sampraday/:id',
        builder: (context, state) => SampradayDetailPage(sampradayId: state.pathParameters['id']!),
      ),
      // ── Chanting sub-routes ────────────────────────────────────────────────
      GoRoute(
        path: '/chanting/history',
        builder: (context, state) => const ChantHistoryPage(),
      ),
      GoRoute(
        path: '/mantras',
        builder: (context, state) => const MantraLibraryPage(),
      ),
      GoRoute(
        path: '/mantra/:id',
        builder: (context, state) => MantraDetailPage(mantraId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/chant/:mantraId',
        builder: (context, state) {
          final extra = (state.extra as Map<String, dynamic>?) ?? {};
          return ChantCounterPage(
            mantraId: state.pathParameters['mantraId']!,
            mantraName: extra['mantraName'] as String? ?? 'Mantra',
            goal: extra['goal'] as int? ?? 108,
          );
        },
      ),
      // ── Group Chat ─────────────────────────────────────────────────────────
      GoRoute(
        path: '/group/:id',
        builder: (context, state) => GroupChatPage(groupId: state.pathParameters['id']!),
      ),
      // ── Book detail & Chapter reading ──────────────────────────────────────
      GoRoute(
        path: '/book/:id',
        builder: (context, state) =>
            BookDetailPage(bookId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/book/:bookId/chapter/:num',
        builder: (context, state) => ChapterReadingPage(
          bookId: state.pathParameters['bookId']!,
          chapterNum: int.parse(state.pathParameters['num']!),
        ),
      ),
      // ── Profile & Settings ─────────────────────────────────────────────────
      GoRoute(
        path: '/profile',
        builder: (context, state) => const ProfilePage(),
      ),
      GoRoute(
        path: '/settings',
        builder: (context, state) => const SettingsPage(),
      ),
    ],
  );
}
