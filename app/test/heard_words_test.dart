import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/constants/auto_chant_config.dart';
import 'package:hariharibol/services/heard_words.dart';

void main() {
  group('HeardWords', () {
    test('starts with nothing heard', () {
      final heard = HeardWords();
      expect(heard.live, isEmpty);
      expect(heard.voiceActive, isFalse);
      expect(heard.latest, isNull);
      expect(heard.recent, isEmpty);
    });

    test('a running transcript is live until the voice stops, then it is kept', () {
      final heard = HeardWords(now: () => DateTime(2026, 10, 11, 6));

      heard.hear('hare krishna', isFinal: false, match: 0.4, needed: 0.5);
      expect(heard.live, 'hare krishna');
      expect(heard.recent, isEmpty);

      heard.hear('hare krishna hare', isFinal: true, counted: 1, match: 0.8, needed: 0.5);
      expect(heard.live, isEmpty);
      final kept = heard.latest!;
      expect(kept.text, 'hare krishna hare');
      expect(kept.counted, 1);
      expect(kept.match, 0.8);
      expect(kept.needed, 0.5);
      expect(kept.at, DateTime(2026, 10, 11, 6));
    });

    test('the best match within a stretch is the one kept, not the last', () {
      final heard = HeardWords();
      heard.hear('hare', isFinal: false, match: 0.8, needed: 0.5);
      // The recogniser rewrote it and the score fell; the stretch still got that far.
      heard.hear('hair', isFinal: false, match: 0.3, needed: 0.5);
      expect(heard.liveMatch, 0.8);

      heard.hear('hair', isFinal: true, match: 0.3, needed: 0.5);
      expect(heard.latest!.match, 0.8);
    });

    test('counts credited while the voice is still going add up with the final', () {
      final heard = HeardWords();
      heard.hear('rama rama', isFinal: false, counted: 1, match: 0.9, needed: 0.5);
      expect(heard.liveCounted, 1);

      heard.hear('rama rama rama', isFinal: true, counted: 2, match: 0.9, needed: 0.5);
      expect(heard.latest!.counted, 3);
      expect(heard.liveCounted, 0, reason: 'the next stretch starts from nothing');
    });

    test('a stretch that matched nothing is kept as not counted', () {
      final heard = HeardWords();
      heard.hear('good morning', isFinal: true, match: 0.1, needed: 0.5);
      expect(heard.latest!.counted, 0);
      expect(heard.latest!.match, 0.1);
    });

    test('word detection has no match, and says so', () {
      final heard = HeardWords();
      heard.hear('hare krishna', isFinal: true);
      expect(heard.latest!.match, isNull);
      expect(heard.latest!.needed, isNull);
    });

    test('an empty final ends the stretch without adding a line', () {
      final heard = HeardWords();
      heard.hear('ha', isFinal: false);
      heard.hear('', isFinal: true);
      expect(heard.live, isEmpty);
      expect(heard.recent, isEmpty);
    });

    test('keeps the newest few, newest first', () {
      final heard = HeardWords();
      for (var i = 0; i < AutoChantConfig.heardKept + 3; i++) {
        heard.hear('line $i', isFinal: true);
      }
      expect(heard.recent, hasLength(AutoChantConfig.heardKept));
      expect(heard.recent.first.text, 'line ${AutoChantConfig.heardKept + 2}');
      expect(heard.recent.last.text, 'line 3');
    });

    test('the running line shows only its last words', () {
      final heard = HeardWords();
      final words = [for (var i = 1; i <= AutoChantConfig.heardLiveWords + 5; i++) 'w$i'];
      heard.hear(words.join(' '), isFinal: false);

      final shown = heard.live.split(' ');
      expect(shown, hasLength(AutoChantConfig.heardLiveWords));
      expect(shown.last, words.last);
      expect(shown.first, 'w6');
    });

    test('clear forgets everything, voice included', () {
      final heard = HeardWords()
        ..voice(true)
        ..hear('hare', isFinal: false)
        ..hear('hare krishna', isFinal: true);
      heard.clear();
      expect(heard.recent, isEmpty);
      expect(heard.live, isEmpty);
      expect(heard.voiceActive, isFalse);
    });

    test('listeners hear each change, and a voice that has not changed is not news', () {
      final heard = HeardWords();
      var calls = 0;
      heard.addListener(() => calls += 1);

      heard.voice(true);
      heard.voice(true);
      heard.hear('hare', isFinal: false);
      expect(calls, 2);
    });

    test('a late event after dispose is ignored rather than thrown', () {
      final heard = HeardWords()..dispose();
      expect(() => heard.hear('hare', isFinal: true), returnsNormally);
      expect(() => heard.voice(true), returnsNormally);
    });
  });
}
