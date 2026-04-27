import 'dart:ui';
import 'package:flutter/material.dart';

class GlassTabBar extends StatelessWidget {
  final List<Widget> tabs;

  const GlassTabBar({
    super.key,
    required this.tabs,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16.0),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.1),
            borderRadius: BorderRadius.circular(16.0),
          ),
          child: TabBar(
            tabs: tabs,
            indicatorColor: Colors.white,
            labelColor: Colors.white,
            unselectedLabelColor: Colors.white70,
          ),
        ),
      ),
    );
  }
}