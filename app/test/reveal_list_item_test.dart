import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/widgets/library/reveal_list_item.dart';

/// A reading screen's shape: a header, [verses] verses of very different
/// heights (a short one, a long purport), a footer — built lazily, one
/// `GlobalKey` per verse, the way `ChapterReadView` does.
class _Chapter extends StatelessWidget {
  const _Chapter({required this.keys, required this.verses});

  final Map<int, GlobalKey> keys;
  final int verses;

  static double heightOf(int verse) => 180.0 + (verse % 7) * 230;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: ListView.separated(
          itemCount: verses + 2,
          separatorBuilder: (context, index) => const Divider(height: 1),
          itemBuilder: (context, index) {
            if (index == 0) return const SizedBox(height: 120, child: Text('header'));
            if (index == verses + 1) return const SizedBox(height: 120, child: Text('footer'));
            final verse = index;
            return KeyedSubtree(
              key: keys.putIfAbsent(verse, () => GlobalKey()),
              child: SizedBox(height: heightOf(verse), child: Text('verse $verse')),
            );
          },
        ),
      ),
    );
  }
}

void main() {
  const verses = 120;

  Future<(bool?, Map<int, GlobalKey>)> reveal(WidgetTester tester, int verse) async {
    final keys = <int, GlobalKey>{};
    await tester.pumpWidget(_Chapter(keys: keys, verses: verses));

    bool? arrived;
    revealListItem(
      index: verse,
      itemCount: verses + 2,
      contextAt: (item) => item < 1 || item > verses ? null : keys[item]?.currentContext,
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOut,
      alignment: 0.1,
    ).then((value) => arrived = value);

    // Each step waits for a frame; give it plenty, then let the last scroll finish.
    for (var i = 0; i < 80 && arrived == null; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
    await tester.pumpAndSettle();
    return (arrived, keys);
  }

  double topOf(WidgetTester tester, GlobalKey key) =>
      tester.getTopLeft(find.byKey(key)).dy;

  testWidgets('a verse far down, which the list has not built, is brought into view', (tester) async {
    // The case the old one-shot scroll missed: nothing to scroll to yet.
    final keys = <int, GlobalKey>{};
    await tester.pumpWidget(_Chapter(keys: keys, verses: verses));
    expect(keys[90]?.currentContext, isNull);

    final (arrived, after) = await reveal(tester, 90);

    expect(arrived, isTrue);
    expect(find.text('verse 90'), findsOneWidget);
    final top = topOf(tester, after[90]!);
    expect(top, greaterThanOrEqualTo(0));
    expect(top, lessThan(tester.view.physicalSize.height / tester.view.devicePixelRatio));
  });

  testWidgets('a verse taller than the screen starts at the top, not above it', (tester) async {
    // Verse 90 is 1560 tall in a 600 viewport; centring it would cut its first lines off.
    expect(_Chapter.heightOf(90), greaterThan(600));
    final (arrived, keys) = await reveal(tester, 90);

    expect(arrived, isTrue);
    expect(topOf(tester, keys[90]!), closeTo(0, 1));
  });

  testWidgets('a short verse ends up wholly on the screen', (tester) async {
    // Verse 91 is 180 tall.
    expect(_Chapter.heightOf(91), lessThan(300));
    final (arrived, keys) = await reveal(tester, 91);

    expect(arrived, isTrue);
    final top = topOf(tester, keys[91]!);
    expect(top, greaterThanOrEqualTo(0));
    expect(top + _Chapter.heightOf(91), lessThanOrEqualTo(600));
  });

  testWidgets('a verse on the first screen is simply scrolled to', (tester) async {
    final (arrived, keys) = await reveal(tester, 2);
    expect(arrived, isTrue);
    expect(keys[2]?.currentContext, isNotNull);
  });

  testWidgets('the last verse, at the end of the list, is reached', (tester) async {
    final (arrived, _) = await reveal(tester, verses);
    expect(arrived, isTrue);
    expect(find.text('verse $verses'), findsOneWidget);
  });

  testWidgets('a verse in the middle is reached from a list already scrolled past it', (tester) async {
    final keys = <int, GlobalKey>{};
    await tester.pumpWidget(_Chapter(keys: keys, verses: verses));
    // Reader is at the bottom already; the verse is back up the page.
    await tester.drag(find.byType(ListView), const Offset(0, -200000));
    await tester.pumpAndSettle();
    expect(keys[30]?.currentContext, isNull);

    bool? arrived;
    revealListItem(
      index: 30,
      itemCount: verses + 2,
      contextAt: (item) => item < 1 || item > verses ? null : keys[item]?.currentContext,
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOut,
      alignment: 0.1,
    ).then((value) => arrived = value);
    for (var i = 0; i < 80 && arrived == null; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
    await tester.pumpAndSettle();

    expect(arrived, isTrue);
    expect(find.text('verse 30'), findsOneWidget);
  });

  testWidgets('an item that is not in the list ends the search instead of scrolling forever', (tester) async {
    final keys = <int, GlobalKey>{};
    await tester.pumpWidget(_Chapter(keys: keys, verses: verses));

    bool? arrived;
    revealListItem(
      index: verses + 50,
      itemCount: verses + 2,
      contextAt: (item) => item < 1 || item > verses ? null : keys[item]?.currentContext,
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOut,
      alignment: 0.1,
    ).then((value) => arrived = value);
    for (var i = 0; i < 120 && arrived == null; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }

    expect(arrived, isFalse);
  });
}
