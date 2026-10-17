// What a chat stream that breaks part-way is called. Only the connection
// itself failing is "the network"; a fault in our own code is not, or a parser
// bug reads to the person as a bad signal (it once did: "Connection lost" on a
// reply the server had sent in full).

import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/models/api_failure.dart';
import 'package:hariharibol/services/api_client.dart';
import 'package:hariharibol/services/sse_parser.dart';

void main() {
  const first = SseEvent(event: 'delta', data: '{"text":"Hare"}');

  /// The failure a reader of the stream gets when [error] is thrown after the
  /// first event arrived.
  Future<ApiFailure> failureOf(Object error) async {
    Stream<SseEvent> source() async* {
      yield first;
      throw error;
    }

    final seen = <SseEvent>[];
    try {
      await for (final event in ApiClient.instance.guardStream(source())) {
        seen.add(event);
      }
    } on ApiFailure catch (failure) {
      expect(seen, [first], reason: 'what arrived before the break is still delivered');
      return failure;
    }
    fail('the break was swallowed');
  }

  test('events pass through untouched', () async {
    final events = await ApiClient.instance.guardStream(Stream.fromIterable([first, first])).toList();
    expect(events, [first, first]);
  });

  group('the connection failing is the network', () {
    test('a socket that closes', () async {
      final failure = await failureOf(const SocketException('Connection reset by peer'));
      expect(failure.kind, FailureKind.network);
    });

    test('a response cut short', () async {
      final failure = await failureOf(const HttpException('Connection closed while receiving data'));
      expect(failure.kind, FailureKind.network);
    });

    test('a Dio connection error', () async {
      final failure = await failureOf(DioException(
        requestOptions: RequestOptions(path: '/stream'),
        type: DioExceptionType.connectionError,
        error: const SocketException('Network is unreachable'),
      ));
      expect(failure.kind, FailureKind.network);
    });
  });

  group('a stall is a timeout', () {
    test('a read that never finishes', () async {
      final failure = await failureOf(TimeoutException('no data'));
      expect(failure.kind, FailureKind.timeout);
    });

    test('Dio giving up on a response', () async {
      final failure = await failureOf(DioException(
        requestOptions: RequestOptions(path: '/stream'),
        type: DioExceptionType.receiveTimeout,
      ));
      expect(failure.kind, FailureKind.timeout);
    });
  });

  group('a fault of our own is never called the network', () {
    test('a type error', () async {
      final failure = await failureOf(TypeError());
      expect(failure.kind, FailureKind.unknown);
      expect(failure.message, isEmpty);
    });

    test('a state error', () async {
      final failure = await failureOf(StateError('Bad state: no element'));
      expect(failure.kind, FailureKind.unknown);
      expect(failure.message, isEmpty);
    });

    test('a bad format', () async {
      final failure = await failureOf(const FormatException('Unexpected character'));
      expect(failure.kind, FailureKind.unknown);
      expect(failure.message, isEmpty);
    });
  });

  test('a failure that is already named is not renamed', () async {
    const named = ApiFailure(kind: FailureKind.server, statusCode: 503, code: 'AI_BUSY');
    expect(await failureOf(named), same(named));
  });
}
