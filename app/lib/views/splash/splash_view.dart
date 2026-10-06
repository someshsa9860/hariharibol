import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../widgets/common/app_loader.dart';

/// The first frame.
///
/// The session is restored before `runApp`, so this is usually visible for a
/// single frame. It exists for the case where that stops being true — and so
/// the router always has somewhere to sit while the answer is unknown.
class SplashView extends StatelessWidget {
  const SplashView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.asset(
              'assets/logo.png',
              width: 180,
              height: 180,
              fit: BoxFit.contain,
            ),
            const SizedBox(height: AppSpacing.xl),
            const AppLoader(size: AppSizes.iconMd),
          ],
        ),
      ),
    );
  }
}
