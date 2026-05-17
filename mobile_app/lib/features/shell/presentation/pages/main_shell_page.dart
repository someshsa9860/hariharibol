import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../chatbot/presentation/pages/chatbot_page.dart';
import '../../../chanting/presentation/pages/chanting_page.dart';
import '../../../home/presentation/pages/home_page.dart';
import '../../../reading/presentation/pages/reading_page.dart';
import '../../../profile/presentation/pages/profile_page.dart';
import '../../../notifications/presentation/providers/notifications_providers.dart';

const _saffron = Color(0xFFFF7E00);
const _textMid = Color(0xFF8B7D73);

class MainShellPage extends StatefulWidget {
  final int initialIndex;

  const MainShellPage({super.key, this.initialIndex = 0});

  @override
  State<MainShellPage> createState() => _MainShellPageState();
}

class _MainShellPageState extends State<MainShellPage> {
  late int _currentIndex;

  final List<Widget> _pages = const [
    HomePage(),
    ReadingPage(),   // Books
    ChantingPage(),  // Chant
    ChatbotPage(),   // GuruDev
    ProfilePage(),   // Profile
  ];

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex.clamp(0, 4);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _pages,
      ),
      bottomNavigationBar: _BottomNav(
        currentIndex: _currentIndex,
        onTap: (i) => setState(() => _currentIndex = i),
      ),
    );
  }
}

// ─── Bottom Navigation ────────────────────────────────────────────────────────

class _BottomNav extends ConsumerWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;

  const _BottomNav({required this.currentIndex, required this.onTap});

  static const _tabs = [
    _TabItem(icon: Icons.home_rounded, label: 'Home'),
    _TabItem(icon: Icons.menu_book_rounded, label: 'Books'),
    _TabItem(icon: Icons.self_improvement_rounded, label: 'Chant'),
    _TabItem(icon: Icons.auto_awesome_rounded, label: 'GuruDev'),
    _TabItem(icon: Icons.person_rounded, label: 'Profile'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unreadCount = ref.watch(unreadNotificationCountProvider);
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.10),
            blurRadius: 16,
            offset: const Offset(0, -3),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: List.generate(
              _tabs.length,
              (i) => _NavButton(
                tab: _tabs[i],
                isSelected: i == currentIndex,
                // Show unread badge count on the Profile tab (index 4)
                badgeCount: i == 4 ? unreadCount : 0,
                onTap: () => onTap(i),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _TabItem {
  final IconData icon;
  final String label;
  const _TabItem({required this.icon, required this.label});
}

class _NavButton extends StatelessWidget {
  final _TabItem tab;
  final bool isSelected;
  final int badgeCount;
  final VoidCallback onTap;

  const _NavButton({
    required this.tab,
    required this.isSelected,
    required this.onTap,
    this.badgeCount = 0,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: isSelected
            ? BoxDecoration(
                color: _saffron.withOpacity(0.12),
                borderRadius: BorderRadius.circular(20),
              )
            : null,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(
                  tab.icon,
                  size: 22,
                  color: isSelected ? _saffron : _textMid,
                ),
                if (badgeCount > 0)
                  Positioned(
                    top: -4,
                    right: -6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 4, vertical: 1),
                      decoration: BoxDecoration(
                        color: _saffron,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        badgeCount > 99 ? '99+' : '$badgeCount',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 3),
            AnimatedDefaultTextStyle(
              duration: const Duration(milliseconds: 200),
              style: TextStyle(
                fontSize: 10,
                fontWeight:
                    isSelected ? FontWeight.w700 : FontWeight.w400,
                color: isSelected ? _saffron : _textMid,
              ),
              child: Text(tab.label),
            ),
          ],
        ),
      ),
    );
  }
}
