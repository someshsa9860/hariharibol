import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';

/// One sign-in button, so Google and Apple sit at the same height and weight.
///
/// The icon is passed in rather than chosen here: Google's brand guidelines
/// require their own mark, which belongs in `assets/` as an image, not as a
/// Material icon approximation.
class SocialSignInButton extends StatelessWidget {
  const SocialSignInButton({
    super.key,
    required this.label,
    required this.icon,
    required this.onPressed,
    this.filled = false,
  });

  final String label;
  final Widget icon;
  final VoidCallback? onPressed;

  /// The primary of the two. Only one button on the screen should be filled.
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final content = Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        icon,
        const SizedBox(width: AppSpacing.md),
        Text(label),
      ],
    );

    if (filled) {
      return FilledButton(onPressed: onPressed, child: content);
    }
    return OutlinedButton(onPressed: onPressed, child: content);
  }
}
