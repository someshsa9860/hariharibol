import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../widgets/common/glass_nav_bar.dart';

/// The dashboard shell: the four tabs and the bar that switches them.
///
/// The bar and the floating button are stacked over the content by hand rather
/// than handed to `Scaffold`. They have to be: the bar is frosted, and a
/// `BackdropFilter` in a Scaffold's `bottomNavigationBar` slot swallows the
/// `floatingActionButton` — it ends up inside the blur instead of above it.
/// Owning the stack makes the paint order ours.
///
/// It holds no data of its own. Each tab is its own file and loads what it
/// needs, which is what keeps this file three screens shorter than it would
/// otherwise be.
class DashboardView extends StatelessWidget {
  const DashboardView({super.key, required this.shell});

  final StatefulNavigationShell shell;

  void _onTap(int index) {
    // Tapping the tab you are already on returns it to its first screen, which
    // is what every other app does and what people expect.
    shell.goBranch(index, initialLocation: index == shell.currentIndex);
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final media = MediaQuery.of(context);
    final barHeight = GlassNavBar.heightOf(context);

    return Scaffold(
      body: Stack(
        children: [
          // The tabs believe the screen ends where the bar begins. Handing them
          // the bar's height as bottom padding is what lets each one pad its
          // own scroll view without knowing the bar exists.
          Positioned.fill(
            child: MediaQuery(
              data: media.copyWith(
                padding: media.padding.copyWith(bottom: barHeight),
              ),
              child: shell,
            ),
          ),

          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: GlassNavBar(
              selectedIndex: shell.currentIndex,
              onSelected: _onTap,
              // Reels is the one thing worth reaching from anywhere without
              // leaving the tab you're on, so it gets the circle of its own
              // rather than a fifth tab.
              action: NavAction(
                icon: Icons.smart_display_rounded,
                label: text.reelsTitle,
                onTap: () => AppNavigator.instance.push(AppRoutes.reels),
              ),
              items: [
                NavItem(
                  icon: Icons.home_outlined,
                  selectedIcon: Icons.home_rounded,
                  label: text.tabHome,
                ),
                NavItem(
                  icon: Icons.self_improvement_outlined,
                  selectedIcon: Icons.self_improvement_rounded,
                  label: text.tabSadhana,
                ),
                NavItem(
                  icon: Icons.menu_book_outlined,
                  selectedIcon: Icons.menu_book_rounded,
                  label: text.tabLibrary,
                ),
                NavItem(
                  icon: Icons.checklist_outlined,
                  selectedIcon: Icons.checklist_rounded,
                  label: text.tabRoutine,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
