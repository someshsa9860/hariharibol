import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../providers/auth_provider.dart';
import '../widgets/google_sign_in_button.dart';
import '../widgets/apple_sign_in_button.dart';

const _maroon = Color(0xFF7B1C1C);
const _saffron = Color(0xFFFF6B00);
const _peacock = Color(0xFF006B6B);
const _bgLight = Color(0xFFFAF6EE);
const _sandstone = Color(0xFFC4A882);
const _textMuted = Color(0xFF7A6050);
const _errorRed = Color(0xFFD32F2F);

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  String? _errorMessage;

  Future<void> _signInWithGoogle() async {
    setState(() => _errorMessage = null);
    try {
      await ref.read(signInWithGoogleProvider.future);
      if (!mounted) return;
      final s = ref.read(authStateProvider).valueOrNull;
      context.go(s?.needsOnboarding == true ? '/onboarding' : '/home');
    } catch (_) {
      if (!mounted) return;
      setState(() => _errorMessage = 'Google sign-in failed. Please try again.');
    }
  }

  Future<void> _signInWithApple() async {
    setState(() => _errorMessage = null);
    try {
      await ref.read(signInWithAppleProvider.future);
      if (!mounted) return;
      final s = ref.read(authStateProvider).valueOrNull;
      context.go(s?.needsOnboarding == true ? '/onboarding' : '/home');
    } catch (_) {
      if (!mounted) return;
      setState(() => _errorMessage = 'Apple sign-in failed. Please try again.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [_bgLight, _sandstone],
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                minHeight: MediaQuery.of(context).size.height -
                    MediaQuery.of(context).padding.top -
                    MediaQuery.of(context).padding.bottom,
              ),
              child: IntrinsicHeight(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    const SizedBox(height: 32),

                    // Decorative Om — large, saffron, semi-transparent
                    Opacity(
                      opacity: 0.35,
                      child: Text(
                        'ॐ',
                        style: TextStyle(
                          fontSize: 110,
                          color: _saffron,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),

                    // Welcome heading — Playfair Display 32sp maroon
                    Text(
                      'Welcome Back',
                      style: GoogleFonts.playfairDisplay(
                        fontSize: 32,
                        fontWeight: FontWeight.bold,
                        color: _maroon,
                        letterSpacing: 0.3,
                      ),
                    ),
                    const SizedBox(height: 10),

                    // Tagline — Inter 14sp muted
                    Text(
                      'Continue your journey of sacred wisdom',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        color: _textMuted,
                        height: 1.45,
                      ),
                    ),
                    const SizedBox(height: 32),

                    // Error card
                    if (_errorMessage != null)
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(bottom: 16),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          color: _errorRed.withOpacity(0.08),
                          border: Border.all(
                              color: _errorRed.withOpacity(0.35), width: 1),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline,
                                color: _errorRed, size: 18),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                _errorMessage!,
                                style: GoogleFonts.inter(
                                    fontSize: 13, color: _errorRed),
                              ),
                            ),
                          ],
                        ),
                      ),

                    // Google sign-in button
                    GoogleSignInButton(onPressed: _signInWithGoogle),
                    const SizedBox(height: 14),

                    // Apple sign-in button
                    AppleSignInButton(onPressed: _signInWithApple),
                    const SizedBox(height: 24),

                    // Divider — or —
                    Row(
                      children: [
                        const Expanded(
                            child: Divider(color: Color(0xFFB0A090), height: 1)),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          child: Text(
                            '— or —',
                            style: GoogleFonts.inter(
                                fontSize: 13, color: _textMuted),
                          ),
                        ),
                        const Expanded(
                            child: Divider(color: Color(0xFFB0A090), height: 1)),
                      ],
                    ),
                    const SizedBox(height: 22),

                    // Browse as Guest
                    GestureDetector(
                      onTap: () => context.go('/home'),
                      child: Text(
                        'Browse as Guest',
                        style: GoogleFonts.inter(
                          fontSize: 15,
                          color: _peacock,
                          fontWeight: FontWeight.w600,
                          decoration: TextDecoration.underline,
                          decorationColor: _peacock,
                        ),
                      ),
                    ),

                    const Spacer(),

                    // Privacy policy footer
                    Padding(
                      padding:
                          const EdgeInsets.only(top: 24, bottom: 20),
                      child: Text(
                        'By signing in, you agree to our Terms of Service\nand Privacy Policy',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: _textMuted.withOpacity(0.75),
                          height: 1.55,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
