// Speaking a question: which of the phone's recogniser languages is picked, and
// how what is heard reaches the message box.

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/services/speech_input.dart';
import 'package:hariharibol/widgets/chat/chat_dictation.dart';

import 'support/fake_chat_device.dart';

void main() {
  group('pickSpeechLocale', () {
    test('keeps the phone\'s own accent when it is the same language', () {
      expect(
        pickSpeechLocale('en', ['en_US', 'en_IN', 'en_GB'], phoneDefault: 'en_GB'),
        'en_GB',
      );
    });

    test('otherwise prefers the Indian one', () {
      expect(pickSpeechLocale('en', ['en_US', 'en_IN', 'en_GB']), 'en_IN');
      expect(pickSpeechLocale('en', ['en_US', 'en_IN'], phoneDefault: 'hi_IN'), 'en_IN');
    });

    test('otherwise the first the phone offers', () {
      expect(pickSpeechLocale('en', ['en_US', 'en_GB']), 'en_US');
    });

    test('reads both separators and any case', () {
      expect(pickSpeechLocale('HI', ['en-US', 'hi-IN']), 'hi-IN');
      expect(pickSpeechLocale('hi', ['hi_in', 'hi_US']), 'hi_in');
    });

    test('is not fooled by a language that merely starts the same', () {
      expect(pickSpeechLocale('en', ['eng_IN', 'enm_US']), isNull);
    });

    test('returns null for a language the phone does not offer, so the phone decides', () {
      expect(pickSpeechLocale('as', ['en_IN', 'hi_IN']), isNull);
      expect(pickSpeechLocale('en', const []), isNull);
    });
  });

  group('ChatDictation', () {
    late FakeSpeechInput speech;
    late TextEditingController box;
    late List<DictationNotice> notices;
    late ChatDictation dictation;

    setUp(() {
      speech = FakeSpeechInput();
      box = TextEditingController();
      notices = [];
      dictation = ChatDictation(input: speech, text: box, onNotice: notices.add);
    });

    tearDown(() {
      dictation.dispose();
      box.dispose();
    });

    Future<void> toggle({int maxChars = 500}) => dictation.toggle(languageCode: 'hi', maxChars: maxChars);

    test('listens in the language it is given', () async {
      await toggle();
      expect(speech.started, ['hi']);
      expect(dictation.listening, isTrue);
    });

    test('writes what is heard into the box, replacing the earlier guess each time', () async {
      await toggle();
      speech.hear('hare');
      speech.hear('hare krishna');
      expect(box.text, 'hare krishna');
      expect(box.selection.baseOffset, box.text.length);
    });

    test('adds to what was already typed, with a space between', () async {
      box.text = 'Tell me about';
      await toggle();
      speech.hear('japa');
      expect(box.text, 'Tell me about japa');
    });

    test('does not double a space or a line break already there', () async {
      box.text = 'Tell me about ';
      await toggle();
      speech.hear('japa');
      expect(box.text, 'Tell me about japa');

      speech.endBy(SpeechEnd.heard);
      box.text = 'Line one\n';
      await toggle();
      speech.hear('line two');
      expect(box.text, 'Line one\nline two');
    });

    test('never writes more than the box takes', () async {
      await toggle(maxChars: 8);
      speech.hear('a very long question indeed');
      expect(box.text, 'a very l');
    });

    test('pressing again stops it, and the last words still arrive', () async {
      await toggle();
      await toggle();
      expect(speech.stopped, isTrue);
      expect(dictation.listening, isFalse);
      // Pressing at once, before a word, is not reported as a fault.
      expect(notices, isEmpty);
    });

    test('stopping before anything was heard is quiet; silence by itself is reported', () async {
      speech.endOnStop = SpeechEnd.heardNothing;
      await toggle();
      await toggle();
      expect(notices, isEmpty);

      await toggle();
      speech.endBy(SpeechEnd.heardNothing);
      expect(notices, [DictationNotice.heardNothing]);
      expect(dictation.listening, isFalse);
    });

    test('a recogniser that gives up is reported', () async {
      await toggle();
      speech.endBy(SpeechEnd.failed);
      expect(notices, [DictationNotice.failed]);
      expect(dictation.listening, isFalse);
    });

    test('words that end by themselves leave the box as heard, and say nothing', () async {
      await toggle();
      speech.hear('hari bol');
      speech.endBy(SpeechEnd.heard);
      expect(box.text, 'hari bol');
      expect(notices, isEmpty);
      expect(dictation.listening, isFalse);
    });

    test('a refused microphone and a phone without a recogniser are told apart', () async {
      speech.result = SpeechStart.denied;
      await toggle();
      expect(notices, [DictationNotice.denied]);
      expect(dictation.listening, isFalse);

      speech.result = SpeechStart.unavailable;
      await toggle();
      expect(notices, [DictationNotice.denied, DictationNotice.unavailable]);
    });

    test('cancel closes the microphone at once and drops what has not arrived', () async {
      await toggle();
      await dictation.cancel();
      expect(speech.cancelled, isTrue);
      expect(dictation.listening, isFalse);
      speech.hear('too late');
      expect(box.text, isEmpty);
    });

    test('cancel when not listening does nothing', () async {
      await dictation.cancel();
      expect(speech.cancelled, isFalse);
    });

    test('tells its listeners when listening starts and stops', () async {
      var calls = 0;
      dictation.addListener(() => calls++);
      await toggle();
      expect(calls, 1);
      speech.endBy(SpeechEnd.heard);
      expect(calls, 2);
    });

    test('words arriving after it is disposed are ignored', () async {
      await toggle();
      dictation.dispose();
      speech.hear('late');
      expect(box.text, isEmpty);
      // Disposed once more by tearDown: the notifier allows it only once.
      dictation = ChatDictation(input: speech, text: box, onNotice: notices.add);
    });
  });
}
