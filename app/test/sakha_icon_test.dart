// Sakha's icon, drawn from assets/sakha_icon.svg.
//
// The file is meant to be replaced by the real artwork, so this asks only what
// must stay true of any file put there: it is in the bundle, it parses, it
// paints something, and it adds no label of its own. A path slip or an SVG
// feature the renderer cannot draw is an empty button, not an error.

import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/constants/app_assets.dart';
import 'package:hariharibol/widgets/common/sakha_icon.dart';

const double side = 128;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('the icon is in the bundle', (tester) async {
    final bytes = await tester.runAsync(() => rootBundle.load(AppAssets.sakhaIcon));

    expect(bytes!.lengthInBytes, greaterThan(0));
  });

  testWidgets('it paints something, the same in both themes, and carries no label', (tester) async {
    Future<List<int>> draw(ThemeData theme) async {
      final key = UniqueKey();
      await tester.pumpWidget(
        MaterialApp(
          theme: theme,
          home: Scaffold(
            body: Align(
              alignment: Alignment.topLeft,
              child: RepaintBoundary(key: key, child: const SakhaIcon(size: side)),
            ),
          ),
        ),
      );
      // The SVG is read and parsed asynchronously; give it real time, then a frame.
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 500)));
      await tester.pump();
      expect(tester.takeException(), isNull);

      final boundary = tester.renderObject<RenderRepaintBoundary>(find.byKey(key));
      final image = (await tester.runAsync(() => boundary.toImage()))!;
      final data = (await tester.runAsync(() => image.toByteData(format: ui.ImageByteFormat.rawRgba)))!;
      return data.buffer.asUint8List().toList();
    }

    final light = await draw(ThemeData.light());
    final dark = await draw(ThemeData.dark());

    bool paints(List<int> rgba) {
      for (var i = 3; i < rgba.length; i += 4) {
        if (rgba[i] > 0) return true;
      }
      return false;
    }

    expect(paints(light), isTrue, reason: 'nothing was drawn from ${AppAssets.sakhaIcon}');
    // Drawn in its own colours, not the theme's.
    expect(dark, light);
    expect(find.descendant(of: find.byType(SakhaIcon), matching: find.byType(ExcludeSemantics)), findsOneWidget);
  });
}
