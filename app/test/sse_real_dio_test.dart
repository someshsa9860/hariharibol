import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/models/api_failure.dart';
import 'package:hariharibol/services/api_client.dart';
import 'package:hariharibol/services/sse_parser.dart';

/// The one thing the other SSE tests cannot say: that the bytes a real Dio
/// response hands over are understood. `ResponseBody.stream` is a
/// `Stream<Uint8List>`, not a `Stream<List<int>>`, and a parser that treats the
/// two alike fails only when it is given the real one. The same goes for a
/// socket that dies mid-reply: what Dio throws for it is only known by letting
/// one die.
void main() {
  late HttpServer server;
  late Dio dio;

  setUp(() async {
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    dio = Dio(BaseOptions(baseUrl: 'http://127.0.0.1:${server.port}'));
  });

  tearDown(() async {
    dio.close(force: true);
    await server.close(force: true);
  });

  /// Answers every request with [parts] written one at a time, as the chat
  /// endpoint does.
  void serve(List<List<int>> parts) {
    server.listen((request) async {
      await request.drain<void>();
      final response = request.response
        ..statusCode = 200
        ..headers.set('Content-Type', 'text/event-stream; charset=utf-8')
        ..headers.set('Cache-Control', 'no-cache, no-transform');
      response.bufferOutput = false;
      for (final part in parts) {
        response.add(part);
        await response.flush();
      }
      await response.close();
    });
  }

  Future<List<SseEvent>> read() async {
    final response = await dio.post<ResponseBody>(
      '/stream',
      data: const {'content': 'Hare Krushna'},
      options: Options(responseType: ResponseType.stream),
    );
    final body = response.data!.stream;
    expect(body, isA<Stream<Uint8List>>(), reason: 'this is what Dio really returns');
    return parseSse(body).toList();
  }

  test('events from a real Dio response are parsed', () async {
    serve([
      utf8.encode('event: meta\ndata: {"a":1}\n\n'),
      utf8.encode(': ping\n\n'),
      utf8.encode('event: delta\ndata: {"text":"Hare"}\n\n'),
      utf8.encode('event: done\ndata: {}\n\n'),
    ]);

    final events = await read();

    expect(events.map((e) => e.event), ['meta', 'delta', 'done']);
    expect(events[1].data, '{"text":"Hare"}');
  });

  test('a Devanagari character split across packets arrives whole', () async {
    final bytes = utf8.encode('event: delta\ndata: {"text":"हरे"}\n\n');
    serve([bytes.sublist(0, 30), bytes.sublist(30)]);

    final events = await read();

    expect(events.single.data, '{"text":"हरे"}');
  });

  test('a socket that dies mid-reply keeps what arrived and is called the network', () async {
    server.listen((request) async {
      await request.drain<void>();
      // The reply is written by hand onto the bare socket so that it can be cut
      // in the middle of a chunked body: one whole event, then the line goes dead.
      final socket = await request.response.detachSocket(writeHeaders: false);
      final event = utf8.encode('event: delta\ndata: {"text":"Hare"}\n\n');
      socket.add(utf8.encode(
        'HTTP/1.1 200 OK\r\n'
        'Content-Type: text/event-stream; charset=utf-8\r\n'
        'Transfer-Encoding: chunked\r\n'
        '\r\n'
        '${event.length.toRadixString(16)}\r\n',
      ));
      socket.add(event);
      socket.add(utf8.encode('\r\n'));
      await socket.flush();
      socket.destroy();
    });

    final response = await dio.post<ResponseBody>(
      '/stream',
      data: const {'content': 'Hare Krushna'},
      options: Options(responseType: ResponseType.stream),
    );

    final seen = <SseEvent>[];
    ApiFailure? failure;
    try {
      await for (final event in ApiClient.instance.guardStream(parseSse(response.data!.stream))) {
        seen.add(event);
      }
    } on ApiFailure catch (error) {
      failure = error;
    }

    expect(seen.map((e) => e.event), ['delta']);
    expect(failure, isNotNull, reason: 'a reply that stops without an end is not a finished reply');
    expect(failure!.kind, FailureKind.network);
  });
}
