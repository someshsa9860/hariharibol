import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';

/// The one spinner. Centred, sized, and never a bare
/// `CircularProgressIndicator()` in a view.
class AppLoader extends StatelessWidget {
  const AppLoader({super.key, this.size = AppSizes.iconLg});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SizedBox(
        width: size,
        height: size,
        child: const CircularProgressIndicator(strokeWidth: 3),
      ),
    );
  }
}
