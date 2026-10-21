// The soft ends of a row that slides under a layer (`IntroShapes.fadeEnds`), as
// the Ask Sakha picture's row of starter cards uses it.
//
// The edge of a layer rarely falls on a pixel, and the layer is cut to whole
// pixels around it. A fade drawn exactly over the layer only part covers the
// pixel its edge falls in, and a pixel only part covered keeps the rest of what
// the layer held there: a hairline of the row, un-faded, standing at each end of
// a row that is meant to dissolve. So the fade is drawn past the layer's edge,
// and what these tests hold is that the last pixel column of the layer goes
// the way of the ones inside it.

import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/theme/app_colors.dart';
import 'package:hariharibol/widgets/intro/intro_scene.dart';

/// A layer whose ends fall inside a pixel — 0.4 of the way across the first
/// column of pixels, 0.6 across the last — and whose height is whole, so only
/// the ends are in question. The picture it is drawn in is [width] × [height].
const Rect layer = Rect.fromLTRB(10.4, 6, 89.6, 26);
const int width = 100;
const int height = 32;

/// The columns the layer takes up once cut to whole pixels, and the share of
/// its width each end fades over.
const int firstColumn = 10;
const int lastColumn = 89;
const double share = 0.12;

/// The most alpha (0–255) the last column of the layer may keep, and how much a
/// column may differ from the one inside it before the fade is not even.
const int atMost = 13;
const int noise = 2;

/// The alpha of every pixel across the middle of [layer] once it is filled with
/// solid ink and closed, with its ends faded or not.
Future<List<int>> across(WidgetTester tester, {required bool faded}) async {
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  canvas.saveLayer(layer, Paint());
  // More than fills the layer, so every pixel of it holds ink to be faded.
  canvas.drawRect(layer.inflate(20), Paint()..color = AppColors.white);
  if (faded) IntroShapes.fadeEnds(canvas, layer, share, AppColors.white);
  canvas.restore();

  final picture = recorder.endRecording();
  final bytes = (await tester.runAsync(() async {
    final image = await picture.toImage(width, height);
    final data = await image.toByteData(format: ui.ImageByteFormat.rawRgba);
    image.dispose();
    return data!.buffer.asUint8List();
  }))!;
  picture.dispose();

  final row = height ~/ 2;
  return [for (var x = 0; x < width; x++) bytes[(row * width + x) * 4 + 3]];
}

void main() {
  testWidgets('the layer holds ink in every column it covers, to its last pixel', (tester) async {
    // What the tests below stand on: without a fade the layer is solid from its
    // first whole column to its last, so a column that is left with ink after
    // the fade was left by the fade.
    final solid = await across(tester, faded: false);

    expect(solid[firstColumn - 1], 0, reason: 'the layer starts at its first column');
    expect(solid[firstColumn], 255);
    expect(solid[lastColumn], 255);
    expect(solid[lastColumn + 1], 0, reason: 'and ends at its last');
  });

  testWidgets('the ends fade out to nothing, the last column included', (tester) async {
    final row = await across(tester, faded: true);

    expect(row[firstColumn], lessThanOrEqualTo(atMost), reason: 'no hairline at the start');
    expect(row[lastColumn], lessThanOrEqualTo(atMost), reason: 'no hairline at the end');
    expect(row[row.length ~/ 2], 255, reason: 'the middle of the row is left alone');
  });

  testWidgets('the row dissolves evenly: more of it with each column in from either end', (tester) async {
    final row = await across(tester, faded: true);
    final middle = row.length ~/ 2;

    for (var x = firstColumn; x < middle; x++) {
      expect(row[x], lessThanOrEqualTo(row[x + 1] + noise), reason: 'column $x has no more ink than the one inside it');
    }
    for (var x = lastColumn; x > middle; x--) {
      expect(row[x], lessThanOrEqualTo(row[x - 1] + noise), reason: 'column $x has no more ink than the one inside it');
    }
  });
}
