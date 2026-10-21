// The bar and the raised button in its middle.
//
// What is held here: Sakha's button stands between the second and third
// destinations and opens something rather than selecting a tab; the labels
// still read in order for a screen reader; the bar turns dark over a video and
// back; and the button's ring breathes a few times and then rests (and never
// moves at all when the phone asks for less motion).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/theme/app_colors.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/widgets/common/glass_nav_bar.dart';
import 'package:hariharibol/widgets/common/nav_hero_button.dart';

const _items = [
  NavItem(icon: Icons.home_outlined, selectedIcon: Icons.home_rounded, label: 'Home'),
  NavItem(icon: Icons.self_improvement_outlined, selectedIcon: Icons.self_improvement_rounded, label: 'Jap'),
  NavItem(icon: Icons.menu_book_outlined, selectedIcon: Icons.menu_book_rounded, label: 'Read'),
  NavItem(icon: Icons.play_circle_outline_rounded, selectedIcon: Icons.play_circle_rounded, label: 'Reels'),
];

Widget _bar({
  int selected = 0,
  ValueChanged<int>? onSelected,
  VoidCallback? onHero,
  bool onMedia = false,
  bool withHero = true,
  bool reduceMotion = false,
  ThemeData? theme,
}) {
  return MaterialApp(
    theme: theme ?? AppTheme.light,
    home: MediaQuery(
      data: MediaQueryData(size: const Size(800, 600), disableAnimations: reduceMotion),
      child: Scaffold(
        body: Stack(
          children: [
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: GlassNavBar(
                items: _items,
                selectedIndex: selected,
                onSelected: onSelected ?? (_) {},
                onMedia: onMedia,
                hero: withHero
                    ? NavHero(
                        iconBuilder: (size) => SizedBox.square(dimension: size, key: const Key('icon')),
                        label: 'Sakha',
                        semanticLabel: 'Ask Sakha',
                        onTap: onHero ?? () {},
                      )
                    : null,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

void main() {
  testWidgets('Sakha stands between the second and third destinations', (tester) async {
    await tester.pumpWidget(_bar());

    final jap = tester.getCenter(find.text('Jap')).dx;
    final reels = tester.getCenter(find.text('Reels')).dx;
    final hero = tester.getCenter(find.byType(NavHeroButton)).dx;
    expect(hero, greaterThan(jap));
    expect(hero, lessThan(reels));
    // In the middle of the screen, not just somewhere between.
    expect(hero, closeTo(tester.getSize(find.byType(Scaffold)).width / 2, 1));

    // Standing above the pill: its top is higher than the labels' row.
    expect(tester.getTopLeft(find.byType(NavHeroButton)).dy, lessThan(tester.getTopLeft(find.text('Home')).dy));
    expect(find.text('Sakha'), findsOneWidget);
  });

  testWidgets('tapping the button calls it and selects no destination', (tester) async {
    var opened = 0;
    final picked = <int>[];
    await tester.pumpWidget(_bar(onHero: () => opened++, onSelected: picked.add));

    await tester.tap(find.byType(NavHeroButton));
    await tester.pump(const Duration(milliseconds: 300));
    expect(opened, 1);
    expect(picked, isEmpty);

    await tester.tap(find.text('Reels'));
    await tester.tap(find.text('Home'));
    expect(picked, [2, 0]);
  });

  testWidgets('the part of the bar above the pill passes taps through', (tester) async {
    var opened = 0;
    await tester.pumpWidget(_bar(onHero: () => opened++));

    // Beside the button, in the lift above the pill.
    final pill = tester.getTopLeft(find.text('Home'));
    await tester.tapAt(Offset(40, pill.dy - 30));
    expect(opened, 0);
  });

  testWidgets('a screen reader meets the button once, by its full name', (tester) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(_bar());

    expect(find.bySemanticsLabel('Ask Sakha'), findsOneWidget);
    // The short word under it is for the eye; reading it too would say it twice.
    expect(find.bySemanticsLabel('Sakha'), findsNothing);
    expect(find.bySemanticsLabel('Home'), findsOneWidget);
    handle.dispose();
  });

  testWidgets('the bar is the same without the button', (tester) async {
    await tester.pumpWidget(_bar(withHero: false));
    expect(find.byType(NavHeroButton), findsNothing);
    expect(find.text('Sakha'), findsNothing);
    expect(find.text('Read'), findsOneWidget);
  });

  testWidgets('it counts the lift in the height the tabs are padded by', (tester) async {
    late double height;
    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(viewPadding: EdgeInsets.only(bottom: 34)),
          child: Builder(
            builder: (context) {
              height = GlassNavBar.heightOf(context);
              return const SizedBox();
            },
          ),
        ),
      ),
    );
    expect(height, GlassNavBar.lift + GlassNavBar.contentHeight + 34 + 16);
  });

  group('over a video', () {
    Color labelColour(WidgetTester tester, String label) =>
        tester.widget<AnimatedDefaultTextStyle>(
          find.ancestor(of: find.text(label), matching: find.byType(AnimatedDefaultTextStyle)).first,
        ).style.color!;

    testWidgets('the ink turns white, in either theme, and comes back', (tester) async {
      for (final theme in [AppTheme.light, AppTheme.dark]) {
        await tester.pumpWidget(_bar(selected: 2, onMedia: true, theme: theme));
        await tester.pumpAndSettle();
        expect(labelColour(tester, 'Reels'), AppColors.reelInk);
        // Not selected: white too, only quieter.
        expect(labelColour(tester, 'Home').a, lessThan(1));
        expect(labelColour(tester, 'Home').r, closeTo(1, 0.01));
      }

      await tester.pumpWidget(_bar(selected: 2, onMedia: false));
      await tester.pumpAndSettle();
      expect(labelColour(tester, 'Reels'), isNot(AppColors.reelInk));
    });

    testWidgets('the change is eased, not snapped', (tester) async {
      await tester.pumpWidget(_bar(selected: 2));
      await tester.pumpWidget(_bar(selected: 2, onMedia: true));
      await tester.pump(const Duration(milliseconds: 100));
      final halfway = tester.widget<AnimatedDefaultTextStyle>(
        find.ancestor(of: find.text('Reels'), matching: find.byType(AnimatedDefaultTextStyle)).first,
      ).style.color!;
      expect(halfway, isNot(AppColors.reelInk));
      await tester.pumpAndSettle();
    });
  });

  group('the breathing ring', () {
    testWidgets('breathes a few times, then rests', (tester) async {
      await tester.pumpWidget(_bar());
      // Settling would never return if it went on for ever.
      await tester.pumpAndSettle(const Duration(milliseconds: 100), EnginePhase.sendSemanticsUpdate, const Duration(seconds: 30));
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('never moves with reduced motion', (tester) async {
      await tester.pumpWidget(_bar(reduceMotion: true));
      await tester.pump();
      expect(tester.hasRunningAnimations, isFalse);
    });
  });
}
