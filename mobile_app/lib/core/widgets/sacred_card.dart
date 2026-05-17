import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

// Sandstone-tinted card with optional saffron left accent border
class SacredCard extends StatelessWidget {
  final Widget child;
  final bool hasSaffronBorder;
  final Color? backgroundColor;
  final double borderRadius;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;

  const SacredCard({
    super.key,
    required this.child,
    this.hasSaffronBorder = false,
    this.backgroundColor,
    this.borderRadius = 16,
    this.padding,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final card = Container(
      padding: padding ?? const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: backgroundColor ?? AppColors.sandstone.withOpacity(0.15),
        borderRadius: BorderRadius.circular(borderRadius),
        border: hasSaffronBorder
            ? Border(
                left: BorderSide(color: AppColors.saffron, width: 3),
                top: BorderSide(color: AppColors.sandstone.withOpacity(0.25)),
                right: BorderSide(color: AppColors.sandstone.withOpacity(0.25)),
                bottom: BorderSide(color: AppColors.sandstone.withOpacity(0.25)),
              )
            : Border.all(color: AppColors.sandstone.withOpacity(0.3)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: child,
    );

    if (onTap == null) return card;
    return GestureDetector(onTap: onTap, child: card);
  }
}
