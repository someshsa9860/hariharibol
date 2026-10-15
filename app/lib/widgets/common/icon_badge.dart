import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';

/// A small round tile holding an icon — how a card's heading or a statistic
/// gets a mark without a second colour.
///
/// The tile is the theme's own `primaryContainer` (pale saffron in light, a
/// step above the card in dark) and the icon is what sits on it, so it follows
/// both palettes with nothing chosen here. Decorative: whatever it labels has
/// its own text, so it is hidden from screen readers.
class IconBadge extends StatelessWidget {
  const IconBadge({super.key, required this.icon, this.size = AppSizes.avatarSm});

  final IconData icon;
  final double size;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: context.colors.primaryContainer,
        ),
        child: Icon(icon, size: size / 2, color: context.colors.onPrimaryContainer),
      ),
    );
  }
}
