// How long one chant takes a reader: the range it is held to, the step the
// shorter / longer buttons take, what a finished round teaches, and the number
// kept on the phone for each mantra.

import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/constants/auto_chant_config.dart';
import 'package:hariharibol/services/chant_pace.dart';
import 'package:hariharibol/services/local_store.dart';

const Duration standard = Duration(seconds: 4);

Duration ms(int milliseconds) => Duration(milliseconds: milliseconds);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('the range', () {
    test('the floor is 45% of the standard time and the ceiling three times it', () {
      expect(ChantPace.clamp(ms(1), standard), ms(1800));
      expect(ChantPace.clamp(ms(100000), standard), ms(12000));
    });

    test('a pace inside the range is left alone', () {
      expect(ChantPace.clamp(ms(1800), standard), ms(1800));
      expect(ChantPace.clamp(ms(4000), standard), ms(4000));
      expect(ChantPace.clamp(ms(12000), standard), ms(12000));
    });

    test('the floor really is 45%, so half a standard time is never a chant', () {
      expect(AutoChantConfig.fastestShare, 0.45);
      expect(ChantPace.clamp(standard ~/ 2, standard), standard ~/ 2);
      expect(ChantPace.clamp(standard * 0.4, standard), standard * 0.45);
    });
  });

  group('the step', () {
    test('is 5% of the standard time', () {
      expect(ChantPace.step(standard), ms(200));
    });

    test('is never under the least step, so a very short mantra can still be changed', () {
      expect(ChantPace.step(ms(1000)), ms(AutoChantConfig.minPaceStepMs));
    });

    test('longer and shorter move by one step', () {
      expect(ChantPace.stepped(ms(4000), standard, longer: true), ms(4200));
      expect(ChantPace.stepped(ms(4000), standard, longer: false), ms(3800));
    });

    test('stops at the ends of the range', () {
      expect(ChantPace.stepped(ms(1800), standard, longer: false), ms(1800));
      expect(ChantPace.stepped(ms(12000), standard, longer: true), ms(12000));
      expect(ChantPace.canStep(ms(1800), standard, longer: false), isFalse);
      expect(ChantPace.canStep(ms(1800), standard, longer: true), isTrue);
      expect(ChantPace.canStep(ms(12000), standard, longer: true), isFalse);
      expect(ChantPace.canStep(ms(12000), standard, longer: false), isTrue);
    });

    test('a step that would pass the end lands on it', () {
      expect(ChantPace.stepped(ms(1900), standard, longer: false), ms(1800));
      expect(ChantPace.stepped(ms(11900), standard, longer: true), ms(12000));
    });
  });

  group('a finished round', () {
    test('teaches the time of one chant: six minutes over 108 is a little over three seconds', () {
      final taught = ChantPace.ofRound(
        roundTime: const Duration(minutes: 6) + const Duration(seconds: 3),
        prayer: const Duration(seconds: 3),
        chants: 108,
        standard: const Duration(seconds: 3),
      );
      // 360 s / 108 = 3333 ms.
      expect(taught!.inMilliseconds, closeTo(3333, 1));
    });

    test('takes the prayer off, so a reader keeping step with the count teaches no drift', () {
      final taught = ChantPace.ofRound(
        roundTime: ms(4 * 4000 + 7000),
        prayer: ms(7000),
        chants: 4,
        standard: standard,
      );
      expect(taught, standard);
    });

    test('is held to the range: a very quick round does not go under 45%', () {
      final taught = ChantPace.ofRound(
        roundTime: ms(4 * 500 + 3000),
        prayer: ms(3000),
        chants: 4,
        standard: standard,
      );
      expect(taught, ms(1800));
    });

    test('is held to the range: a very slow round does not go over three times', () {
      final taught = ChantPace.ofRound(
        roundTime: const Duration(minutes: 30),
        prayer: ms(3000),
        chants: 4,
        standard: standard,
      );
      expect(taught, ms(12000));
    });

    test('teaches nothing when there were no chants or no time between the taps', () {
      expect(
        ChantPace.ofRound(roundTime: ms(9000), prayer: ms(3000), chants: 0, standard: standard),
        isNull,
      );
      expect(
        ChantPace.ofRound(roundTime: ms(3000), prayer: ms(3000), chants: 4, standard: standard),
        isNull,
      );
      expect(
        ChantPace.ofRound(roundTime: ms(1000), prayer: ms(3000), chants: 4, standard: standard),
        isNull,
      );
    });
  });

  group('the number kept for a mantra, in memory', () {
    setUp(ChantPaceStore.keepInMemory);
    tearDown(ChantPaceStore.keepInStore);

    test('is the standard time until one is kept', () {
      expect(ChantPaceStore.read('maha', standard), standard);
    });

    test('is what was written, per mantra', () {
      ChantPaceStore.write('maha', ms(4600));
      ChantPaceStore.write('other', ms(2500));
      expect(ChantPaceStore.read('maha', standard), ms(4600));
      expect(ChantPaceStore.read('other', standard), ms(2500));
      expect(ChantPaceStore.read('third', standard), standard);
    });

    test('is held to the range when read, so a changed standard time cannot strand it', () {
      ChantPaceStore.write('maha', ms(4000));
      expect(ChantPaceStore.read('maha', ms(20000)), ms(9000)); // 45% of 20 s
      expect(ChantPaceStore.read('maha', ms(1000)), ms(3000)); // three times 1 s
    });

    test('a number that is not a time is ignored', () {
      ChantPaceStore.write('maha', Duration.zero);
      expect(ChantPaceStore.read('maha', standard), standard);
    });
  });

  group('the number kept for a mantra, on the phone', () {
    late Directory dir;

    setUpAll(() async {
      dir = await Directory.systemTemp.createTemp('hariharibol_chant_pace');
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
        const MethodChannel('plugins.flutter.io/path_provider'),
        (call) async => dir.path,
      );
      await LocalStore.instance.init();
    });

    // Not `Hive.close()`: see routine_sheet_test.dart.
    tearDownAll(() {
      if (dir.existsSync()) dir.deleteSync(recursive: true);
    });

    test('survives being read back from the store', () async {
      ChantPaceStore.write('stored', ms(3300));
      // The write is not awaited by the caller; give the box a turn to take it.
      await Future<void>.delayed(const Duration(milliseconds: 50));
      expect(ChantPaceStore.read('stored', standard), ms(3300));
    });

    test('is the standard time for a mantra with nothing kept', () {
      expect(ChantPaceStore.read('never-kept', standard), standard);
    });
  });
}
