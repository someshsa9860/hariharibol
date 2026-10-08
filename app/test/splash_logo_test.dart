// The logo the launch animation draws.
//
// Three things can be wrong here without anything failing until a build is
// installed: the picture is not in the bundle (a slip in the path or in
// pubspec.yaml is a blank splash and an empty sign-in header, not an error); a
// moment on the timeline cannot be drawn (each effect is worked out from the
// timeline's value, so a bad one throws only on the frame that reaches it); or
// the last frame is not the plain logo, which is the frame reduce-motion shows
// on its own.

import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/constants/app_assets.dart';
import 'package:hariharibol/widgets/splash/splash_logo.dart';

const double side = 300;

Widget frame(Widget logo, {Key? key}) => MaterialApp(
      home: Scaffold(
        body: Center(child: RepaintBoundary(key: key, child: logo)),
      ),
    );

/// The logo has to be decoded before it is drawn, or a test frame is taken of
/// an empty box.
Future<void> decodeLogo(WidgetTester tester) async {
  await tester.pumpWidget(frame(const SizedBox()));
  await tester.runAsync(() async {
    await precacheImage(const AssetImage(AppAssets.logo), tester.element(find.byType(SizedBox)));
  });
}

Future<Uint8List> pixelsOf(WidgetTester tester, Key key) async {
  final boundary = tester.renderObject<RenderRepaintBoundary>(find.byKey(key));
  return (await tester.runAsync(() async {
    final image = await boundary.toImage();
    final data = await image.toByteData(format: ui.ImageByteFormat.rawRgba);
    return data!.buffer.asUint8List();
  }))!;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('the logo is in the bundle', (tester) async {
    final bytes = await tester.runAsync(() => rootBundle.load(AppAssets.logo));

    expect(bytes!.lengthInBytes, greaterThan(0));
  });

  testWidgets('every moment of the timeline can be drawn', (tester) async {
    await decodeLogo(tester);

    // Fine steps at the start, where the reveal's circle is smallest, then even
    // ones; both ends are the moments most likely to be a special case.
    final moments = [0.0, 0.0005, 0.001, 0.01, for (var i = 1; i <= 100; i++) i / 100];

    for (final t in moments) {
      await tester.pumpWidget(
        frame(SplashLogo(progress: AlwaysStoppedAnimation(t), width: side)),
      );

      expect(tester.takeException(), isNull, reason: 'at $t of the timeline');
    }
  });

  testWidgets('the last frame is the logo and nothing else', (tester) async {
    await decodeLogo(tester);

    final finished = UniqueKey();
    await tester.pumpWidget(
      frame(const SplashLogo(progress: AlwaysStoppedAnimation(1), width: side), key: finished),
    );
    final drawn = await pixelsOf(tester, finished);

    final plain = UniqueKey();
    await tester.pumpWidget(
      frame(
        Image.asset(
          AppAssets.logo,
          width: side,
          height: side,
          fit: BoxFit.contain,
          filterQuality: FilterQuality.high,
        ),
        key: plain,
      ),
    );
    final asset = await pixelsOf(tester, plain);

    expect(drawn.length, asset.length);

    // A blank frame would match a blank frame, so be sure there is a picture
    // first: the logo fills nearly half of its square.
    var inked = 0;
    for (var i = 3; i < asset.length; i += 4) {
      if (asset[i] > 0) inked++;
    }
    expect(inked, greaterThan(asset.length ~/ 4 ~/ 10));

    // One step of rounding in a channel is the cost of drawing through a layer;
    // anything more is something left on the picture.
    var worst = 0;
    for (var i = 0; i < drawn.length; i++) {
      final off = (drawn[i] - asset[i]).abs();
      if (off > worst) worst = off;
    }
    expect(worst, lessThanOrEqualTo(1));
  });
}
