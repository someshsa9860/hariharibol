import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../providers/auth_provider.dart';

const _maroon = Color(0xFF7B1C1C);
const _saffron = Color(0xFFFF6B00);
const _gold = Color(0xFFD4A055);

class SplashPage extends ConsumerStatefulWidget {
  const SplashPage({super.key});

  @override
  ConsumerState<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends ConsumerState<SplashPage>
    with TickerProviderStateMixin {
  late AnimationController _fadeController;
  late AnimationController _progressController;
  late Animation<double> _fadeAnim;
  late Animation<double> _scaleAnim;

  @override
  void initState() {
    super.initState();

    _fadeController = AnimationController(
      duration: const Duration(milliseconds: 1000),
      vsync: this,
    );
    _fadeAnim =
        CurvedAnimation(parent: _fadeController, curve: Curves.easeOut);
    _scaleAnim = Tween<double>(begin: 0.72, end: 1.0).animate(
      CurvedAnimation(parent: _fadeController, curve: Curves.elasticOut),
    );
    _fadeController.forward();

    _progressController = AnimationController(
      duration: const Duration(milliseconds: 2500),
      vsync: this,
    );
    _progressController.forward();

    Future.delayed(const Duration(milliseconds: 2500), _checkAuthStatus);
  }

  void _checkAuthStatus() {
    if (!mounted) return;
    final authState = ref.read(authStateProvider);
    authState.whenData((state) {
      if (!mounted) return;
      if (state.isAuthenticated) {
        context.go(state.needsOnboarding ? '/onboarding' : '/home');
      } else {
        context.go('/login');
      }
    });
    if (authState.isLoading || authState.hasError) {
      context.go('/login');
    }
  }

  @override
  void dispose() {
    _fadeController.dispose();
    _progressController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Full-screen maroon-to-saffron radial gradient
          Container(
            decoration: const BoxDecoration(
              gradient: RadialGradient(
                center: Alignment.center,
                radius: 1.15,
                colors: [_maroon, Color(0xFFAA3500), _saffron],
                stops: [0.0, 0.55, 1.0],
              ),
            ),
          ),

          // Centered content
          Center(
            child: FadeTransition(
              opacity: _fadeAnim,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Om symbol with gold glow
                  ScaleTransition(
                    scale: _scaleAnim,
                    child: Container(
                      decoration: BoxDecoration(
                        boxShadow: [
                          BoxShadow(
                            color: _gold.withOpacity(0.65),
                            blurRadius: 48,
                            spreadRadius: 14,
                          ),
                        ],
                      ),
                      child: Text(
                        'ॐ', // ॐ
                        style: TextStyle(
                          fontSize: 80,
                          color: _gold,
                          fontWeight: FontWeight.bold,
                          shadows: const [
                            Shadow(
                              color: Colors.white30,
                              blurRadius: 10,
                              offset: Offset(0, 3),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 30),

                  // App name — Playfair Display bold 32sp
                  Text(
                    'HariHariBol',
                    style: GoogleFonts.playfairDisplay(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Tagline — Inter italic 14sp
                  Text(
                    'Sacred Wisdom for Every Soul',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontStyle: FontStyle.italic,
                      color: Colors.white.withOpacity(0.85),
                      letterSpacing: 0.25,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Bottom saffron progress bar animating left-to-right
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: AnimatedBuilder(
              animation: _progressController,
              builder: (context, _) {
                final screenW = MediaQuery.of(context).size.width;
                return Align(
                  alignment: Alignment.centerLeft,
                  child: Container(
                    height: 3,
                    width: screenW * _progressController.value,
                    decoration: BoxDecoration(
                      color: _gold,
                      boxShadow: [
                        BoxShadow(
                          color: _gold.withOpacity(0.55),
                          blurRadius: 6,
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
