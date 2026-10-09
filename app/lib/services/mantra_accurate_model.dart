import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:dio/dio.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../core/constants/auto_chant_config.dart';
import 'auto_chant_log.dart';

/// Where the downloaded recogniser's two files are on disk.
class AccurateModelFiles {
  const AccurateModelFiles({required this.model, required this.tokens});
  final String model;
  final String tokens;
}

/// One file of the download and what it must be, byte for byte.
class AccurateModelPart {
  const AccurateModelPart({required this.name, required this.bytes, required this.sha256});
  final String name;
  final int bytes;
  final String sha256;
}

/// The sharper recogniser auto-count can use once it has been downloaded (see
/// `AutoChantConfig.accurateModelBaseUrl`): finds it, fetches it, removes it.
///
/// It is far too big to bundle, so it is the person's choice — and it is only
/// ever *added*: without it auto-count runs the bundled model exactly as before.
/// A download is checked byte for byte against what the config says it must be;
/// a file that fails is deleted, never loaded, because a model the native library
/// cannot read ends the whole app, not just the feature.
class MantraAccurateModel {
  MantraAccurateModel({
    Dio? dio,
    String? baseUrl,
    this.model = _model,
    this.tokens = _tokens,
    Future<Directory> Function()? folder,
    Future<int?> Function()? memoryMegabytes,
  })  : _dio = dio ?? Dio(),
        _baseUrl = baseUrl ?? AutoChantConfig.accurateModelBaseUrl,
        _folder = folder ?? _supportFolder,
        _memoryMegabytes = memoryMegabytes ?? _deviceMemoryMegabytes;

  static const _model = AccurateModelPart(
    name: AutoChantConfig.accurateModelFile,
    bytes: AutoChantConfig.accurateModelBytes,
    sha256: AutoChantConfig.accurateModelSha256,
  );
  static const _tokens = AccurateModelPart(
    name: AutoChantConfig.accurateTokensFile,
    bytes: AutoChantConfig.accurateTokensBytes,
    sha256: AutoChantConfig.accurateTokensSha256,
  );

  final AccurateModelPart model;
  final AccurateModelPart tokens;
  final String _baseUrl;
  final Dio _dio;
  final Future<Directory> Function() _folder;
  final Future<int?> Function() _memoryMegabytes;

  /// Whether a host was configured at build time. Without one there is nothing
  /// to download, so nothing is shown.
  static bool get isConfigured => AutoChantConfig.accurateModelBaseUrl.isNotEmpty;

  /// The same, for this instance (a test points one at its own server).
  bool get hasHost => _baseUrl.isNotEmpty;

  /// Size to show beside the download button, in megabytes.
  static int get downloadMegabytes =>
      ((AutoChantConfig.accurateModelBytes + AutoChantConfig.accurateTokensBytes) / 1e6).round();

  /// False on a phone with too little memory to run it.
  Future<bool> deviceCanRun() async {
    final megabytes = await _memoryMegabytes();
    // Unknown memory is not a reason to withhold it; a known small amount is.
    return megabytes == null || megabytes >= AutoChantConfig.accurateMinRamMegabytes;
  }

  /// The files, when a complete download is in place; otherwise null.
  Future<AccurateModelFiles?> installed() async {
    final dir = await _folder();
    final modelFile = File(p.join(dir.path, model.name));
    final tokensFile = File(p.join(dir.path, tokens.name));
    if (!await modelFile.exists() || !await tokensFile.exists()) return null;
    if (await modelFile.length() != model.bytes || await tokensFile.length() != tokens.bytes) return null;
    return AccurateModelFiles(model: modelFile.path, tokens: tokensFile.path);
  }

  /// Fetches both files, calling [onProgress] with 0–1 as bytes arrive. A
  /// download that was interrupted carries on from where it stopped. Throws if
  /// nothing is configured, the network fails, or a file is not what it should be.
  Future<void> download({void Function(double progress)? onProgress, CancelToken? cancelToken}) async {
    if (!hasHost) throw StateError('no model host is configured');
    final dir = await _folder();
    await dir.create(recursive: true);
    final total = model.bytes + tokens.bytes;

    AutoChantLog.info('model: downloading the sharper recogniser ($downloadMegabytes MB)');
    await _fetch(tokens, dir, (done) => onProgress?.call(done / total), cancelToken);
    await _fetch(model, dir, (done) => onProgress?.call((tokens.bytes + done) / total), cancelToken);
    AutoChantLog.info('model: downloaded and checked');
  }

  Future<void> remove() async {
    final dir = await _folder();
    if (await dir.exists()) await dir.delete(recursive: true);
    AutoChantLog.info('model: removed');
  }

  Future<void> _fetch(
    AccurateModelPart wanted,
    Directory dir,
    void Function(int bytesSoFar) onBytes,
    CancelToken? cancelToken,
  ) async {
    final target = File(p.join(dir.path, wanted.name));
    if (await target.exists() && await target.length() == wanted.bytes) {
      onBytes(wanted.bytes);
      return;
    }
    final part = File('${target.path}.part');
    var have = await part.exists() ? await part.length() : 0;
    if (have >= wanted.bytes) {
      await part.delete();
      have = 0;
    }

    await _dio.download(
      '$_baseUrl/${wanted.name}',
      part.path,
      cancelToken: cancelToken,
      deleteOnError: false,
      fileAccessMode: have > 0 ? FileAccessMode.append : FileAccessMode.write,
      options: Options(headers: have > 0 ? {HttpHeaders.rangeHeader: 'bytes=$have-'} : null),
      onReceiveProgress: (received, _) => onBytes(have + received),
    );

    final digest = await sha256.bind(part.openRead()).first;
    if (await part.length() != wanted.bytes || digest.toString() != wanted.sha256) {
      await part.delete();
      throw StateError('${wanted.name} did not download intact');
    }
    await part.rename(target.path);
  }

  static Future<Directory> _supportFolder() async {
    final support = await getApplicationSupportDirectory();
    return Directory(p.join(support.path, AutoChantConfig.accurateModelFolder));
  }

  static Future<int?> _deviceMemoryMegabytes() async {
    try {
      final info = DeviceInfoPlugin();
      if (Platform.isAndroid) return (await info.androidInfo).physicalRamSize;
      if (Platform.isIOS) return (await info.iosInfo).physicalRamSize;
    } catch (_) {
      // not knowing is handled by the caller
    }
    return null;
  }
}
