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

  test('files on a phone too small to run them are not used', () async {
    // Downloaded where there was memory (or it was not known), then the app moved
    // to a smaller phone: the engine must still fall back to the bundled model.
    await service().download();
    expect(await service().usable(), isNotNull);
    expect(await service(memory: () async => null).usable(), isNotNull);
    expect(await service(memory: () async => 2000).usable(), isNull);
    expect(await service(memory: () async => 2000).installed(), isNotNull, reason: 'still on the phone');
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

  group('carried inside the app (debug builds)', () {
    // Stands in for the native side, which hands over what the package holds.
    late Map<String, Uint8List> package;
    late List<String> asked;
    late Directory folder;

    setUp(() {
      package = {'model.onnx': modelBytes, 'tokens.txt': tokenBytes};
      asked = [];
      // A folder inside the test's own directory: the "adopted" marker is written
      // beside it, and must be cleaned up with it.
      folder = Directory('${dir.path}/omnilingual');
    });

    MantraAccurateModel carrying({Future<int?> Function()? memory}) => MantraAccurateModel(
          baseUrl: '',
          model: _part('model.onnx', modelBytes),
          tokens: _part('tokens.txt', tokenBytes),
          folder: () async => folder,
          memoryMegabytes: memory ?? () async => 8000,
          bundledCopy: (name, destination) async {
            asked.add(name);
            final bytes = package[name];
            if (bytes == null) return false;
            await File(destination).writeAsBytes(bytes);
            return true;
          },
        );

    List<String> leftovers() =>
        folder.existsSync() ? [for (final f in folder.listSync()) if (f.path.endsWith('.part')) f.path] : [];

    test('is unpacked, checked, and then installed like a download', () async {
      final service = carrying();
      await service.adoptBundled();

      final files = await service.installed();
      expect(files, isNotNull);
      expect(File(files!.model).readAsBytesSync(), modelBytes);
      expect(File(files.tokens).readAsBytesSync(), tokenBytes);
      expect(leftovers(), isEmpty);
    });

    test('a build that carries none leaves nothing, and tries again next time', () async {
      package.clear();
      final service = carrying();
      await service.adoptBundled();
      expect(await service.installed(), isNull);
      expect(leftovers(), isEmpty);

      package = {'model.onnx': modelBytes, 'tokens.txt': tokenBytes};
      await service.adoptBundled();
      expect(await service.installed(), isNotNull);
    });

    test('a file that is not the right one is thrown away, and nothing throws', () async {
      package['model.onnx'] = Uint8List.fromList(List.filled(modelBytes.length, 7));
      final service = carrying();
      await service.adoptBundled();

      expect(await service.installed(), isNull);
      expect(File('${folder.path}/model.onnx').existsSync(), isFalse);
      expect(leftovers(), isEmpty);
    });

    test('removing it keeps it removed', () async {
      final service = carrying();
      await service.adoptBundled();
      await service.remove();
      final asks = asked.length;

      await service.adoptBundled();
      expect(asked, hasLength(asks), reason: 'nothing was copied a second time');
      expect(await service.installed(), isNull);
    });

    test('a phone too small to run it is not given the copy', () async {
      final service = carrying(memory: () async => 2000);
      await service.adoptBundled();
      expect(asked, isEmpty);
      expect(await service.installed(), isNull);
    });

    test('one already in place is left alone', () async {
      folder.createSync(recursive: true);
      File('${folder.path}/model.onnx').writeAsBytesSync(modelBytes);
      File('${folder.path}/tokens.txt').writeAsBytesSync(tokenBytes);

      await carrying().adoptBundled();
      expect(asked, isEmpty);
    });

    test('two asks at the same time make one copy', () async {
      await Future.wait([carrying().adoptBundled(), carrying().adoptBundled()]);
      expect(asked, ['tokens.txt', 'model.onnx']);
      expect(await carrying().installed(), isNotNull);
    });
  });
}
