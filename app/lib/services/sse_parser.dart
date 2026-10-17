import 'dart:async';
import 'dart:convert';

/// One Server-Sent Event: its name and its data lines joined with newlines.
class SseEvent {
  const SseEvent({required this.event, required this.data});

  /// What the `event:` line said, or `message` when there was none.
  final String event;
  final String data;

  static const String defaultEvent = 'message';

  @override
  String toString() => 'SseEvent($event, $data)';
}

/// Turns text into [SseEvent]s, following the WHATWG rules the backend writes
/// to: lines end in LF, CR or CRLF; a blank line ends an event; a line that
/// starts with a colon is a comment (the server's `: ping` heartbeat); `data:`
/// lines are joined with newlines; one space after a colon is dropped.
///
/// Pure Dart with no I/O, so it is tested without a network. Text may be fed
/// in any size of piece — a line, an event or a terminator can be split
/// anywhere, including between the CR and the LF of one CRLF.
class SseDecoder {
  String _buffer = '';
  String _event = '';
  final List<String> _data = [];

  /// Feeds the next piece of text; returns the events it completed.
  List<SseEvent> add(String chunk) {
    _buffer += chunk;
    return _drain(atEnd: false);
  }

  /// The stream ended. A lone CR waiting for its LF is a line end after all; an
  /// event that never got its blank line is dropped, as the spec says.
  List<SseEvent> close() {
    final events = _drain(atEnd: true);
    _buffer = '';
    _event = '';
    _data.clear();
    return events;
  }

  static const int _lf = 10;
  static const int _cr = 13;

  List<SseEvent> _drain({required bool atEnd}) {
    final events = <SseEvent>[];
    var start = 0;

    while (true) {
      var end = start;
      while (end < _buffer.length) {
        final unit = _buffer.codeUnitAt(end);
        if (unit == _lf || unit == _cr) break;
        end++;
      }
      if (end >= _buffer.length) break;

      final isCr = _buffer.codeUnitAt(end) == _cr;
      // A CR at the very end may be the first half of CRLF: wait for more.
      if (isCr && end + 1 >= _buffer.length && !atEnd) break;

      final line = _buffer.substring(start, end);
      final crlf = isCr && end + 1 < _buffer.length && _buffer.codeUnitAt(end + 1) == _lf;
      start = end + (crlf ? 2 : 1);

      final event = _line(line);
      if (event != null) events.add(event);
    }

    _buffer = _buffer.substring(start);
    return events;
  }

  SseEvent? _line(String line) {
    if (line.isEmpty) return _dispatch();
    if (line.startsWith(':')) return null;

    final colon = line.indexOf(':');
    final field = colon == -1 ? line : line.substring(0, colon);
    var value = colon == -1 ? '' : line.substring(colon + 1);
    if (value.startsWith(' ')) value = value.substring(1);

    switch (field) {
      case 'event':
        _event = value;
      case 'data':
        _data.add(value);
    }
    return null;
  }

  SseEvent? _dispatch() {
    final hasData = _data.isNotEmpty;
    final event = SseEvent(
      event: _event.isEmpty ? SseEvent.defaultEvent : _event,
      data: _data.join('\n'),
    );
    _event = '';
    _data.clear();
    return hasData ? event : null;
  }
}

/// Bytes in, events out. UTF-8 is decoded across chunk boundaries, so a
/// Devanagari character split between two packets arrives whole.
///
/// `bind`, not `bytes.transform(...)`: Dio's body is really a
/// `Stream<Uint8List>`, and `transform` checks its argument against the
/// stream's *runtime* element type, so a decoder of `List<int>` is refused
/// with a `TypeError` that the caller can only read as a dropped connection.
Stream<SseEvent> parseSse(Stream<List<int>> bytes) async* {
  final decoder = SseDecoder();
  await for (final text in const Utf8Decoder(allowMalformed: true).bind(bytes)) {
    for (final event in decoder.add(text)) {
      yield event;
    }
  }
  for (final event in decoder.close()) {
    yield event;
  }
}
