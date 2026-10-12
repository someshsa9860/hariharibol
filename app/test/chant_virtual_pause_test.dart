import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/constants/auto_chant_config.dart';
import 'package:hariharibol/services/chant_virtual_pause.dart';

const _rate = AutoChantConfig.sampleRate;

/// A chant stand-in: a steady tone that goes nearly silent for [gapMs] at the end
/// of every [toneMs] of it. [gapMs] of 0 is a chant with no pause in it at all.
Float32List _chant({
  required int seconds,
  int toneMs = 900,
  int gapMs = 150,
  double loudness = 0.3,
}) {
  final samples = Float32List(seconds * _rate);
  final period = (toneMs + gapMs) * _rate ~/ 1000;
  final tone = toneMs * _rate ~/ 1000;
  for (var i = 0; i < samples.length; i++) {
    final sounding = gapMs == 0 || i % period < tone;
    samples[i] = math.sin(2 * math.pi * 200 * i / _rate) * loudness * (sounding ? 1 : 0.03);
  }
  return samples;
}

/// Feeds [audio] in pieces of [chunkSamples] and says when, in milliseconds into
/// it, each cut came and why.
List<(int, VirtualPauseCut)> _cuts(VirtualPause pause, Float32List audio, {int chunkSamples = 1600}) {
  final cuts = <(int, VirtualPauseCut)>[];
  for (var at = 0; at < audio.length; at += chunkSamples) {
    final end = math.min(at + chunkSamples, audio.length);
    final cut = pause.add(Float32List.sublistView(audio, at, end));
    if (cut != null) cuts.add((end * 1000 ~/ _rate, cut));
  }
  return cuts;
}

void main() {
  group('VirtualPause', () {
    test('cuts at the first dip once a repetition\'s worth of voice has gone by', () {
      // Standard 3 s: from 2.4 s. Dips fall at 0.9, 1.95, 3.0 s … — only the third counts.
      final cuts = _cuts(VirtualPause(3000), _chant(seconds: 4));
      expect(cuts, hasLength(1));
      expect(cuts.single.$2, VirtualPauseCut.dip);
      expect(cuts.single.$1, inInclusiveRange(3000, 3300));
    });

    test('a dip before that is not a pause', () {
      final cuts = _cuts(VirtualPause(3000), _chant(seconds: 2));
      expect(cuts, isEmpty, reason: 'the dips at 0.9 s and 1.95 s are earlier than 80% of 3 s');
    });

    test('a chant with no dip at all is cut at 1.4 times the standard time', () {
      final cuts = _cuts(VirtualPause(3000), _chant(seconds: 9, gapMs: 0));
      expect(cuts.map((c) => c.$2), everyElement(VirtualPauseCut.limit));
      expect(cuts.map((c) => c.$1), [4200, 8400], reason: 'and it starts over after each');
    });

    test('keeps cutting, one repetition at a time, for as long as the chant goes on', () {
      final cuts = _cuts(VirtualPause(3000), _chant(seconds: 30));
      expect(cuts.length, inInclusiveRange(7, 10));
      for (var i = 1; i < cuts.length; i++) {
        final gap = cuts[i].$1 - cuts[i - 1].$1;
        expect(gap, inInclusiveRange(2400, 4200), reason: 'cut $i came $gap ms after the one before');
      }
    });

    test('a quiet voice dips against itself, not against a fixed level', () {
      final cuts = _cuts(VirtualPause(3000), _chant(seconds: 4, loudness: 0.02));
      expect(cuts.single.$2, VirtualPauseCut.dip);
    });

    test('chunks smaller than a frame are measured the same', () {
      final cuts = _cuts(VirtualPause(3000), _chant(seconds: 4), chunkSamples: 130);
      expect(cuts.single.$2, VirtualPauseCut.dip);
      expect(cuts.single.$1, inInclusiveRange(3000, 3300));
    });

    test('a very short mantra is not cut every second', () {
      final pause = VirtualPause(400);
      expect(pause.from.inMilliseconds, (AutoChantConfig.virtualPauseMinSeconds * 1000 * AutoChantConfig.virtualPauseFrom).round());
      expect(_cuts(pause, _chant(seconds: 1, gapMs: 0)), isEmpty);
    });

    test('reset starts a stretch afresh', () {
      final pause = VirtualPause(3000);
      expect(_cuts(pause, _chant(seconds: 5, gapMs: 0)), isNotEmpty);
      pause.reset();
      expect(_cuts(pause, _chant(seconds: 5, gapMs: 0)), hasLength(1), reason: 'it did not carry the first stretch over');
    });
  });
}
