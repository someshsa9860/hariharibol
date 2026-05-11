import 'package:flutter/material.dart';
import '../../../chatbot/presentation/pages/chatbot_page.dart';
import '../../../chanting/presentation/pages/chanting_page.dart';
import '../../../home/presentation/pages/home_page.dart';
import '../../../reading/presentation/pages/reading_page.dart';

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
    ChatbotPage(),
    ChantingPage(),
    ReadingPage(),
  ];

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
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
class _BottomNav extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;

  const _BottomNav({required this.currentIndex, required this.onTap});

  static const _tabs = [
    _TabItem(icon: '🏠', label: 'Home'),
    _TabItem(icon: '💬', label: 'GuruDev'),
    _TabItem(icon: '📿', label: 'Chanting'),
    _TabItem(icon: '📖', label: 'Read'),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 12,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: List.generate(
              _tabs.length,
              (i) => _NavButton(
                tab: _tabs[i],
                isSelected: i == currentIndex,
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
  final String icon;
  final String label;
  const _TabItem({required this.icon, required this.label});
}

class _NavButton extends StatelessWidget {
  final _TabItem tab;
  final bool isSelected;
  final VoidCallback onTap;

  const _NavButton({
    required this.tab,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: isSelected
            ? BoxDecoration(
                color: _saffron.withOpacity(0.1),
                borderRadius: BorderRadius.circular(16),
              )
            : null,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(tab.icon, style: const TextStyle(fontSize: 22)),
            const SizedBox(height: 2),
            AnimatedDefaultTextStyle(
              duration: const Duration(milliseconds: 200),
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
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
