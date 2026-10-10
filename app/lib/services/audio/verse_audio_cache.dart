import 'dart:async';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../../core/constants/tts_config.dart';
import '../../models/verse.dart';
import 'audio_link_resolver.dart';

/// Verse recitations on the phone. The first play downloads the file and keeps
/// it; later plays — and the next verse, fetched ahead of time — come from disk.
///
/// Cached by the audio's *key*, not its link: a link is signed and changes every
/// hour, the file does not. Oldest files go when the cache passes its limit.
class VerseAudioCache {
  VerseAudioCache({
    required this._resolver,
    Dio? dio,
    Future<Directory> Function()? directory,
    this._maxBytes = TtsConfig.verseAudioMaxBytes,
  })  : _dio = dio ?? Dio(BaseOptions(connectTimeout: TtsConfig.connectTimeout, receiveTimeout: TtsConfig.receiveTimeout)),
        _directory = directory ?? _defaultDirectory;

  final AudioLinkResolver _resolver;
  final Dio _dio;
  final Future<Directory> Function() _directory;
  final int _maxBytes;
  final Map<String, Future<File?>> _inFlight = {};

  static Future<Directory> _defaultDirectory() async =>
      Directory(p.join((await getApplicationSupportDirectory()).path, TtsConfig.verseAudioDir));

  /// What identifies this recording across link changes.
  @visibleForTesting
  static String? keyOf(Verse verse) {
    final path = verse.audioPath;
    if (path != null && path.isNotEmpty) return path;
    final url = verse.audioUrl;
    if (url == null || url.isEmpty) return null;
    final uri = Uri.tryParse(url);
    return uri == null ? url : uri.replace(query: '', fragment: '').toString().replaceAll(RegExp(r'\?$'), '');
  }

  Future<File> _fileFor(String key) async {
    final dir = await _directory();
    if (!dir.existsSync()) await dir.create(recursive: true);
    final extension = p.extension(Uri.tryParse(key)?.path ?? key);
    final name = sha1.convert(key.codeUnits).toString();
    return File(p.join(dir.path, '$name${extension.isEmpty ? '.mp3' : extension}'));
  }

  /// The recitation as a local file, or null if the verse has none or it could
  /// not be fetched — in which case the player simply carries on to the meaning.
  /// [following] are the verses after it, so their links are asked for together.
  Future<File?> fileFor(Verse verse, {List<Verse> following = const []}) {
    final key = keyOf(verse);
    if (key == null) return Future.value();
    return _inFlight[key] ??= _fetch(verse, key, following).whenComplete(() {
      _inFlight.remove(key);
    });
  }

  /// Starts fetching [verse] without waiting for it.
  void prefetch(Verse verse, {List<Verse> following = const []}) {
    unawaited(fileFor(verse, following: following).then((_) {}, onError: (Object _) {}));
  }

  Future<File?> _fetch(Verse verse, String key, List<Verse> following) async {
    try {
      final file = await _fileFor(key);
      if (file.existsSync() && file.lengthSync() > 0) {
        unawaited(file.setLastModified(DateTime.now()).catchError((_) {}));
        return file;
      }

      final link = await _resolver.linkFor(verse, following: following);
      if (link == null) return null;

      final part = File('${file.path}.part');
      await _dio.download(link, part.path);
      if (!part.existsSync() || part.lengthSync() == 0) return null;
      await part.rename(file.path);
      unawaited(_prune(file.parent));
      return file;
    } catch (error) {
      if (kDebugMode) debugPrint('[VerseAudio] ${verse.verseId}: $error');
      return null;
    }
  }

  Future<void> _prune(Directory dir) async {
    try {
      final files = dir.listSync().whereType<File>().where((f) => !f.path.endsWith('.part')).toList();
      var total = files.fold<int>(0, (sum, f) => sum + f.lengthSync());
      if (total <= _maxBytes) return;
      files.sort((a, b) => a.lastModifiedSync().compareTo(b.lastModifiedSync()));
      for (final file in files) {
        if (total <= _maxBytes) break;
        total -= file.lengthSync();
        await file.delete();
      }
    } catch (_) {}
  }

  Future<int> usedBytes() async {
    final dir = await _directory();
    if (!dir.existsSync()) return 0;
    return dir.listSync().whereType<File>().fold<int>(0, (sum, f) => sum + f.lengthSync());
  }

  Future<void> clear() async {
    final dir = await _directory();
    if (dir.existsSync()) await dir.delete(recursive: true);
  }
}
