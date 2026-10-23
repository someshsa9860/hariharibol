// How long one chant of a mantra is taken to last, and the shortest wait
// between two hand taps that follows from a pace.

import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/models/mantra.dart';
import 'package:hariharibol/services/mantra_auto_chant_session.dart';

Mantra mantra({int durationMs = 0, String text = 'Om', String? transliteration}) => Mantra(
      id: 'm',
      slug: 'm',
      name: 'M',
      text: text,
      textLanguage: 'en',
      transliteration: transliteration,
      durationMs: durationMs,
    );

void main() {
  test('the time set for a mantra on the admin panel is the time used', () {
    expect(MantraAutoChantSession.standardChantMsOf(mantra(durationMs: 4000)), 4000);
  });

  test('a mantra with no time set is taken to last 0.1 s a letter, never under a second', () {
    // 14 letters once spaces are left out.
    expect(MantraAutoChantSession.standardChantMsOf(mantra(text: 'Om Namah Shivaya')), 1400);
    expect(MantraAutoChantSession.standardChantMsOf(mantra(text: 'Om')), 1000);
  });

  test('the transliteration is measured in preference to the script', () {
    final m = mantra(text: 'ॐ नमः शिवाय', transliteration: 'Om Namah Shivaya Om Namah Shivaya');
    expect(MantraAutoChantSession.standardChantMsOf(m), 2800);
  });

  test('a hand tap has to wait half of one chant, at the reader\'s pace, after the last', () {
    expect(MantraAutoChantSession.manualTapGapOf(const Duration(seconds: 4)), const Duration(seconds: 2));
    expect(MantraAutoChantSession.manualTapGapOf(const Duration(seconds: 1)), const Duration(milliseconds: 500));
    // A reader who chants slower waits longer.
    expect(MantraAutoChantSession.manualTapGapOf(const Duration(milliseconds: 6000)), const Duration(seconds: 3));
  });
}
