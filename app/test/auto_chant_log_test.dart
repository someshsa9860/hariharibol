import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/services/auto_chant_log.dart';

void main() {
  group('AudioMeter', () {
    test('a stretch with no audio reads as nothing, not as an error', () {
      final heard = AudioMeter().take();
      expect(heard.chunks, 0);
      expect(heard.rms, 0);
      expect(heard.peak, 0);
    });

    test('reports chunks, loudest sample and average level', () {
      final meter = AudioMeter()
        ..add(Float32List.fromList([0.5, -0.5, 0.5, -0.5]))
        ..add(Float32List.fromList([0.0, 0.0, -1.0, 0.0]));
      final heard = meter.take();
      expect(heard.chunks, 2);
      expect(heard.peak, 1.0);
      // 4 × 0.25 + 1.0 = 2.0 over 8 samples.
      expect(heard.rms, closeTo(0.5, 1e-9));
    });

    test('taking starts the next stretch from nothing', () {
      final meter = AudioMeter()..add(Float32List.fromList([0.9]));
      meter.take();
      final next = meter.take();
      expect(next.chunks, 0);
      expect(next.peak, 0);
    });
  });
}
