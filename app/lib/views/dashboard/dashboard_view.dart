import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/generated/app_localizations.dart';

/// The dashboard shell: the four tabs and the bar that switches them.
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

    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: shell.currentIndex,
        onDestinationSelected: _onTap,
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.home_outlined),
            selectedIcon: const Icon(Icons.home_rounded),
            label: text.tabHome,
          ),
          NavigationDestination(
            icon: const Icon(Icons.self_improvement_outlined),
            selectedIcon: const Icon(Icons.self_improvement_rounded),
            label: text.tabSadhana,
          ),
          NavigationDestination(
            icon: const Icon(Icons.menu_book_outlined),
            selectedIcon: const Icon(Icons.menu_book_rounded),
            label: text.tabLibrary,
          ),
          NavigationDestination(
            icon: const Icon(Icons.person_outline_rounded),
            selectedIcon: const Icon(Icons.person_rounded),
            label: text.tabProfile,
          ),
        ],
      ),
    );
  }
}
