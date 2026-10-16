// The Server-Sent Events parser: what the chat's reply stream is read with.
// Pure text in, events out — pieces may be split anywhere the network likes.

import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/services/sse_parser.dart';

List<SseEvent> parseAll(Iterable<String> chunks) {
  final decoder = SseDecoder();
  return [for (final chunk in chunks) ...decoder.add(chunk), ...decoder.close()];
}

String describe(List<SseEvent> events) => events.map((e) => '${e.event}|${e.data}').join(' ; ');

void main() {
  test('one event: its name and its data', () {
    expect(describe(parseAll(['event: delta\ndata: {"text":"Hari"}\n\n'])), 'delta|{"text":"Hari"}');
  });

  test('an event with no name is a message', () {
    expect(describe(parseAll(['data: hello\n\n'])), 'message|hello');
  });

  test('several events in one piece, in order', () {
    final events = parseAll(['event: meta\ndata: 1\n\nevent: delta\ndata: 2\n\nevent: done\ndata: 3\n\n']);
    expect(describe(events), 'meta|1 ; delta|2 ; done|3');
  });

  test('an event split across pieces, at any byte', () {
    const whole = 'event: delta\ndata: {"text":"Krishna"}\n\n';
    for (var cut = 1; cut < whole.length; cut++) {
      final events = parseAll([whole.substring(0, cut), whole.substring(cut)]);
      expect(describe(events), 'delta|{"text":"Krishna"}', reason: 'cut at $cut');
    }
  });

  test('one character at a time', () {
    const whole = 'event: a\ndata: x\n\nevent: b\ndata: y\n\n';
    expect(describe(parseAll(whole.split(''))), 'a|x ; b|y');
  });

  test('CRLF line ends, even when the CR and the LF arrive apart', () {
    expect(describe(parseAll(['event: delta\r\ndata: one\r\n\r\n'])), 'delta|one');
    expect(describe(parseAll(['event: delta\r', '\ndata: one\r', '\n\r', '\n'])), 'delta|one');
  });

  test('a bare CR is a line end too', () {
    expect(describe(parseAll(['event: delta\rdata: one\r\r'])), 'delta|one');
  });

  test('comment lines (the server heartbeat) are ignored, and are not events', () {
    final events = parseAll([': ping\n\n', 'event: delta\n: ping\ndata: one\n\n', ': ping\n\n']);
    expect(describe(events), 'delta|one');
  });

  test('several data lines are joined with a newline', () {
    expect(describe(parseAll(['data: one\ndata: two\n\n'])), 'message|one\ntwo');
  });

  test('one space after the colon is dropped, no more', () {
    expect(describe(parseAll(['data:  two spaces\n\n'])), 'message| two spaces');
    expect(describe(parseAll(['data:none\n\n'])), 'message|none');
  });

  test('a field with no colon is a name with an empty value', () {
    expect(describe(parseAll(['data\n\n'])), 'message|');
  });

  test('an event with no data is not dispatched, and does not leak its name', () {
    expect(describe(parseAll(['event: ghost\n\ndata: real\n\n'])), 'message|real');
  });

  test('an event that never got its blank line is dropped when the stream ends', () {
    expect(parseAll(['event: delta\ndata: cut off']), isEmpty);
    expect(parseAll(['event: delta\ndata: cut off\n']), isEmpty);
  });

  test('unknown fields (id, retry) are skipped', () {
    expect(describe(parseAll(['id: 7\nretry: 1000\nevent: delta\ndata: one\n\n'])), 'delta|one');
  });

  group('from bytes', () {
    Future<List<SseEvent>> fromBytes(List<List<int>> chunks) =>
        parseSse(Stream.fromIterable(chunks)).toList();

    test('multi-byte characters split between pieces arrive whole', () async {
      final bytes = utf8.encode('event: delta\ndata: {"text":"हरे कृष्ण 🙏"}\n\n');
      for (var cut = 1; cut < bytes.length; cut++) {
        final events = await fromBytes([bytes.sublist(0, cut), bytes.sublist(cut)]);
        expect(events, hasLength(1), reason: 'cut at $cut');
        expect(jsonDecode(events.single.data)['text'], 'हरे कृष्ण 🙏', reason: 'cut at $cut');
      }
    });

    test('events come out as the pieces come in, not at the end', () async {
      final input = StreamController<List<int>>();
      final seen = <String>[];
      final done = parseSse(input.stream).forEach((event) => seen.add(event.data));

      input.add(utf8.encode('data: first\n\n'));
      await pumpEventQueue();
      expect(seen, ['first']);

      input.add(utf8.encode('data: second\n\n'));
      await input.close();
      await done;
      expect(seen, ['first', 'second']);
    });

    test('an error on the byte stream is passed on', () async {
      final input = StreamController<List<int>>();
      final outcome = expectLater(parseSse(input.stream).toList(), throwsStateError);
      input.addError(StateError('dropped'));
      await input.close();
      await outcome;
    });
  });
}
