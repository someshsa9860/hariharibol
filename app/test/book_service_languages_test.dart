// What a book call says about the reader's language. A phone changes its own
// reading language at once and tells the account a moment later, so a chapter
// asked for in between used to come back in the language just left; the call
// now names the languages itself and the server follows it.
//
// The server is a scripted `HttpClientAdapter`, so every request is on record.

import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/services/api_client.dart';
import 'package:hariharibol/services/book_service.dart';

class _Server implements HttpClientAdapter {
  final List<RequestOptions> requests = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final data = options.path.endsWith('/verses')
        ? <Object>[]
        : {
            'chapter': {'id': 'c1', 'number': 2, 'title': 'Chapter'},
            'verses': <Object>[],
          };
    return ResponseBody.fromString(
      jsonEncode({'success': true, 'data': data}),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  late _Server server;
  late BookService service;

  setUp(() {
    server = _Server();
    service = BookService.forTesting(ApiClient.forTesting(adapter: server));
  });

  Map<String, dynamic> sent() => server.requests.single.queryParameters;

  test('a chapter is asked for in the reading chain', () async {
    await service.chapter('bhagavad-gita', 2, languages: ['mr', 'en']);
    expect(sent(), {'languages': 'mr,en'});
  });

  test('a canto stays beside the languages', () async {
    await service.chapter('srimad-bhagavatam', 1, canto: 3, languages: ['hi', 'en']);
    expect(sent(), {'canto': 3, 'languages': 'hi,en'});
  });

  test('a short work is asked for in the reading chain', () async {
    await service.verses('some-stotra', languages: ['ta', 'en']);
    expect(sent(), {'languages': 'ta,en'});
  });

  test('no languages, no parameter — the account\'s own stand', () async {
    await service.chapter('bhagavad-gita', 2);
    expect(sent(), isEmpty);
  });

  test('the chain is cut at three, and a code the server would refuse is left out', () async {
    await service.chapter('bhagavad-gita', 2, languages: ['mr', 'zh-Hans', 'hi', 'en', 'ta']);
    expect(sent(), {'languages': 'mr,hi,en'});
  });
}
