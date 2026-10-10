import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'package:archive/archive.dart';
import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/models/tts_model.dart';
import 'package:hariharibol/services/tts/tts_model_manager.dart';
import 'package:path/path.dart' as p;

class Reply {
  Reply.bytes(this.bytes, {this.status = 200}) : cutAfter = null;
  Reply.cut(this.bytes, this.cutAfter) : status = 200;
  Reply.status(this.status)
      : bytes = Uint8List(0),
        cutAfter = null;

  final Uint8List bytes;
  final int status;
  final int? cutAfter;
}

class ScriptedAdapter implements HttpClientAdapter {
  ScriptedAdapter(this.replies);

  final List<Reply> replies;
  final List<RequestOptions> requests = [];

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? body, Future<void>? cancel) async {
    requests.add(options);
    final reply = replies[requests.length > replies.length ? replies.length - 1 : requests.length - 1];
    if (reply.cutAfter != null) {
      final c = StreamController<Uint8List>();
      c.add(Uint8List.sublistView(reply.bytes, 0, reply.cutAfter));
      c.addError(const SocketException('reset'));
      c.close();
      return ResponseBody(c.stream, 200);
    }
    return ResponseBody.fromBytes(reply.bytes, reply.status);
  }

  @override
  void close({bool force = false}) {}
}

Uint8List buildArchive(Map<String, List<int>> files, {String? root}) {
  final archive = Archive();
  files.forEach((name, content) => archive.addFile(ArchiveFile('${root == null ? '' : '$root/'}$name', content.length, content)));
  return Uint8List.fromList(BZip2Encoder().encode(TarEncoder().encode(archive)));
}

String sha(List<int> bytes) => sha256.convert(bytes).toString();

