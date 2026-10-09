import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/services/mantra_accurate_model.dart';

/// A small file server that honours `Range`, standing in for the real host.
class _Host {
  _Host(this.files);

  final Map<String, Uint8List> files;
  final ranges = <String?>[];
  late final HttpServer _server;

  String get url => 'http://${_server.address.host}:${_server.port}';

  Future<void> start() async {
    _server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    _server.listen((request) async {
      final bytes = files[request.uri.pathSegments.last];
      final range = request.headers.value(HttpHeaders.rangeHeader);
      ranges.add(range);
      if (bytes == null) {
        request.response.statusCode = HttpStatus.notFound;
      } else if (range != null) {
        final from = int.parse(RegExp(r'bytes=(\d+)-').firstMatch(range)!.group(1)!);
        request.response
          ..statusCode = HttpStatus.partialContent
          ..headers.set(HttpHeaders.contentRangeHeader, 'bytes $from-${bytes.length - 1}/${bytes.length}')
          ..add(bytes.sublist(from));
      } else {
        request.response.add(bytes);
      }
      await request.response.close();
    });
  }

  Future<void> stop() => _server.close(force: true);
}

AccurateModelPart _part(String name, Uint8List bytes) =>
    AccurateModelPart(name: name, bytes: bytes.length, sha256: sha256.convert(bytes).toString());

void main() {
  late Directory dir;
  late Uint8List modelBytes;
  late Uint8List tokenBytes;
  late _Host host;

  MantraAccurateModel service({AccurateModelPart? model, Future<int?> Function()? memory}) => MantraAccurateModel(
        baseUrl: host.url,
        model: model ?? _part('model.onnx', modelBytes),
        tokens: _part('tokens.txt', tokenBytes),
        folder: () async => dir,
        memoryMegabytes: memory ?? () async => 8000,
      );

  setUp(() async {
    dir = await Directory.systemTemp.createTemp('accurate_model_test');
    modelBytes = Uint8List.fromList(List.generate(50000, (i) => i % 251));
    tokenBytes = Uint8List.fromList(utf8.encode('<s> 0\n<pad> 1\n'));
    host = _Host({'model.onnx': modelBytes, 'tokens.txt': tokenBytes});
    await host.start();
  });

  tearDown(() async {
    await host.stop();
    if (dir.existsSync()) await dir.delete(recursive: true);
  });

  test('nothing is installed until a whole download is in place', () async {
    expect(await service().installed(), isNull);
  });

  test('downloads both files, reports progress up to done, and then they are installed', () async {
    final progress = <double>[];
    await service().download(onProgress: progress.add);

    final files = await service().installed();
    expect(files, isNotNull);
    expect(File(files!.model).readAsBytesSync(), modelBytes);
    expect(File(files.tokens).readAsBytesSync(), tokenBytes);
    expect(progress.last, closeTo(1.0, 1e-9));
    expect(progress, everyElement(inInclusiveRange(0.0, 1.0)));
    expect(Directory(dir.path).listSync().whereType<File>().where((f) => f.path.endsWith('.part')), isEmpty);
  });

  test('a download that arrives wrong is thrown away, never installed', () async {
    host.files['model.onnx'] = Uint8List.fromList(List.filled(modelBytes.length, 7));
    await expectLater(service().download(), throwsA(isA<StateError>()));

    expect(await service().installed(), isNull);
    expect(File('${dir.path}/model.onnx').existsSync(), isFalse);
    expect(File('${dir.path}/model.onnx.part').existsSync(), isFalse);
  });

  test('an interrupted download carries on from where it stopped', () async {
    File('${dir.path}/model.onnx.part').writeAsBytesSync(modelBytes.sublist(0, 20000));
    await service().download();

    expect(host.ranges, contains('bytes=20000-'));
    expect(File('${dir.path}/model.onnx').readAsBytesSync(), modelBytes);
  });

  test('a file of the wrong size is not an install', () async {
    await service().download();
    File('${dir.path}/model.onnx').writeAsBytesSync(modelBytes.sublist(0, 100));
    expect(await service().installed(), isNull);
  });

  test('removing it leaves nothing behind', () async {
    await service().download();
    await service().remove();
    expect(await service().installed(), isNull);
    expect(dir.existsSync(), isFalse);
  });

  test('a phone with too little memory is not offered it; an unknown amount is', () async {
    expect(await service(memory: () async => 2000).deviceCanRun(), isFalse);
    expect(await service(memory: () async => 8000).deviceCanRun(), isTrue);
    expect(await service(memory: () async => null).deviceCanRun(), isTrue);
  });

  test('with no host configured there is nothing to download', () async {
    final none = MantraAccurateModel(
      baseUrl: '',
      model: _part('model.onnx', modelBytes),
      tokens: _part('tokens.txt', tokenBytes),
      folder: () async => dir,
    );
    expect(none.hasHost, isFalse);
    await expectLater(none.download(), throwsA(isA<StateError>()));
  });
}
