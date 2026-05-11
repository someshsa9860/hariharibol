import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/pages/splash_page.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/home/presentation/pages/home_page.dart';
import '../../features/home/presentation/pages/verse_detail_page.dart';
import '../../features/sampradayas/presentation/pages/sampraday_detail_page.dart';
import '../../features/chanting/presentation/pages/chanting_page.dart';
import '../../features/chanting/presentation/pages/mantra_detail_page.dart';
import '../../features/chanting/presentation/pages/chant_counter_page.dart';
import '../../features/chanting/presentation/pages/chant_history_page.dart';

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
      GoRoute(
        path: '/home',
        builder: (context, state) => const HomePage(),
      ),
      GoRoute(
        path: '/verse/:id',
        builder: (context, state) => VerseDetailPage(
          verseId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/sampraday/:id',
        builder: (context, state) => SampradayDetailPage(
          sampradayId: state.pathParameters['id']!,
        ),
      ),
      // ── Chanting ─────────────────────────────────────────────────────────
      GoRoute(
        path: '/chanting',
        builder: (context, state) => const ChantingPage(),
      ),
      GoRoute(
        path: '/chanting/history',
        builder: (context, state) => const ChantHistoryPage(),
      ),
      GoRoute(
        path: '/mantra/:id',
        builder: (context, state) => MantraDetailPage(
          mantraId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/chant/:mantraId',
        builder: (context, state) {
          final extra =
              (state.extra as Map<String, dynamic>?) ?? {};
          return ChantCounterPage(
            mantraId: state.pathParameters['mantraId']!,
            mantraName: extra['mantraName'] as String? ?? 'Mantra',
            goal: extra['goal'] as int? ?? 108,
          );
        },
      ),
    ],
  );
}
