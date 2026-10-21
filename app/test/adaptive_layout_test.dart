import 'dart:ui' show DisplayFeature, DisplayFeatureState, DisplayFeatureType;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/layout/adaptive.dart';
import 'package:hariharibol/widgets/common/glass_nav_bar.dart';
import 'package:hariharibol/widgets/common/side_nav.dart';

Widget _host(Size size, Widget child, {List<DisplayFeature> features = const []}) {
  return MediaQuery(
    data: MediaQueryData(size: size, displayFeatures: features),
    child: MaterialApp(home: Scaffold(body: child)),
  );
}

/// The test window is made the size the host claims, so layout and `MediaQuery` agree.
Future<void> _pump(WidgetTester tester, Widget host) async {
  final size = (host as MediaQuery).data.size;
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(host);
}

void main() {
  group('WindowSize', () {
    test('follows the Material width classes', () {
      expect(WindowSize.of(360), WindowSize.compact);
      expect(WindowSize.of(599), WindowSize.compact);
      expect(WindowSize.of(600), WindowSize.medium);
      expect(WindowSize.of(839), WindowSize.medium);
      expect(WindowSize.of(840), WindowSize.expanded);
      expect(WindowSize.of(1199), WindowSize.expanded);
      expect(WindowSize.of(1200), WindowSize.large);
    });
  });

  group('AdaptiveLayout', () {
    testWidgets('finds a vertical hinge and a half-open posture', (tester) async {
      late AdaptiveLayout layout;
      await _pump(
        tester,
        _host(
          const Size(800, 600),
          Builder(
            builder: (context) {
              layout = AdaptiveLayout.of(context);
              return const SizedBox();
            },
          ),
          features: const [
            DisplayFeature(
              bounds: Rect.fromLTWH(390, 0, 20, 600),
              type: DisplayFeatureType.hinge,
              state: DisplayFeatureState.postureHalfOpened,
            ),
          ],
        ),
      );
      expect(layout.hasVerticalHinge, isTrue);
      expect(layout.halfOpen, isTrue);
      expect(layout.size, WindowSize.medium);
    });

    testWidgets('has no hinge on an ordinary screen', (tester) async {
      late AdaptiveLayout layout;
      await _pump(
        tester,
        _host(
          const Size(400, 800),
          Builder(
            builder: (context) {
              layout = AdaptiveLayout.of(context);
              return const SizedBox();
            },
          ),
        ),
      );
      expect(layout.hinge, isNull);
      expect(layout.size, WindowSize.compact);
    });
  });

  group('ContentWidth', () {
    testWidgets('holds a wide window to its maximum', (tester) async {
      await _pump(
        tester,
        _host(const Size(1600, 900), const ContentWidth(maxWidth: 700, child: SizedBox.expand(key: Key('c')))),
      );
      expect(tester.getSize(find.byKey(const Key('c'))).width, 700);
    });

    testWidgets('leaves a phone alone', (tester) async {
      await _pump(
        tester,
        _host(const Size(400, 800), const ContentWidth(maxWidth: 700, child: SizedBox.expand(key: Key('c')))),
      );
      expect(tester.getSize(find.byKey(const Key('c'))).width, 400);
    });
  });

  group('TwoPane', () {
    testWidgets('puts the panes either side of a hinge', (tester) async {
      await _pump(
        tester,
        _host(
          const Size(800, 600),
          const TwoPane(
            first: SizedBox.expand(key: Key('a')),
            second: SizedBox.expand(key: Key('b')),
          ),
          features: const [
            DisplayFeature(
              bounds: Rect.fromLTWH(390, 0, 20, 600),
              type: DisplayFeatureType.hinge,
              state: DisplayFeatureState.postureFlat,
            ),
          ],
        ),
      );
      expect(tester.getRect(find.byKey(const Key('a'))).right, 390);
      expect(tester.getRect(find.byKey(const Key('b'))).left, 410);
    });

    testWidgets('splits by ratio without one', (tester) async {
      await _pump(
        tester,
        _host(
          const Size(1000, 600),
          const TwoPane(
            first: SizedBox.expand(key: Key('a')),
            second: SizedBox.expand(key: Key('b')),
            firstFlex: 1,
            secondFlex: 1,
            gap: 0,
            divider: false,
          ),
        ),
      );
      expect(tester.getSize(find.byKey(const Key('a'))).width, 500);
    });
  });

  group('SideNav', () {
    testWidgets('selects a destination with a tap and shows labels when extended', (tester) async {
      var picked = -1;
      await _pump(
        tester,
        _host(
          const Size(1200, 800),
          SideNav(
            extended: true,
            selectedIndex: 0,
            onSelected: (i) => picked = i,
            items: const [
              NavItem(icon: Icons.home_outlined, selectedIcon: Icons.home, label: 'Home'),
              NavItem(icon: Icons.book_outlined, selectedIcon: Icons.book, label: 'Read'),
            ],
          ),
        ),
      );
      expect(find.text('Read'), findsOneWidget);
      await tester.tap(find.text('Read'));
      expect(picked, 1);
    });

    testWidgets('walks with the arrow keys and opens with select, as a remote does', (tester) async {
      var picked = -1;
      await _pump(
        tester,
        _host(
          const Size(1200, 800),
          SideNav(
            extended: false,
            selectedIndex: 0,
            onSelected: (i) => picked = i,
            items: const [
              NavItem(icon: Icons.home_outlined, selectedIcon: Icons.home, label: 'Home'),
              NavItem(icon: Icons.book_outlined, selectedIcon: Icons.book, label: 'Read'),
            ],
          ),
        ),
      );
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.select);
      await tester.pump();
      expect(picked, 1);
    });
  });
}
