import 'dart:ui';
import 'package:flutter/material.dart';

class GlassAppBar extends StatelessWidget implements PreferredSizeWidget {
  final Widget? title;
  final List<Widget>? actions;

  const GlassAppBar({
    super.key,
    this.title,
    this.actions,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: AppBar(
          title: title,
          actions: actions,
          backgroundColor: Colors.white.withOpacity(0.1),
          elevation: 0,
          foregroundColor: Colors.white,
        ),
      ),
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}