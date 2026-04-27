import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/auth_provider.dart';
import '../widgets/google_sign_in_button.dart';
import '../widgets/apple_sign_in_button.dart';

class LoginPage extends ConsumerWidget {
  const LoginPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: const Color(0xFF1A1A1A),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Header section
              Column(
                children: [
                  const SizedBox(height: 50),
                  Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        colors: [
                          Colors.amber[400]!,
                          Colors.orange[600]!,
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                    child: const Center(
                      child: Text(
                        '🙏',
                        style: TextStyle(fontSize: 60),
                      ),
                    ),
                  ),
                  const SizedBox(height: 40),
                  Text(
                    'HariHariBol',
                    style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Explore Sacred Wisdom',
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: Colors.white70,
                        ),
                  ),
                ],
              ),
              // Login buttons
              Column(
                children: [
                  GoogleSignInButton(
                    onPressed: () async {
                      try {
                        await ref.read(signInWithGoogleProvider.future);
                        // Navigation will be handled by router
                      } catch (e) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Login failed: $e')),
                        );
                      }
                    },
                  ),
                  const SizedBox(height: 16),
                  AppleSignInButton(
                    onPressed: () async {
                      try {
                        await ref.read(signInWithAppleProvider.future);
                        // Navigation will be handled by router
                      } catch (e) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Login failed: $e')),
                        );
                      }
                    },
                  ),
                  const SizedBox(height: 32),
                  // Terms and privacy
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text(
                      'By signing in, you agree to our Terms of Service and Privacy Policy',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Colors.white54,
                          ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
