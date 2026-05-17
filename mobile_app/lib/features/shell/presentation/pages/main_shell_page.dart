import 'package:flutter/material.dart';
import '../../../chatbot/presentation/pages/chatbot_page.dart';
import '../../../chanting/presentation/pages/chanting_page.dart';
import '../../../home/presentation/pages/home_page.dart';
import '../../../reading/presentation/pages/reading_page.dart';
import '../../../sampradayas/presentation/pages/sampradayas_page.dart';
import '../../../groups/presentation/pages/groups_page.dart';

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
    _CommunityPage(),
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

// ─── Community Page (shell-embedded) ─────────────────────────────────────────
// Uses a top segmented switcher; each child is a full scrollable page.
class _CommunityPage extends StatefulWidget {
  const _CommunityPage();

  @override
  State<_CommunityPage> createState() => _CommunityPageState();
}

class _CommunityPageState extends State<_CommunityPage>
    with SingleTickerProviderStateMixin {
  late TabController _tab;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Segmented tab switcher at the top (no AppBar)
        SafeArea(
          bottom: false,
          child: Container(
            color: Colors.white,
            padding:
                const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: TabBar(
              controller: _tab,
              indicator: BoxDecoration(
                color: const Color(0xFF006B6B),
                borderRadius: BorderRadius.circular(8),
              ),
              indicatorSize: TabBarIndicatorSize.tab,
              labelColor: Colors.white,
              unselectedLabelColor: const Color(0xFF8B7D73),
              labelStyle: const TextStyle(
                  fontWeight: FontWeight.bold, fontSize: 14),
              tabs: const [
                Tab(text: '🕉️  Traditions'),
                Tab(text: '🏛️  Groups'),
              ],
            ),
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: _tab,
            children: const [
              SampradayasPage(),
              GroupsPage(),
            ],
          ),
        ),
      ],
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
    _TabItem(icon: '🕉️', label: 'Community'),
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
          padding:
              const EdgeInsets.symmetric(horizontal: 2, vertical: 6),
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
            const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: isSelected
            ? BoxDecoration(
                color: _saffron.withOpacity(0.1),
                borderRadius: BorderRadius.circular(16),
              )
            : null,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(tab.icon, style: const TextStyle(fontSize: 20)),
            const SizedBox(height: 2),
            AnimatedDefaultTextStyle(
              duration: const Duration(milliseconds: 200),
              style: TextStyle(
                fontSize: 10,
                fontWeight: isSelected
                    ? FontWeight.bold
                    : FontWeight.normal,
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
