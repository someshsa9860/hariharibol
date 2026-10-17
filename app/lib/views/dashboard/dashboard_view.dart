import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../services/push_link.dart';
import '../../widgets/common/glass_nav_bar.dart';
import '../../widgets/common/sakha_icon.dart';

/// The dashboard shell: the four tabs, the bar that switches them, and Sakha's
/// button raised in the middle of it.
///
/// Reels is the third tab, and the only one that runs edge to edge: the bar
/// stays, but turns dark over the video (`onMedia`) instead of laying cream
/// glass across a picture.
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
///
/// It is also the first screen that is signed in, past the launch animation and
/// past the language picker, so it is what tells [PushLinks] there is somewhere
/// to open a tapped notification.
class DashboardView extends StatefulWidget {
  const DashboardView({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  State<DashboardView> createState() => _DashboardViewState();
}

class _DashboardViewState extends State<DashboardView> {
  StatefulNavigationShell get shell => widget.shell;

  @override
  void initState() {
    super.initState();
    // After the first frame, so the screen it opens lands over a dashboard that
    // exists — and Home is what back returns to.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) PushLinks.instance.setReady(true);
    });
  }

  @override
  void dispose() {
    PushLinks.instance.setReady(false);
    super.dispose();
  }

  /// Whether the tab on screen is the reels feed.
  bool get _onReels => shell.currentIndex == AppRoutes.tabs.indexOf(AppRoutes.reels);

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
              onMedia: _onReels,
              // Sakha is a person to talk to rather than a place to be, so the
              // button is raised out of the tabs and opens the chat over them.
              hero: NavHero(
                iconBuilder: (size) => SakhaIcon(size: size),
                label: text.tabSakha,
                semanticLabel: text.chatTitle,
                onTap: () => AppNavigator.instance.push(AppRoutes.chat),
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
                  icon: Icons.play_circle_outline_rounded,
                  selectedIcon: Icons.play_circle_rounded,
                  label: text.reelsTitle,
                ),
                NavItem(
                  icon: Icons.menu_book_outlined,
                  selectedIcon: Icons.menu_book_rounded,
                  label: text.tabLibrary,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
