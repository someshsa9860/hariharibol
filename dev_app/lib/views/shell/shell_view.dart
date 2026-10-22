import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../providers/chat_provider.dart';
import '../../services/auth_service.dart';

/// The four tabs. On launch it also re-reads who is signed in: an account whose developer access was taken away
/// while the app was closed is signed out here instead of meeting a wall of 403s.
class ShellView extends ConsumerStatefulWidget {
  const ShellView({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  ConsumerState<ShellView> createState() => _ShellViewState();
}

class _ShellViewState extends ConsumerState<ShellView> {
  @override
  void initState() {
    super.initState();
    unawaited(_verify());
  }

  Future<void> _verify() async {
    try {
      final user = await AuthService.instance.loadProfile();
      if (!user.canUseDevApp) await AuthService.instance.signOut();
    } catch (_) {
      // Offline or the server is busy: keep what is stored, the first real call will say.
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final unread = ref.watch(unreadChatsProvider);

    return Scaffold(
      body: widget.shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: widget.shell.currentIndex,
        onDestinationSelected: (index) => widget.shell.goBranch(index, initialLocation: index == widget.shell.currentIndex),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.bolt_outlined),
            selectedIcon: const Icon(Icons.bolt),
            label: text.tabLive,
          ),
          NavigationDestination(
            icon: Badge(isLabelVisible: unread > 0, label: Text('$unread'), child: const Icon(Icons.chat_bubble_outline)),
            selectedIcon: Badge(isLabelVisible: unread > 0, label: Text('$unread'), child: const Icon(Icons.chat_bubble)),
            label: text.tabChats,
          ),
          NavigationDestination(
            icon: const Icon(Icons.confirmation_number_outlined),
            selectedIcon: const Icon(Icons.confirmation_number),
            label: text.tabTickets,
          ),
          NavigationDestination(
            icon: const Icon(Icons.settings_outlined),
            selectedIcon: const Icon(Icons.settings),
            label: text.tabSettings,
          ),
        ],
      ),
    );
  }
}
