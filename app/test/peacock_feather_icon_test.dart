// The peacock feather on the Reels button, drawn from assets/peacock_feather.svg.
//
// A slip in the path or in pubspec.yaml is an empty button, not an error, so
// this loads the real asset and looks at what is drawn: the eye's midnight
// centre where the artwork puts it, and nothing at a corner.

import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/constants/app_assets.dart';
import 'package:hariharibol/widgets/common/peacock_feather_icon.dart';

const double side = 256;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('the feather is in the bundle', (tester) async {
    final bytes = await tester.runAsync(() => rootBundle.load(AppAssets.peacockFeather));

    expect(bytes!.lengthInBytes, greaterThan(0));
  });

  testWidgets('it draws the eye where the artwork has it and carries no label', (tester) async {
    final key = UniqueKey();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Align(
            alignment: Alignment.topLeft,
            child: RepaintBoundary(key: key, child: const PeacockFeatherIcon(size: side)),
          ),
        ),
      ),
    );
    // The SVG is read and parsed asynchronously; give it real time, then a frame.
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 500)));
    await tester.pump();

    expect(tester.takeException(), isNull);
    expect(find.descendant(of: find.byType(PeacockFeatherIcon), matching: find.byType(ExcludeSemantics)), findsOneWidget);

    final boundary = tester.renderObject<RenderRepaintBoundary>(find.byKey(key));
    final image = (await tester.runAsync(() => boundary.toImage()))!;
    final data = (await tester.runAsync(() => image.toByteData(format: ui.ImageByteFormat.rawRgba)))!;

    // [x], [y] are fractions of the 512-unit artwork.
    List<int> at(double x, double y) {
      final i = ((y * side).floor() * image.width + (x * side).floor()) * 4;
      return [data.getUint8(i), data.getUint8(i + 1), data.getUint8(i + 2), data.getUint8(i + 3)];
    }

    // The eye's centre is #0A1240, the darkest ring; its highlight sits off to one side.
    expect(at(276 / 512, 190 / 512), [0x0A, 0x12, 0x40, 0xFF]);
    // The top-left corner of the artwork is empty.
    expect(at(0.01, 0.01)[3], 0);
  });
}
