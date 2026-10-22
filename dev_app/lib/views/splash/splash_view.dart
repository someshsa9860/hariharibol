import 'package:flutter/material.dart';

/// Shown while the stored session is read — a moment, then the router moves on.
class SplashView extends StatelessWidget {
  const SplashView({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}
