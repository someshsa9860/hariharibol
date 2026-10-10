import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:isolate';

import 'package:archive/archive.dart';
import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../../core/constants/tts_config.dart';
import '../../models/tts_model.dart';

/// A voice that is on the phone and ready to load.
class InstalledVoice {
  const InstalledVoice({required this.spec, required this.dir});

  final TtsModelSpec spec;
  final String dir;
}

/// Maps each speaking language to an offline neural voice, and looks after the
/// voices on the phone: download on demand with resume, checksum before
/// anything is unpacked, install, delete.
///
/// A voice is only ever installed from a file whose SHA-256 matches the
/// manifest. A voice with no checksum is not installable, whatever its URL says.
/// Nothing here can block speech: if a voice is missing, not installable or
/// failed, the callers use the phone's own.
class TtsModelManager {
  TtsModelManager({
    Future<Directory> Function()? baseDir,
    Dio? dio,
    Future<String> Function()? bundledManifest,
    Future<void> Function(Duration)? sleep,
  })  : _baseDir = baseDir ?? _defaultBase,
        _dio = dio ?? _defaultDio(),
        _bundled = bundledManifest ?? (() => rootBundle.loadString(TtsConfig.bundledManifestAsset)),
        _sleep = sleep ?? Future<void>.delayed;

  static final TtsModelManager instance = TtsModelManager();

  final Future<Directory> Function() _baseDir;
  final Dio _dio;
  final Future<String> Function() _bundled;
  final Future<void> Function(Duration) _sleep;

  static Future<Directory> _defaultBase() async =>
      Directory(p.join((await getApplicationSupportDirectory()).path, TtsConfig.modelsDir));

  static Dio _defaultDio() => Dio(BaseOptions(
        connectTimeout: TtsConfig.connectTimeout,
        receiveTimeout: TtsConfig.receiveTimeout,
        validateStatus: (s) => s != null && (s == 200 || s == 206),
      ));

  TtsModelManifest _manifest = TtsModelManifest.empty;
  Future<void>? _loading;
  final Map<String, TtsModelStatus> _status = {};
  final StreamController<Map<String, TtsModelStatus>> _changes = StreamController.broadcast();
  final Map<String, Future<bool>> _installs = {};
  final Map<String, CancelToken> _cancels = {};

  TtsModelManifest get manifest => _manifest;

  /// The status of every voice, whenever any changes.
  Stream<Map<String, TtsModelStatus>> get statuses => _changes.stream;

  Map<String, TtsModelStatus> get currentStatuses => Map.unmodifiable(_status);

  TtsModelStatus statusOf(String id) => _status[id] ?? const TtsNotInstalled();

  void _set(String id, TtsModelStatus status) {
    _status[id] = status;
    if (!_changes.isClosed) _changes.add(Map.unmodifiable(_status));
  }

  // ── Manifest ──────────────────────────────────────────────────────────

  /// Loads the manifest (remote, else the last remote one, else the bundled
  /// one) and finds out which voices are already installed. Safe to call often.
  Future<void> init() => _loading ??= _load();

  Future<void> _load() async {
    final base = await _base();
    final cache = File(p.join(base.path, TtsConfig.manifestCacheFile));
    TtsModelManifest? loaded;

    if (TtsConfig.manifestUrl.isNotEmpty) {
      try {
        final response = await _dio.get<String>(TtsConfig.manifestUrl, options: Options(responseType: ResponseType.plain));
        loaded = TtsModelManifest.fromJson(jsonDecode(response.data!) as Map<String, dynamic>);
        await cache.writeAsString(response.data!);
      } catch (error) {
        _log('remote manifest unavailable: $error');
      }
    }
    if (loaded == null && cache.existsSync()) {
      try {
        loaded = TtsModelManifest.fromJson(jsonDecode(await cache.readAsString()) as Map<String, dynamic>);
      } catch (_) {}
    }
    loaded ??= TtsModelManifest.fromJson(jsonDecode(await _bundled()) as Map<String, dynamic>);
    _manifest = loaded;

    for (final spec in _manifest.models) {
      if (await _isInstalled(spec)) _set(spec.id, TtsInstalled(await _dirSize(await _modelDir(spec.id))));
    }
  }

  /// The voice that would speak [language], installed or not.
  TtsModelSpec? specFor(String language) => _manifest.forLanguage(language);

