import 'dart:ui' show DisplayFeature;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../services/push_link.dart';
import '../../core/layout/adaptive.dart';
import '../../widgets/common/glass_nav_bar.dart';
import '../../widgets/common/peacock_feather_icon.dart';
import '../../widgets/common/sakha_icon.dart';
import '../../widgets/common/side_nav.dart';

/// The dashboard shell: the four tabs, the bar that switches them, and Sakha's
/// button raised in the middle of it.
///
/// Reels is the last tab (Read is the third), and the only one that runs edge to edge: the bar
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

  /// The destinations, described once for the bar and the side column.
  List<NavItem> _items(AppLocalizations text) => [
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
      icon: Icons.play_circle_outline_rounded,
      selectedIcon: Icons.play_circle_rounded,
      label: text.reelsTitle,
      iconBuilder: (size) => PeacockFeatherIcon(size: size),
    ),
  ];

  /// Sakha is a person to talk to rather than a place to be, so the button is
  /// raised out of the tabs and opens the chat over them.
  NavHero _hero(AppLocalizations text) => NavHero(
    iconBuilder: (size) => SakhaIcon(size: size),
    label: text.tabSakha,
    semanticLabel: text.chatTitle,
    onTap: () => AppNavigator.instance.push(AppRoutes.chat),
  );

  @override
  Widget build(BuildContext context) {
    final layout = AdaptiveLayout.of(context);
    return layout.size.usesRail ? _buildWide(context, layout) : _buildCompact(context);
  }

  /// Windows from a large phone sideways up to a TV: the destinations in a
  /// column on the left and the tab beside it. There is no floating bar, so
  /// the tab is handed no bottom padding for it.
  ///
  /// The tab's [MediaQuery] is the room beside the column, with the hinge (if
  /// the window folds) moved to match, so a screen laid out for a hinge
  /// finds it where it really is. Reels keeps a phone's shape in the middle
  /// of a dark ground; the rest are held to a comfortable width.
  Widget _buildWide(BuildContext context, AdaptiveLayout layout) {
    final text = AppLocalizations.of(context);
    final media = MediaQuery.of(context);
    final extended = layout.size.isWide;
    final navWidth = extended ? SideNav.extendedWidth : SideNav.railWidth;

    final inner = media.copyWith(
      size: Size(media.size.width - navWidth, media.size.height),
      padding: media.padding.copyWith(left: 0),
      viewPadding: media.viewPadding.copyWith(left: 0),
      displayFeatures: [
        for (final f in media.displayFeatures)
          DisplayFeature(
            bounds: f.bounds.shift(Offset(-navWidth, 0)),
            type: f.type,
            state: f.state,
          ),
      ],
    );

    return Scaffold(
      body: Row(
        children: [
          SideNav(
            items: _items(text),
            selectedIndex: shell.currentIndex,
            onSelected: _onTap,
            extended: extended,
            hero: _hero(text),
            title: text.appName,
          ),
          Expanded(
            child: MediaQuery(
              data: inner,
              child: ContentWidth(
                maxWidth: _onReels
                    ? ContentWidths.reel
                    : shell.currentIndex == 0
                    ? ContentWidths.wide
                    : ContentWidths.regular,
                background: _onReels ? Colors.black : null,
                child: shell,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCompact(BuildContext context) {
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
              hero: _hero(text),
              items: _items(text),
            ),
          ),
        ],
      ),
    );
  }
}
