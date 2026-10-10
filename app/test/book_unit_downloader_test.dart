import 'dart:async';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/models/api_failure.dart';
import 'package:hariharibol/models/book_cache.dart';
import 'package:hariharibol/services/book_unit_downloader.dart';

import 'support/book_fixtures.dart';
import 'support/fakes_sync.dart';

typedef Reply = FutureOr<ResponseBody> Function(RequestOptions options);

/// An HTTP "S3": each request gets the next scripted reply.
class ScriptedAdapter implements HttpClientAdapter {
  ScriptedAdapter(this.replies);

  final List<Reply> replies;
  final List<RequestOptions> requests = [];

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    requests.add(options);
    final reply = replies[min(requests.length - 1, replies.length - 1)];
    return reply(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody ok(Uint8List bytes, {int status = 200}) =>
    ResponseBody.fromBytes(bytes, status, headers: {Headers.contentLengthHeader: ['${bytes.length}']});

ResponseBody status(int code) => ResponseBody.fromBytes(Uint8List(0), code);

/// Delivers [first] bytes then breaks the connection.
ResponseBody cutOff(Uint8List bytes, int first) {
  final controller = StreamController<Uint8List>();
  controller.add(Uint8List.sublistView(bytes, 0, first));
  controller.addError(const HttpException('connection closed before the body was complete'));
  controller.close();
  return ResponseBody(controller.stream, 200);
}

void main() {
  late FakeCacheApi api;
  late List<Duration> sleeps;

  final json = unitJson();
  final raw = unitBytes(json);
  final gz = unitBytes(json, gzipped: true);

  BookUnitDownloader build(ScriptedAdapter adapter, {int attempts = 4}) {
    final dio = Dio(BaseOptions(validateStatus: (s) => s == 200 || s == 206))..httpClientAdapter = adapter;
    return BookUnitDownloader(api: api, dio: dio, sleep: (d) async => sleeps.add(d), random: Random(1), attempts: attempts);
  }

  ManifestUnit unit() => manifestUnit(1, hash: raw.hash);

  setUp(() {
    sleeps = [];
    api = FakeCacheApi([unit()]);
  });

  test('downloads, unpacks gzip, checks the hash and parses', () async {
    final adapter = ScriptedAdapter([(_) => ok(gz.bytes)]);
    final result = await build(adapter).download('sb', unit());

    expect(result.hash, raw.hash);
    expect(result.version, 1);
    expect(result.payload.verses, hasLength(4));
    expect(result.payload.verses.first.translations.map((t) => t.languageCode), ['en', 'hi']);
    expect(adapter.requests.single.uri.toString(), 'https://s3.test/canto1');
    expect(sleeps, isEmpty);
  });

  test('accepts a file the HTTP stack already unpacked', () async {
    final result = await build(ScriptedAdapter([(_) => ok(raw.bytes)])).download('sb', unit());
    expect(result.payload.verses, hasLength(4));
  });

  test('a body that breaks off is resumed from where it stopped', () async {
    final adapter = ScriptedAdapter([
      (_) => cutOff(gz.bytes, 100),
      (o) {
        expect(o.headers['Range'], 'bytes=100-');
        return ok(Uint8List.sublistView(gz.bytes, 100), status: 206);
      },
    ]);
    final result = await build(adapter).download('sb', unit());

    expect(result.payload.verses, hasLength(4));
    expect(adapter.requests, hasLength(2));
    expect(sleeps, hasLength(1));
  });

  test('a server that ignores Range and resends everything still works', () async {
    final adapter = ScriptedAdapter([(_) => cutOff(gz.bytes, 80), (_) => ok(gz.bytes)]);
    final result = await build(adapter).download('sb', unit());
    expect(result.payload.verses, hasLength(4));
  });

  test('an expired link (403) is replaced once with a fresh one', () async {
    var issued = 0;
    api.linkOverrides = {
      'canto1': () => UnitLink(
            unitId: 'canto1',
            unitType: 'canto',
            url: 'https://s3.test/link-${++issued}',
            version: 1,
            hash: raw.hash,
            sizeBytes: 1,
          ),
    };
    final adapter = ScriptedAdapter([(_) => status(403), (_) => ok(gz.bytes)]);
    await build(adapter).download('sb', unit());

    expect(api.linkRequests, ['canto1', 'canto1']);
    expect(adapter.requests.map((r) => r.uri.path), ['/link-1', '/link-2']);
  });

  test('a link that is refused twice is not asked for forever', () async {
    final adapter = ScriptedAdapter([(_) => status(403)]);
    await expectLater(build(adapter).download('sb', unit()), throwsA(isA<DioException>()));
    expect(adapter.requests, hasLength(2));
  });

  test('server errors back off exponentially and then give up', () async {
    final adapter = ScriptedAdapter([(_) => status(503)]);
    await expectLater(build(adapter).download('sb', unit()), throwsA(isA<DioException>()));

    expect(adapter.requests, hasLength(4));
    expect(sleeps, hasLength(3));
    expect(sleeps[1], greaterThan(sleeps[0]));
    expect(sleeps[2], greaterThan(sleeps[1]));
    expect(sleeps[0], greaterThanOrEqualTo(const Duration(seconds: 1)));
    expect(sleeps[0], lessThan(const Duration(milliseconds: 1300)));
  });

  test('a 404 is an answer, not a reason to retry', () async {
    final adapter = ScriptedAdapter([(_) => status(404)]);
    await expectLater(build(adapter).download('sb', unit()), throwsA(isA<DioException>()));
    expect(adapter.requests, hasLength(1));
    expect(sleeps, isEmpty);
  });

  test('transient failures asking for the link are retried too', () async {
    var calls = 0;
    api.linkOverrides = {
      'canto1': () {
        if (++calls < 3) throw const ApiFailure(kind: FailureKind.network);
        return UnitLink(unitId: 'canto1', unitType: 'canto', url: 'https://s3.test/ok', version: 1, hash: raw.hash, sizeBytes: 1);
      },
    };
    await build(ScriptedAdapter([(_) => ok(gz.bytes)])).download('sb', unit());
    expect(calls, 3);
    expect(sleeps, hasLength(2));
  });

  test('bytes that do not match the promised hash are fetched again, then refused', () async {
    final bad = unitBytes(unitJson(purportPrefix: 'tampered'), gzipped: true);
    final adapter = ScriptedAdapter([(_) => ok(bad.bytes)]);
    await expectLater(build(adapter).download('sb', unit()), throwsA(isA<UnitIntegrityException>()));
    expect(adapter.requests, hasLength(2));
  });

  test('a corrupt first copy followed by a good one succeeds', () async {
    final bad = unitBytes(unitJson(purportPrefix: 'tampered'), gzipped: true);
    final result = await build(ScriptedAdapter([(_) => ok(bad.bytes), (_) => ok(gz.bytes)])).download('sb', unit());
    expect(result.payload.verses, hasLength(4));
  });

  test('a file from a newer schema is refused without retrying', () async {
    final future = unitBytes(unitJson(schemaVersion: 9), gzipped: true);
    final adapter = ScriptedAdapter([(_) => ok(future.bytes)]);
    final u = manifestUnit(1, hash: future.hash);
    api.units = [u];
    await expectLater(
      build(adapter).download('sb', u),
      throwsA(isA<UnitIntegrityException>().having((e) => e.reason, 'reason', contains('newer'))),
    );
    expect(adapter.requests, hasLength(1));
  });

  test('a link that declares a newer schema is refused before downloading anything', () async {
    api.linkOverrides = {
      'canto1': () => UnitLink(unitId: 'canto1', unitType: 'canto', url: 'x', version: 1, hash: 'h', sizeBytes: 1, schemaVersion: 7),
    };
    final adapter = ScriptedAdapter([(_) => ok(gz.bytes)]);
    await expectLater(build(adapter).download('sb', unit()), throwsA(isA<UnitIntegrityException>()));
    expect(adapter.requests, isEmpty);
  });

  test('backoff is capped', () {
    final d = build(ScriptedAdapter([(_) => ok(gz.bytes)]));
    expect(d.backoff(20), lessThanOrEqualTo(const Duration(seconds: 26)));
  });

  test('version and hash come from the link, which is newer than the manifest if the unit changed', () async {
    final newer = unitBytes(unitJson(purportPrefix: 'newer'), gzipped: true);
    api.linkOverrides = {
      'canto1': () => UnitLink(unitId: 'canto1', unitType: 'canto', url: 'https://s3.test/n', version: 5, hash: newer.hash, sizeBytes: 1),
    };
    final result = await build(ScriptedAdapter([(_) => ok(newer.bytes)])).download('sb', unit());
    expect((result.version, result.hash), (5, newer.hash));
  });
}