  // ── What is on the phone ──────────────────────────────────────────────

  Future<Directory> _base() async {
    final dir = await _baseDir();
    if (!dir.existsSync()) await dir.create(recursive: true);
    return dir;
  }

  Future<Directory> _modelDir(String id) async => Directory(p.join((await _base()).path, id));

  Future<bool> _isInstalled(TtsModelSpec spec) async {
    final dir = await _modelDir(spec.id);
    if (!File(p.join(dir.path, TtsConfig.installedMarker)).existsSync()) return false;
    return File(p.join(dir.path, spec.files.model)).existsSync();
  }

  /// The installed voice that speaks [language], or null.
  Future<InstalledVoice?> installedFor(String language) async {
    await init();
    for (final spec in _manifest.models) {
      if (spec.speaks(language) && statusOf(spec.id) is TtsInstalled && await _isInstalled(spec)) {
        return InstalledVoice(spec: spec, dir: (await _modelDir(spec.id)).path);
      }
    }
    return null;
  }

  Future<int> usedBytes() async {
    var total = 0;
    for (final entry in _status.entries) {
      final status = entry.value;
      if (status is TtsInstalled) total += status.sizeBytes;
    }
    return total;
  }

  // ── Installing ────────────────────────────────────────────────────────

  /// Makes sure a voice for [language] is on the phone, downloading it if need
  /// be. Completes with whether one is installed afterwards; never throws.
  Future<bool> ensure(String language) async {
    await init();
    final spec = specFor(language);
    if (spec == null || !spec.installable) return false;
    return install(spec);
  }

  /// Downloads, checks and installs [spec]. One install per voice at a time.
  Future<bool> install(TtsModelSpec spec) {
    if (!spec.installable) {
      _set(spec.id, const TtsFailed('not available yet'));
      return Future.value(false);
    }
    if (statusOf(spec.id) is TtsInstalled) return Future.value(true);
    return _installs[spec.id] ??= _install(spec).whenComplete(() {
      _installs.remove(spec.id);
      _cancels.remove(spec.id);
    });
  }

  Future<bool> _install(TtsModelSpec spec) async {
    try {
      final base = await _base();
      final downloads = await Directory(p.join(base.path, TtsConfig.downloadsDir)).create(recursive: true);
      final part = File(p.join(downloads.path, '${spec.id}.part'));

      _set(spec.id, TtsDownloading(received: part.existsSync() ? part.lengthSync() : 0, total: spec.sizeBytes));
      await _download(spec, part);

      _set(spec.id, const TtsVerifying());
      final digest = await _sha256Of(part);
      if (digest != spec.sha256) {
        await part.delete();
        throw StateError('checksum mismatch');
      }

      _set(spec.id, const TtsExtracting());
      final dest = Directory(p.join(base.path, '${spec.id}.installing'));
      if (dest.existsSync()) await dest.delete(recursive: true);
      if (spec.archive == 'file') {
        await dest.create(recursive: true);
        await part.copy(p.join(dest.path, spec.files.model));
      } else {
        await Isolate.run(() => extractArchive(archive: part.path, dest: dest.path, type: spec.archive));
      }
      if (!File(p.join(dest.path, spec.files.model)).existsSync()) {
        await dest.delete(recursive: true);
        throw StateError('the voice is missing ${spec.files.model}');
      }
      await File(p.join(dest.path, TtsConfig.installedMarker)).writeAsString(jsonEncode({
        'id': spec.id,
        'sha256': spec.sha256,
        'installedAt': DateTime.now().toIso8601String(),
      }));

      final live = await _modelDir(spec.id);
      if (live.existsSync()) await live.delete(recursive: true);
      await dest.rename(live.path); // the voice appears whole or not at all
      await part.delete();

      _set(spec.id, TtsInstalled(await _dirSize(live)));
      return true;
    } catch (error) {
      if (error is DioException && CancelToken.isCancel(error)) {
        _set(spec.id, const TtsNotInstalled());
      } else {
        _log('installing ${spec.id} failed: $error');
        _set(spec.id, TtsFailed(error.toString()));
      }
      return false;
    }
  }

