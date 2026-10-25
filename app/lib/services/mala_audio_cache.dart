import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../core/constants/offline_config.dart';

/// Mala recordings kept on the phone, so the chant along plays with no
/// connection (`ChantMalaPlayer` opens the file when there is one).
///
/// A recording is named by its link without the signature: the link is signed
/// for an hour, but its path is the upload's own key, which the server makes
/// new for every upload, so a replaced recording is a new file. One is saved
/// the first time it plays with a connection, and ahead of time for the
/// reader's own mantra (`OfflineWarmer`). At most
/// `OfflineConfig.maxSavedRecordings` are kept, the one played least recently
/// going first. They are the catalogue's recordings, not anything personal, so
/// sign-out leaves them. See "Offline" in app/CLAUDE.md.
class MalaAudioCache {
  MalaAudioCache({Future<Directory> Function()? directory, Dio? dio})
      : _directory = directory ?? _defaultDirectory,
        _dio = dio ??
            Dio(BaseOptions(
              connectTimeout: OfflineConfig.recordingConnectTimeout,
              receiveTimeout: OfflineConfig.recordingReceiveTimeout,
            ));

  static final MalaAudioCache instance = MalaAudioCache();

  final Future<Directory> Function() _directory;
  final Dio _dio;
  final Map<String, Future<File?>> _saving = {};

  static Future<Directory> _defaultDirectory() async =>
      Directory(p.join((await getApplicationSupportDirectory()).path, 'mala_audio'));

  /// The file name for [url]: the link without its query, hashed, with the
  /// recording's own extension (iOS goes by it to know the kind of file).
  static String nameFor(String url) {
    final uri = Uri.tryParse(url);
    final identity = uri == null ? url : '${uri.scheme}://${uri.authority}${uri.path}';
    final extension = uri == null ? '' : p.extension(uri.path);
    return '${sha1.convert(utf8.encode(identity))}$extension';
  }

  Future<File> _fileFor(String url) async => File(p.join((await _directory()).path, nameFor(url)));

  /// The kept file for [url], or null. Marks it as just played. Never throws.
  Future<File?> file(String url) async {
    try {
      final file = await _fileFor(url);
      if (!await file.exists()) return null;
      unawaited(file.setLastModified(DateTime.now()).catchError((_) {}));
      return file;
    } catch (_) {
      return null;
    }
  }

  /// Downloads [url] unless it is kept already. Two calls for one recording
  /// make one download. Never throws: null when it could not be saved.
  Future<File?> save(String url) {
    final name = nameFor(url);
    // A block body: `remove` returns this very future, and `whenComplete`
    // would wait on it — on itself, for ever.
    return _saving[name] ??= _save(url).whenComplete(() {
      _saving.remove(name);
    });
  }

  Future<File?> _save(String url) async {
    File? part;
    try {
      final file = await _fileFor(url);
      if (await file.exists()) return file;
      await file.parent.create(recursive: true);

      // Written beside it and moved into place whole, so a download cut off
      // half-way is never taken for the recording.
      part = File('${file.path}.part');
      await _dio.download(url, part.path);
      await part.rename(file.path);
      await _trim(file.parent);
      return file;
    } catch (error) {
      if (kDebugMode) debugPrint('[MalaAudioCache] could not save: $error');
      try {
        if (part != null && await part.exists()) await part.delete();
      } catch (_) {}
      return null;
    }
  }

  /// Drops the kept file for [url] — one that would not play.
  Future<void> forget(String url) async {
    try {
      final file = await _fileFor(url);
      if (await file.exists()) await file.delete();
    } catch (_) {}
  }

  Future<void> _trim(Directory dir) async {
    final files = [
      for (final entity in await dir.list().toList())
        if (entity is File && !entity.path.endsWith('.part')) entity,
    ];
    if (files.length <= OfflineConfig.maxSavedRecordings) return;

    final played = [for (final file in files) (file, await file.lastModified())]
      ..sort((a, b) => b.$2.compareTo(a.$2));
    for (final (file, _) in played.skip(OfflineConfig.maxSavedRecordings)) {
      await file.delete();
    }
  }
}
