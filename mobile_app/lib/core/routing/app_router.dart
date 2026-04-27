import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/pages/splash_page.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/home/presentation/screens/home_screen.dart';
import '../../features/verse/presentation/screens/verse_detail_screen.dart';

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
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: '/verse/:id',
        builder: (context, state) => VerseDetailScreen(
          verseId: state.pathParameters['id']!,
        ),
      ),
    ],
    // Add error builder, redirect, etc.
  );
}