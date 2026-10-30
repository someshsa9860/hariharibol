// The reading page's layout choices, and the night look's hours.

import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/theme/reading_themes.dart';

void main() {
  group('effectiveReadingLook', () {
    test('the chosen look stands when the night switch is off', () {
      final late = DateTime(2026, 10, 30, 23);
      expect(
        effectiveReadingLook(chosen: ReadingLook.sepia, autoNight: false, now: late),
        ReadingLook.sepia,
      );
    });

    test('the night look replaces the choice from 8 pm until 6 am', () {
      ReadingLook at(int hour, int minute) => effectiveReadingLook(
            chosen: ReadingLook.sepia,
            autoNight: true,
            now: DateTime(2026, 10, 30, hour, minute),
          );

      expect(at(19, 59), ReadingLook.sepia);
      expect(at(20, 0), ReadingLook.night);
      expect(at(23, 30), ReadingLook.night);
      expect(at(0, 15), ReadingLook.night);
      expect(at(5, 59), ReadingLook.night);
      expect(at(6, 0), ReadingLook.sepia);
    });

    test('the night look also applies when the app theme is followed', () {
      expect(
        effectiveReadingLook(
          chosen: ReadingLook.matchApp,
          autoNight: true,
          now: DateTime(2026, 10, 30, 21),
        ),
        ReadingLook.night,
      );
    });
  });

  test('line spacing grows from compact to relaxed, comfortable is today', () {
    expect(ReadingLineSpacing.compact.scale, lessThan(ReadingLineSpacing.comfortable.scale));
    expect(ReadingLineSpacing.comfortable.scale, 1.0);
    expect(ReadingLineSpacing.relaxed.scale, greaterThan(ReadingLineSpacing.comfortable.scale));
  });

  test('margins grow from narrow to wide', () {
    expect(ReadingMargins.narrow.inset, lessThan(ReadingMargins.normal.inset));
    expect(ReadingMargins.normal.inset, lessThan(ReadingMargins.wide.inset));
  });
}