  /// Fetches [spec.url] into [part], carrying on from what is already there.
  Future<void> _download(TtsModelSpec spec, File part) async {
    final cancel = _cancels[spec.id] = CancelToken();
    var lastReport = DateTime.fromMillisecondsSinceEpoch(0);

    for (var attempt = 1;; attempt++) {
      final have = part.existsSync() ? part.lengthSync() : 0;
      if (spec.sizeBytes > 0 && have == spec.sizeBytes) return; // finished earlier; verify next

      try {
        final response = await _dio.get<ResponseBody>(
          spec.url,
          cancelToken: cancel,
          options: Options(
            responseType: ResponseType.stream,
            headers: have > 0 ? {'Range': 'bytes=$have-'} : null,
          ),
        );
        final resumed = response.statusCode == 206 && have > 0;
        final sink = part.openWrite(mode: resumed ? FileMode.append : FileMode.write);
        var received = resumed ? have : 0;
        try {
          await for (final chunk in response.data!.stream) {
            sink.add(chunk);
            received += chunk.length;
            final now = DateTime.now();
            if (now.difference(lastReport) >= TtsConfig.progressInterval) {
              lastReport = now;
              _set(spec.id, TtsDownloading(received: received, total: spec.sizeBytes));
            }
          }
        } finally {
          await sink.close();
        }
        _set(spec.id, TtsDownloading(received: received, total: spec.sizeBytes));
        return;
      } catch (error) {
        if (error is DioException && CancelToken.isCancel(error)) rethrow;
        final status = error is DioException ? error.response?.statusCode : null;
        if (status == 416) {
          // What we hold does not fit the file on the server: start again.
          if (part.existsSync()) await part.delete();
          if (attempt < TtsConfig.downloadAttempts) continue;
        }
        final transient = status == null || status >= 500 || status == 429 || error is IOException;
        if (!transient || attempt >= TtsConfig.downloadAttempts) rethrow;
        await _sleep(TtsConfig.backoffBase * (1 << (attempt - 1)));
      }
    }
  }

  /// Stops a download. The partial file stays, so it can be resumed later.
  void cancel(String id) => _cancels[id]?.cancel('cancelled');

  /// Removes an installed voice and any half-finished download of it.
  Future<void> delete(String id) async {
    cancel(id);
    final dir = await _modelDir(id);
    if (dir.existsSync()) await dir.delete(recursive: true);
    final part = File(p.join((await _base()).path, TtsConfig.downloadsDir, '$id.part'));
    if (part.existsSync()) await part.delete();
    _set(id, const TtsNotInstalled());
  }

  Future<void> dispose() async {
    await _changes.close();
  }

  Future<String> _sha256Of(File file) async => (await sha256.bind(file.openRead()).first).toString();

  Future<int> _dirSize(Directory dir) async {
    var total = 0;
    if (!dir.existsSync()) return 0;
    await for (final entity in dir.list(recursive: true, followLinks: false)) {
      if (entity is File) total += await entity.length();
    }
    return total;
  }

  void _log(String message) {
    if (kDebugMode) debugPrint('[TtsModels] $message');
  }
}

/// Unpacks a `tar.bz2` or `zip` into [dest]. If every entry shares one top-level
/// folder (as sherpa-onnx archives do) it is stripped, so the files land at the
/// paths the manifest names. Entries that would escape [dest] are skipped.
///
/// Top-level and free of state so it runs in an isolate.
void extractArchive({required String archive, required String dest, required String type}) {
  final bytes = File(archive).readAsBytesSync();
  final Archive entries;
  switch (type) {
    case 'tar.bz2':
      entries = TarDecoder().decodeBytes(BZip2Decoder().decodeBytes(bytes));
    case 'zip':
      entries = ZipDecoder().decodeBytes(bytes);
    default:
      throw ArgumentError('unknown archive type $type');
  }

  final files = entries.where((e) => e.isFile).toList();
  final firsts = files.map((e) => e.name.replaceAll('\\', '/').split('/').first).toSet();
  final strip = files.isNotEmpty && firsts.length == 1 && files.every((e) => e.name.contains('/'));

  final root = p.normalize(p.absolute(dest));
  Directory(root).createSync(recursive: true);
  for (final entry in files) {
    var name = entry.name.replaceAll('\\', '/');
    if (strip) name = name.substring(name.indexOf('/') + 1);
    final target = p.normalize(p.join(root, name));
    if (!p.isWithin(root, target)) continue;
    File(target)
      ..createSync(recursive: true)
      ..writeAsBytesSync(entry.content as List<int>);
  }
}