void main() {
  late Directory dir;
  late Uint8List archive;
  late TtsModelSpec spec;
  late List<Duration> sleeps;

  TtsModelManager build(ScriptedAdapter adapter, {String? manifest}) {
    sleeps = [];
    final dio = Dio(BaseOptions(validateStatus: (s) => s == 200 || s == 206))..httpClientAdapter = adapter;
    return TtsModelManager(
      baseDir: () async => dir,
      dio: dio,
      sleep: (d) async => sleeps.add(d),
      bundledManifest: () async => manifest ?? jsonEncode({
        'version': 1,
        'models': [
          {
            'id': spec.id,
            'name': spec.name,
            'languages': ['hi'],
            'url': 'https://models.test/v.tar.bz2',
            'sizeBytes': archive.length,
            'sha256': spec.sha256,
            'archive': 'tar.bz2',
            'files': {'model': 'model.onnx', 'tokens': 'tokens.txt', 'dataDir': 'espeak-ng-data'},
          },
        ],
      }),
    );
  }

  setUp(() async {
    dir = await Directory.systemTemp.createTemp('tts_models_test');
    archive = buildArchive({
      'model.onnx': List<int>.generate(20000, (i) => Random(i).nextInt(256)),
      'tokens.txt': utf8.encode('a 1\nb 2'),
      'espeak-ng-data/voices': utf8.encode('v'),
    }, root: 'vits-piper-hi');
    spec = TtsModelSpec(
      id: 'vits-hi',
      name: 'Hindi',
      languages: const ['hi'],
      engine: 'sherpa-vits',
      url: 'https://models.test/v.tar.bz2',
      sizeBytes: archive.length,
      sha256: sha(archive),
      files: const TtsModelFiles(model: 'model.onnx', tokens: 'tokens.txt', dataDir: 'espeak-ng-data'),
    );
  });

  tearDown(() => dir.delete(recursive: true));

  test('downloads, verifies, unpacks (stripping the archive\'s top folder) and installs', () async {
    final adapter = ScriptedAdapter([Reply.bytes(archive)]);
    final manager = build(adapter);
    final seen = <Type>[];
    await manager.init();
    manager.statuses.listen((m) => seen.add(m[spec.id].runtimeType));

    expect(await manager.ensure('hi'), isTrue);

    final voice = await manager.installedFor('hi');
    expect(voice, isNotNull);
    expect(File(p.join(voice!.dir, 'model.onnx')).existsSync(), isTrue);
    expect(File(p.join(voice.dir, 'espeak-ng-data', 'voices')).existsSync(), isTrue);
    expect(manager.statusOf(spec.id), isA<TtsInstalled>());
    expect(seen, containsAllInOrder([TtsDownloading, TtsVerifying, TtsExtracting, TtsInstalled]));
    expect(Directory(p.join(dir.path, 'downloads')).listSync(), isEmpty, reason: 'the download is cleaned up');
    expect(Directory(dir.path).listSync().map((e) => p.basename(e.path)), isNot(contains('vits-hi.installing')));
  });

  test('a download that breaks off resumes from the bytes already held', () async {
    final adapter = ScriptedAdapter([
      Reply.cut(archive, 300),
      Reply.bytes(Uint8List.sublistView(archive, 300), status: 206),
    ]);
    final manager = build(adapter);
    expect(await manager.ensure('hi'), isTrue);

    expect(adapter.requests, hasLength(2));
    expect(adapter.requests[1].headers['Range'], 'bytes=300-');
    expect(sleeps, isNotEmpty, reason: 'it backed off first');
  });

  test('a half-finished download from a previous run is continued', () async {
    await Directory(p.join(dir.path, 'downloads')).create(recursive: true);
    await File(p.join(dir.path, 'downloads', 'vits-hi.part')).writeAsBytes(archive.sublist(0, 500));
    final adapter = ScriptedAdapter([Reply.bytes(Uint8List.sublistView(archive, 500), status: 206)]);
    final manager = build(adapter);

    expect(await manager.ensure('hi'), isTrue);
    expect(adapter.requests.single.headers['Range'], 'bytes=500-');
  });

  test('a server that ignores Range and resends the file is handled', () async {
    await Directory(p.join(dir.path, 'downloads')).create(recursive: true);
    await File(p.join(dir.path, 'downloads', 'vits-hi.part')).writeAsBytes(archive.sublist(0, 500));
    final manager = build(ScriptedAdapter([Reply.bytes(archive)]));
    expect(await manager.ensure('hi'), isTrue);
  });

  test('a file whose checksum does not match is refused, deleted and never installed', () async {
    final tampered = Uint8List.fromList(archive)..[archive.length - 1] ^= 0xff;
    final manager = build(ScriptedAdapter([Reply.bytes(tampered)]));

    expect(await manager.ensure('hi'), isFalse);
    expect(manager.statusOf(spec.id), isA<TtsFailed>());
    expect((manager.statusOf(spec.id) as TtsFailed).reason, contains('checksum'));
    expect(await manager.installedFor('hi'), isNull);
    expect(File(p.join(dir.path, 'downloads', 'vits-hi.part')).existsSync(), isFalse);
    expect(Directory(p.join(dir.path, 'vits-hi')).existsSync(), isFalse);
  });

  test('a voice with no checksum is never downloaded', () async {
    final adapter = ScriptedAdapter([Reply.bytes(archive)]);
    final manager = build(adapter, manifest: jsonEncode({
      'models': [
        {'id': 'x', 'languages': ['hi'], 'url': 'https://models.test/x', 'sha256': ''},
      ],
    }));
    expect(await manager.ensure('hi'), isFalse);
    expect(adapter.requests, isEmpty);
  });

  test('a disabled candidate is not downloaded', () async {
    final adapter = ScriptedAdapter([Reply.bytes(archive)]);
    final manager = build(adapter, manifest: jsonEncode({
      'models': [
        {'id': 'x', 'languages': ['hi'], 'enabled': false, 'url': 'https://x', 'sha256': sha(archive)},
      ],
    }));
    expect(await manager.ensure('hi'), isFalse);
    expect(adapter.requests, isEmpty);
  });

  test('a language with no voice at all is simply not available', () async {
    final manager = build(ScriptedAdapter([Reply.bytes(archive)]));
    expect(await manager.ensure('zz'), isFalse);
    expect(await manager.installedFor('zz'), isNull);
  });

  test('a server error is retried with backoff, then the failure is reported — never thrown', () async {
    final manager = build(ScriptedAdapter([Reply.status(503)]));
    expect(await manager.ensure('hi'), isFalse);
    expect(manager.statusOf(spec.id), isA<TtsFailed>());
    expect(sleeps.length, greaterThanOrEqualTo(2));
    expect(sleeps[1], greaterThan(sleeps[0]));
  });

  test('a 404 is not retried', () async {
    final adapter = ScriptedAdapter([Reply.status(404)]);
    final manager = build(adapter);
    expect(await manager.ensure('hi'), isFalse);
    expect(adapter.requests, hasLength(1));
  });

  test('an archive that does not hold the model file is rejected', () async {
    final wrong = buildArchive({'readme.txt': [1, 2, 3]}, root: 'x');
    spec = TtsModelSpec(
      id: spec.id, name: spec.name, languages: spec.languages, engine: spec.engine,
      url: spec.url, sizeBytes: wrong.length, sha256: sha(wrong), files: spec.files,
    );
    archive = wrong;
    final manager = build(ScriptedAdapter([Reply.bytes(wrong)]));
    expect(await manager.ensure('hi'), isFalse);
    expect((manager.statusOf(spec.id) as TtsFailed).reason, contains('model.onnx'));
    expect(await manager.installedFor('hi'), isNull);
  });

  test('a second request while one is running shares it', () async {
    final adapter = ScriptedAdapter([Reply.bytes(archive)]);
    final manager = build(adapter);
    final both = await Future.wait([manager.ensure('hi'), manager.ensure('hi')]);
    expect(both, [true, true]);
    expect(adapter.requests, hasLength(1));
  });

  test('already installed: no download', () async {
    final first = build(ScriptedAdapter([Reply.bytes(archive)]));
    await first.ensure('hi');

    final adapter = ScriptedAdapter([Reply.bytes(archive)]);
    final second = build(adapter);
    expect(await second.ensure('hi'), isTrue);
    expect(adapter.requests, isEmpty);
    expect(second.statusOf(spec.id), isA<TtsInstalled>(), reason: 'found on disk at init');
  });

  test('delete removes the voice and its partial download', () async {
    final manager = build(ScriptedAdapter([Reply.bytes(archive)]));
    await manager.ensure('hi');
    await File(p.join(dir.path, 'downloads', 'vits-hi.part')).writeAsBytes([1]);

    await manager.delete(spec.id);
    expect(await manager.installedFor('hi'), isNull);
    expect(manager.statusOf(spec.id), isA<TtsNotInstalled>());
    expect(Directory(p.join(dir.path, 'vits-hi')).existsSync(), isFalse);
    expect(File(p.join(dir.path, 'downloads', 'vits-hi.part')).existsSync(), isFalse);
    expect(await manager.usedBytes(), 0);
  });

  test('usedBytes counts what is installed', () async {
    final manager = build(ScriptedAdapter([Reply.bytes(archive)]));
    await manager.ensure('hi');
    expect(await manager.usedBytes(), greaterThan(20000));
  });

  test('extractArchive skips entries that would escape the folder', () {
    final evil = buildArchive({'../escape.txt': [1], 'ok.txt': [2]});
    final file = File(p.join(dir.path, 'evil.tar.bz2'))..writeAsBytesSync(evil);
    final out = p.join(dir.path, 'out');
    extractArchive(archive: file.path, dest: out, type: 'tar.bz2');
    expect(File(p.join(out, 'ok.txt')).existsSync(), isTrue);
    expect(File(p.join(dir.path, 'escape.txt')).existsSync(), isFalse);
  });

  test('extractArchive keeps the layout when entries do not share a top folder', () {
    final flat = buildArchive({'a/one.txt': [1], 'b/two.txt': [2]});
    final file = File(p.join(dir.path, 'flat.tar.bz2'))..writeAsBytesSync(flat);
    final out = p.join(dir.path, 'out2');
    extractArchive(archive: file.path, dest: out, type: 'tar.bz2');
    expect(File(p.join(out, 'a', 'one.txt')).existsSync(), isTrue);
    expect(File(p.join(out, 'b', 'two.txt')).existsSync(), isTrue);
  });
}
